export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EpicerieDiscoverCard } from '../../src/components/client/EpicerieDiscoverCard';
import {
  EpicerieDiscoverFiltersSheet,
  EpicerieDiscoverFiltersValue,
} from '../../src/components/client/EpicerieDiscoverFiltersSheet';
import { EpiceriesMapView } from '../../src/components/client/EpiceriesMapView';
import { Skeleton, useToast } from '../../src/components/feedback';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { favoritesService } from '../../src/services/favoritesService';
import { promotionService } from '../../src/services/promotionService';
import { useTheme } from '../../src/theme';
import { EPICERIE_TYPES, Epicerie, EpicerieType } from '../../src/type';

const DEFAULT_RADIUS = 5;
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

type SortKey = 'distance' | 'rating' | 'products';

/** Distance km : préfère le calcul backend, sinon haversine local. */
function distanceForSort(
  e: Epicerie,
  loc: { latitude: number; longitude: number } | null,
): number {
  if (e.distanceKm != null && Number.isFinite(e.distanceKm)) return e.distanceKm;
  if (!loc || e.latitude == null || e.longitude == null) return Number.POSITIVE_INFINITY;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(e.latitude - loc.latitude);
  const dLon = toRad(e.longitude - loc.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(loc.latitude)) * Math.cos(toRad(e.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Déduplication par id en préservant l'ordre (fusion de pages). */
function dedupById(list: Epicerie[]): Epicerie[] {
  const seen = new Set<number>();
  const out: Epicerie[] = [];
  for (const e of list) {
    if (e && e.id != null && !seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

/**
 * Écran de découverte des épiceries pour les clients.
 *
 * <p>UX moderne style Glovo/Deliveroo :
 *  - Barre de recherche en pill repliable au scroll
 *  - Pills de filtres rapides : "Ouvert maintenant" + types horizontaux
 *  - Bouton ⚙ qui ouvre un bottom-sheet avec rayon + type + ouvert
 *  - Liste de cartes pleine largeur avec photo en bandeau (180px)
 *
 * <p>Filtrage 100 % côté client à partir de la liste renvoyée par
 * <code>searchByProximity</code>. On évite les re-fetch et les spinners
 * quand l'utilisateur change un filtre : la réactivité est instantanée.</p>
 */
export default function EpiceriesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const theme = useTheme();
  const params = useLocalSearchParams<{ search?: string; categoryId?: string; category?: string }>();

  const [allEpiceries, setAllEpiceries] = useState<Epicerie[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // Position GPS de l'utilisateur — utilisée pour la recherche et la distance affichée.
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // ── Filtres ─────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState<string>(typeof params.search === 'string' ? params.search : '');
  // B2 — Catégorie transmise depuis la home (categoryId + libellé). Avant, ces
  // params étaient purement ignorés (seul `search` était lu) → la sélection de
  // catégorie sur la home ouvrait une liste NON filtrée.
  //
  // Critère retenu : l'API épiceries n'expose AUCUN filtre par catégorie produit
  // et le modèle Epicerie ne porte que `epicerieType` (pas ses rayons). Un vrai
  // filtrage exigerait un endpoint dédié (ex. /epiceries/by-category) ou N appels
  // getCategoriesByEpicerie (coûteux, une requête par boutique). On surface donc
  // la sélection comme un chip actif, dismissable, compté dans les filtres et
  // effaçable — et on CONSERVE categoryId en état pour un futur endpoint. La porte
  // d'entrée de découverte n'est plus silencieusement perdue.
  const [categoryId, setCategoryId] = useState<string | null>(
    typeof params.categoryId === 'string' ? params.categoryId : null,
  );
  const [categoryLabel, setCategoryLabel] = useState<string | null>(
    typeof params.category === 'string' ? params.category : null,
  );
  const [openOnly, setOpenOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EpicerieType | null>(null);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Recherche par nom débouncée → pilote l'appel backend (searchByName /
  // searchByProximityAndName) au lieu de filtrer le tampon local.
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchText);

  // ── Tri (F2) + favoris en tête (F1) ─────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [favoritesFirst, setFavoritesFirst] = useState(false);

  // ── Mode d'affichage (Lot 4) : liste ou carte ───────────────────────
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // ── Promotions (E2/F-promo) ─────────────────────────────────────────
  // Map epicerieId → réduction max (%) parmi les promos actives à proximité.
  const [promoMap, setPromoMap] = useState<Map<number, number>>(new Map());
  const [promoOnly, setPromoOnly] = useState(false);

  // ── Pagination (scroll infini) ──────────────────────────────────────
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  // Garde-fou anti-concurrence : évite deux chargements simultanés.
  const inFlightRef = useRef(false);

  // ── Effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    initializeAutoSearch();
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Débounce de la saisie → limite les appels réseau pendant la frappe.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchText]);

  // Recharge la page 0 dès que la requête effective change (position, rayon,
  // texte débouncé). On attend que l'état de localisation soit résolu pour
  // éviter un premier fetch « sans position » avant que le GPS réponde.
  useEffect(() => {
    if (!locationReady) return;
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationReady, userLocation, radius, debouncedSearch]);

  // Promotions actives à proximité (nécessite une position).
  useEffect(() => {
    if (userLocation) loadNearbyPromotions(userLocation, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, radius]);

  const initializeAutoSearch = async () => {
    try {
      let granted = false;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        granted = true;
      } else {
        const result = await Location.requestForegroundPermissionsAsync();
        granted = result.status === 'granted';
      }
      if (granted) {
        await detectLocation();
      }
    } catch (e) {
      console.error('[EpiceriesScreen] init failed', e);
    } finally {
      // Débloque le chargement : avec ou sans position, la recherche démarre.
      setLocationReady(true);
    }
  };

  const detectLocation = async () => {
    try {
      setLocationLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch {
      toast.error(t('common.error'), t('epiceries.gpsError'));
    } finally {
      setLocationLoading(false);
    }
  };

  /**
   * Appel backend unifié :
   *  - position + texte → searchByProximityAndName
   *  - position seule   → searchByProximity
   *  - sans position    → searchByName (fallback)
   */
  const runSearch = async (
    loc: { latitude: number; longitude: number } | null,
    query: string,
    pageNum: number,
  ): Promise<Epicerie[]> => {
    const q = query.trim();
    if (loc) {
      if (q) {
        return epicerieService.searchByProximityAndName(
          loc.latitude, loc.longitude, q, radius, pageNum, PAGE_SIZE,
        );
      }
      return epicerieService.searchByProximity(loc.latitude, loc.longitude, radius, pageNum, PAGE_SIZE);
    }
    return epicerieService.searchByName(q, pageNum, PAGE_SIZE);
  };

  const loadFirstPage = async () => {
    inFlightRef.current = true;
    setLoading(true);
    try {
      const data = await runSearch(userLocation, debouncedSearch, 0);
      const list = data || [];
      setAllEpiceries(dedupById(list));
      setPage(0);
      setHasMore(list.length >= PAGE_SIZE);
      setHasFetched(true);
    } catch (error) {
      toast.error(t('common.error'), String(error));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Scroll infini — accumule les pages suivantes (dédupliquées).
  const loadMore = useCallback(async () => {
    if (inFlightRef.current || loading || loadingMore || !hasMore || !locationReady) return;
    const next = page + 1;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const data = await runSearch(userLocation, debouncedSearch, next);
      const list = data || [];
      if (list.length === 0) {
        setHasMore(false);
      } else {
        setAllEpiceries((prev) => dedupById([...prev, ...list]));
        setPage(next);
        setHasMore(list.length >= PAGE_SIZE);
      }
    } catch (error) {
      console.error('[EpiceriesScreen] loadMore failed', error);
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasMore, locationReady, page, userLocation, debouncedSearch, radius]);

  const loadNearbyPromotions = async (
    loc: { latitude: number; longitude: number },
    r: number,
  ) => {
    try {
      const promos = await promotionService.getNearbyPromotions(loc.latitude, loc.longitude, r);
      const m = new Map<number, number>();
      for (const p of promos || []) {
        const cur = m.get(p.epicerieId) || 0;
        m.set(p.epicerieId, Math.max(cur, p.reductionPercentage || 0));
      }
      setPromoMap(m);
    } catch (error) {
      // Échec silencieux : la découverte reste fonctionnelle sans promos.
      console.warn('[EpiceriesScreen] nearby promotions failed', error);
    }
  };

  const loadFavoriteIds = async () => {
    try {
      const ids = await favoritesService.getFavoriteIds();
      setFavoriteIds(ids);
    } catch (error) {
      console.error('[EpiceriesScreen] favoris load failed', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadFirstPage(),
      loadFavoriteIds(),
      userLocation ? loadNearbyPromotions(userLocation, radius) : Promise.resolve(),
    ]);
  };

  // ── Filtrage côté client ─────────────────────────────────────────────
  // La recherche par nom passe désormais par le backend (débouncée). On ne
  // conserve ici que les filtres purement locaux : ouvert, type, promo.
  const filteredEpiceries = useMemo(() => {
    return allEpiceries
      .filter((e) => (openOnly ? e.isOpen === true : true))
      .filter((e) => (typeFilter ? e.epicerieType === typeFilter : true))
      .filter((e) => (promoOnly ? promoMap.has(e.id) : true));
  }, [allEpiceries, openOnly, typeFilter, promoOnly, promoMap]);

  // ── Tri (F2) + favoris en tête (F1) ──────────────────────────────────
  const sortedEpiceries = useMemo(() => {
    const favSet = new Set(favoriteIds);
    const arr = filteredEpiceries.slice();
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'rating':
          return (b.averageRating ?? 0) - (a.averageRating ?? 0);
        case 'products':
          return (b.nombreProducts ?? 0) - (a.nombreProducts ?? 0);
        case 'distance':
        default:
          return distanceForSort(a, userLocation) - distanceForSort(b, userLocation);
      }
    });
    // Array.sort est stable (Hermes) → on remonte les favoris sans casser
    // l'ordre du tri principal à l'intérieur de chaque groupe.
    if (favoritesFirst) {
      arr.sort((a, b) => (favSet.has(b.id) ? 1 : 0) - (favSet.has(a.id) ? 1 : 0));
    }
    return arr;
  }, [filteredEpiceries, sortKey, favoritesFirst, favoriteIds, userLocation]);

  const activeFiltersCount =
    (openOnly ? 1 : 0) + (typeFilter ? 1 : 0) + (radius !== DEFAULT_RADIUS ? 1 : 0)
    + (categoryLabel ? 1 : 0) + (promoOnly ? 1 : 0);

  // B2 — Efface le filtre catégorie (chip dismissable). categoryId est libéré
  // en même temps que le libellé.
  const clearCategory = () => {
    setCategoryLabel(null);
    setCategoryId(null);
  };

  // ── Toggle favori (optimiste) ────────────────────────────────────────
  // useCallback + mises à jour fonctionnelles → référence stable pour que
  // React.memo sur la carte ne re-rende que les lignes concernées.
  const handleToggleFavorite = useCallback(async (epicerieId: number, isCurrentlyFavorite: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFavoriteIds((prev) =>
      isCurrentlyFavorite ? prev.filter((id) => id !== epicerieId) : [...prev, epicerieId],
    );
    try {
      const success = await favoritesService.toggleFavorite(epicerieId, isCurrentlyFavorite);
      if (!success) throw new Error('toggleFavorite returned false');
    } catch (error) {
      console.error('[EpiceriesScreen] toggleFavorite failed', error);
      // Revert : on rétablit l'état antérieur au toggle.
      setFavoriteIds((prev) =>
        isCurrentlyFavorite ? [...prev, epicerieId] : prev.filter((id) => id !== epicerieId),
      );
      toast.error(t('common.error'), t('epiceries.favoritesError'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePressEpicerie = useCallback((e: Epicerie) => {
    router.push(`/(client)/(epicerie)/${e.id}`);
  }, [router]);

  // Vue carte : navigation par id (même destination que le tap d'une carte).
  const handleSelectEpicerieId = useCallback((id: number) => {
    router.push(`/(client)/(epicerie)/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Epicerie }) => (
    <EpicerieDiscoverCard
      epicerie={item}
      isFavorite={favoriteIds.includes(item.id)}
      onPress={handlePressEpicerie}
      onToggleFavorite={handleToggleFavorite}
      userLocation={userLocation}
      promoPercent={promoMap.get(item.id)}
    />
  ), [favoriteIds, handlePressEpicerie, handleToggleFavorite, userLocation, promoMap]);

  // ── Filtres ──────────────────────────────────────────────────────────
  const applyFilters = (next: EpicerieDiscoverFiltersValue) => {
    setOpenOnly(next.openOnly);
    setTypeFilter(next.type);
    setRadius(next.radius);
  };

  const handleRetryLocation = () => {
    if (!userLocation && !locationLoading) {
      Alert.alert(
        t('epiceries.locationDisabled'),
        t('epiceries.enableLocationMessage'),
        [
          { text: t('common.no'), style: 'cancel' },
          { text: t('common.yes'), onPress: detectLocation },
        ]
      );
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────

  const renderQuickFilters = () => (
    <View style={styles.quickFilters}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScrollContent}
      >
        {/* B2 — Chip catégorie actif (issu de la home). Dismissable : un tap
            l'efface. Placé en tête pour être immédiatement visible. */}
        {categoryLabel && (
          <TouchableOpacity
            testID={`category-chip-${categoryId ?? ''}`}
            style={[styles.chip, { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}
            onPress={clearCategory}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={(t('epiceries.categoryFilter') || 'Catégorie : {{name}}').replace('{{name}}', categoryLabel)}
          >
            <Text style={[styles.chipText, { color: '#fff' }]} numberOfLines={1}>
              {(t('epiceries.categoryFilter') || 'Catégorie : {{name}}').replace('{{name}}', categoryLabel)}
            </Text>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Pill "Ouvert maintenant" */}
        <TouchableOpacity
          style={[styles.chip, openOnly && { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}
          onPress={() => setOpenOnly((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipIcon, { color: openOnly ? '#fff' : '#16a34a' }]}>●</Text>
          <Text style={[styles.chipText, openOnly && { color: '#fff' }]}>
            {t('epiceries.openNow') || 'Ouvert maintenant'}
          </Text>
        </TouchableOpacity>

        {/* Pill "Promo en cours" — n'affiche que les épiceries en promo. */}
        {promoMap.size > 0 && (
          <TouchableOpacity
            style={[styles.chip, promoOnly && { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}
            onPress={() => setPromoOnly((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.chipIcon}>🔥</Text>
            <Text style={[styles.chipText, promoOnly && { color: '#fff' }]}>
              {t('epiceries.promoFilter') || 'Promo'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Pill "Type" avec dropdown indicator → ouvre le sheet */}
        <TouchableOpacity
          style={[styles.chip, typeFilter && { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}
          onPress={() => setShowFiltersSheet(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, typeFilter && { color: '#fff' }]}>
            {typeFilter
              ? `${EPICERIE_TYPES.find((tp) => tp.value === typeFilter)?.icon || ''} ${EPICERIE_TYPES.find((tp) => tp.value === typeFilter)?.label || ''}`
              : (t('epiceries.allTypes') || 'Tous les types')}
          </Text>
          <Ionicons name="chevron-down" size={14} color={typeFilter ? '#fff' : '#555'} />
        </TouchableOpacity>

        {/* Pills rapides types courants */}
        {EPICERIE_TYPES.slice(0, 6).map((tp) => {
          const isActive = typeFilter === tp.value;
          return (
            <TouchableOpacity
              key={tp.value}
              style={[styles.chip, isActive && { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}
              onPress={() => setTypeFilter((cur) => (cur === tp.value ? null : tp.value))}
              activeOpacity={0.8}
            >
              <Text style={styles.chipIcon}>{tp.icon}</Text>
              <Text style={[styles.chipText, isActive && { color: '#fff' }]} numberOfLines={1}>
                {tp.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── Barre de tri (F2) + favoris en tête (F1) ─────────────────────────
  const sortOptions: { key: SortKey; label: string; icon: string }[] = [
    { key: 'distance', label: t('epiceries.sortDistance') || 'Distance', icon: '📍' },
    { key: 'rating', label: t('epiceries.sortRating') || 'Mieux notées', icon: '⭐' },
    { key: 'products', label: t('epiceries.sortProducts') || 'Plus de choix', icon: '🧺' },
  ];

  const renderSortBar = () => (
    <View style={styles.sortBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortScrollContent}
      >
        <View style={styles.sortLabelWrap}>
          <Ionicons name="swap-vertical" size={14} color="#777" />
          <Text style={styles.sortLabelText}>{t('epiceries.sortBy') || 'Trier'}</Text>
        </View>
        {sortOptions.map((opt) => {
          const active = sortKey === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, active && { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}
              onPress={() => setSortKey(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.sortChipIcon}>{opt.icon}</Text>
              <Text style={[styles.sortChipText, active && { color: '#fff' }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
        {/* Favoris en tête — toggle appliqué par-dessus le tri courant. */}
        <TouchableOpacity
          style={[styles.sortChip, favoritesFirst && { backgroundColor: '#e11d48', borderColor: '#e11d48' }]}
          onPress={() => setFavoritesFirst((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name={favoritesFirst ? 'heart' : 'heart-outline'} size={13} color={favoritesFirst ? '#fff' : '#e11d48'} />
          <Text style={[styles.sortChipText, favoritesFirst && { color: '#fff' }]}>
            {t('epiceries.favoritesFirst') || 'Favoris'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const currentSortLabel = sortOptions.find((o) => o.key === sortKey)?.label || '';

  const renderSkeletons = () => (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Skeleton variant="rect" height={180} style={{ borderRadius: 12, marginBottom: 8 }} />
          <Skeleton variant="text" width="60%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton variant="text" width="40%" height={12} />
        </View>
      ))}
    </View>
  );

  // Header/Empty en éléments mémoïsés (références stables passées à la
  // FlatList, non invoqués à chaque rendu).
  const listHeaderEl = useMemo(() => {
    if (!hasFetched || loading) return null;
    return (
      <View style={styles.resultsHeader}>
        <View style={styles.resultsHeaderLeft}>
          {/* Le compteur est désormais porté par la barre de bascule Liste/Carte. */}
          {currentSortLabel ? (
            <Text style={styles.sortedByText}>
              {(t('epiceries.sortedBy') || 'Trié par : {{name}}').replace('{{name}}', currentSortLabel)}
            </Text>
          ) : null}
        </View>
        {!userLocation && (
          <TouchableOpacity onPress={handleRetryLocation} style={styles.gpsRetry}>
            <Ionicons name="location-outline" size={14} color={theme.colors.brand} />
            <Text style={[styles.gpsRetryText, { color: theme.colors.brand }]}>
              {t('epiceries.detectPosition') || 'Détecter ma position'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFetched, loading, sortedEpiceries.length, userLocation, currentSortLabel, locationLoading]);

  const listEmptyEl = useMemo(() => {
    if (loading) return renderSkeletons();
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔍</Text>
        <Text style={styles.emptyText}>{t('epiceries.noEpiceriesFound')}</Text>
        <Text style={styles.emptySubtext}>
          {activeFiltersCount > 0 || searchText
            ? (t('epiceries.tryOtherFilters') || 'Essayez d\'autres filtres')
            : (t('epiceries.startSearchMessage') || 'Configurez votre recherche')}
        </Text>
        {activeFiltersCount > 0 && (
          <TouchableOpacity
            onPress={() => {
              setOpenOnly(false);
              setTypeFilter(null);
              setRadius(DEFAULT_RADIUS);
              setSearchText('');
              setPromoOnly(false);
              clearCategory();
            }}
            style={[styles.clearFiltersBtn, { backgroundColor: theme.colors.brand }]}
          >
            <Text style={styles.clearFiltersBtnText}>
              {t('epiceries.clearFilters') || 'Effacer les filtres'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeFiltersCount, searchText]);

  return (
    <View style={styles.container}>
      {/* Barre de recherche + bouton filtres */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={theme.colors.brand} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('epiceries.searchPlaceholder')}
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFiltersCount > 0 && { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}
          onPress={() => setShowFiltersSheet(true)}
          activeOpacity={0.8}
          accessibilityLabel={t('epiceries.filters')}
        >
          <Ionicons name="options-outline" size={20} color={activeFiltersCount > 0 ? '#fff' : '#333'} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Chips de filtres rapides (toujours visibles) */}
      <View style={styles.quickFiltersAnchor}>{renderQuickFilters()}</View>

      {/* Barre de tri + favoris en tête */}
      {renderSortBar()}

      {/* Toggle Liste / Carte (Lot 4) — visible dans les deux modes */}
      <View style={styles.viewToggleBar}>
        <View style={styles.resultsHeaderLeft}>
          <Text style={styles.resultsCount}>
            {sortedEpiceries.length} {t('epiceries.epiceriesFound') || 'épiceries trouvées'}
          </Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'list' && { backgroundColor: theme.colors.brand }]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'list' }}
            accessibilityLabel={t('epiceries.viewList') || 'Liste'}
          >
            <Ionicons name="list" size={16} color={viewMode === 'list' ? '#fff' : '#555'} />
            <Text style={[styles.viewToggleText, viewMode === 'list' && { color: '#fff' }]}>
              {t('epiceries.viewList') || 'Liste'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'map' && { backgroundColor: theme.colors.brand }]}
            onPress={() => setViewMode('map')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'map' }}
            accessibilityLabel={t('epiceries.viewMap') || 'Carte'}
          >
            <Ionicons name="map" size={16} color={viewMode === 'map' ? '#fff' : '#555'} />
            <Text style={[styles.viewToggleText, viewMode === 'map' && { color: '#fff' }]}>
              {t('epiceries.viewMap') || 'Carte'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenu : liste ou carte (mêmes données filtrées/triées) */}
      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <EpiceriesMapView
            epiceries={sortedEpiceries}
            userLocation={userLocation}
            onSelectEpicerie={handleSelectEpicerieId}
            promoMap={promoMap}
          />
        </View>
      ) : (
        <FlatList
          data={sortedEpiceries}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderEl}
          ListEmptyComponent={listEmptyEl}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={9}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.brand}
            />
          }
          ListFooterComponent={
            (loadingMore || (loading && hasFetched)) ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.colors.brand} />
              </View>
            ) : null
          }
        />
      )}

      {/* Bottom-sheet filtres */}
      <EpicerieDiscoverFiltersSheet
        visible={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        value={{ radius, openOnly, type: typeFilter }}
        onApply={applyFilters}
        accentColor={theme.colors.brand}
        labels={{
          title: t('epiceries.filters') || 'Filtres',
          radiusTitle: t('epiceries.radiusTitle') || 'Rayon de recherche',
          radiusHint: t('epiceries.radiusHint') || 'Distance maximale depuis votre position',
          openOnlyTitle: t('epiceries.openNow') || 'Ouvert maintenant',
          openOnlyHint: t('epiceries.openOnlyHint') || 'Afficher uniquement les épiceries actuellement ouvertes',
          typeTitle: t('epiceries.typeTitle') || 'Type de boutique',
          allTypes: t('epiceries.allTypes') || 'Tous les types',
          reset: t('epiceries.reset') || 'Réinitialiser',
          apply: t('epiceries.apply') || 'Appliquer',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  // ── Search header ───────────────────────────────────────────────────
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: '#F7F7F8',
    zIndex: 5,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E8F5E9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F1F1F',
    padding: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Chips quick filters ─────────────────────────────────────────────
  quickFiltersAnchor: {
    backgroundColor: '#F7F7F8',
    paddingBottom: 4,
  },
  quickFilters: {
    paddingVertical: 4,
  },
  chipsScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    maxWidth: 130,
  },

  // ── Toggle Liste / Carte (Lot 4) ────────────────────────────────────
  viewToggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: 3,
    gap: 3,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewToggleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#555',
  },
  mapContainer: {
    flex: 1,
  },

  // ── Results ─────────────────────────────────────────────────────────
  listContent: {
    paddingTop: 6,
    paddingBottom: 24,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsHeaderLeft: {
    flexShrink: 1,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  sortedByText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#999',
    marginTop: 2,
  },

  // ── Barre de tri ────────────────────────────────────────────────────
  sortBar: {
    backgroundColor: '#F7F7F8',
    paddingBottom: 4,
  },
  sortScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  sortLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 2,
  },
  sortLabelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#777',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  sortChipIcon: {
    fontSize: 12,
  },
  sortChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#444',
  },
  gpsRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsRetryText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Empty ───────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginBottom: 16,
  },
  clearFiltersBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  clearFiltersBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
