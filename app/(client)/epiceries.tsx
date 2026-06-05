import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { Skeleton, useToast } from '../../src/components/feedback';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { favoritesService } from '../../src/services/favoritesService';
import { useTheme } from '../../src/theme';
import { EPICERIE_TYPES, Epicerie, EpicerieType } from '../../src/type';

const DEFAULT_RADIUS = 5;

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
  const params = useLocalSearchParams<{ search?: string }>();

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
  const [openOnly, setOpenOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EpicerieType | null>(null);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // ── État de visibilité de la barre de recherche ─────────────────────
  // L'utilisateur peut masquer la barre via un bouton dédié pour gagner
  // en espace vertical (la pill ⚙ filtres reste accessible via les chips).
  const [searchBarVisible, setSearchBarVisible] = useState(true);

  // ── Effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    initializeAutoSearch();
    loadFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quand on obtient la position OU que le rayon change → on refait l'appel API
  useEffect(() => {
    if (userLocation) {
      fetchEpiceries(userLocation, radius);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, radius]);

  const initializeAutoSearch = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        await detectLocation();
      } else {
        const result = await Location.requestForegroundPermissionsAsync();
        if (result.status === 'granted') {
          await detectLocation();
        } else {
          // Sans GPS → on charge sans tri par proximité (searchByName vide)
          await fetchEpiceriesNoLocation();
        }
      }
    } catch (e) {
      console.error('[EpiceriesScreen] init failed', e);
      await fetchEpiceriesNoLocation();
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
      await fetchEpiceriesNoLocation();
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchEpiceries = async (loc: { latitude: number; longitude: number }, r: number) => {
    if (loading) return;
    try {
      setLoading(true);
      const data = await epicerieService.searchByProximity(loc.latitude, loc.longitude, r);
      setAllEpiceries(data || []);
      setHasFetched(true);
    } catch (error) {
      toast.error(t('common.error'), String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchEpiceriesNoLocation = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const data = await epicerieService.searchByName('');
      setAllEpiceries(data || []);
      setHasFetched(true);
    } catch (error) {
      console.error('[EpiceriesScreen] fallback fetch failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      userLocation ? fetchEpiceries(userLocation, radius) : fetchEpiceriesNoLocation(),
      loadFavoriteIds(),
    ]);
  };

  // ── Filtrage côté client ─────────────────────────────────────────────
  const filteredEpiceries = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return allEpiceries
      .filter((e) => (openOnly ? e.isOpen === true : true))
      .filter((e) => (typeFilter ? e.epicerieType === typeFilter : true))
      .filter((e) => {
        if (!q) return true;
        return (
          e.nomEpicerie?.toLowerCase().includes(q) ||
          e.adresse?.toLowerCase().includes(q) ||
          e.epicerieTypeLabel?.toLowerCase().includes(q)
        );
      });
  }, [allEpiceries, searchText, openOnly, typeFilter]);

  const activeFiltersCount = (openOnly ? 1 : 0) + (typeFilter ? 1 : 0) + (radius !== DEFAULT_RADIUS ? 1 : 0);

  // ── Toggle favori (optimiste) ────────────────────────────────────────
  const handleToggleFavorite = async (epicerieId: number, isCurrentlyFavorite: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const snapshot = favoriteIds;
    const optimistic = isCurrentlyFavorite
      ? favoriteIds.filter((id) => id !== epicerieId)
      : [...favoriteIds, epicerieId];
    setFavoriteIds(optimistic);
    try {
      const success = await favoritesService.toggleFavorite(epicerieId, isCurrentlyFavorite);
      if (!success) throw new Error('toggleFavorite returned false');
    } catch (error) {
      console.error('[EpiceriesScreen] toggleFavorite failed', error);
      setFavoriteIds(snapshot);
      toast.error(t('common.error'), t('epiceries.favoritesError'));
    }
  };

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

  const renderHeader = () => (
    <View>
      {/* Compteur résultats */}
      {hasFetched && !loading && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredEpiceries.length} {t('epiceries.epiceriesFound') || 'épiceries trouvées'}
          </Text>
          {!userLocation && (
            <TouchableOpacity onPress={handleRetryLocation} style={styles.gpsRetry}>
              <Ionicons name="location-outline" size={14} color={theme.colors.brand} />
              <Text style={[styles.gpsRetryText, { color: theme.colors.brand }]}>
                {t('epiceries.detectPosition') || 'Détecter ma position'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderEmpty = () => {
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
  };

  return (
    <View style={styles.container}>
      {/* Barre de recherche — peut être masquée par l'utilisateur */}
      {searchBarVisible ? (
        <View style={styles.searchHeader}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color="#999" />
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
          <TouchableOpacity
            style={styles.hideSearchBtn}
            onPress={() => setSearchBarVisible(false)}
            hitSlop={6}
            accessibilityLabel="Masquer la recherche"
          >
            <Ionicons name="chevron-up" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.searchCollapsedBar}
          onPress={() => setSearchBarVisible(true)}
          activeOpacity={0.8}
          accessibilityLabel="Afficher la recherche"
        >
          <Ionicons name="search" size={16} color="#666" />
          <Text style={styles.searchCollapsedText} numberOfLines={1}>
            {searchText.trim() ? `"${searchText}"` : t('epiceries.searchPlaceholder')}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#999" />
        </TouchableOpacity>
      )}

      {/* Chips de filtres rapides (toujours visibles) */}
      <View style={styles.quickFiltersAnchor}>{renderQuickFilters()}</View>

      {/* Liste */}
      <FlatList
        data={filteredEpiceries}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmpty()}
        renderItem={({ item }) => (
          <EpicerieDiscoverCard
            epicerie={item}
            isFavorite={favoriteIds.includes(item.id)}
            onPress={(e) => router.push(`/(client)/(epicerie)/${e.id}`)}
            onToggleFavorite={handleToggleFavorite}
            userLocation={userLocation}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand}
          />
        }
        ListFooterComponent={
          loading && hasFetched ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={theme.colors.brand} />
            </View>
          ) : null
        }
      />

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
    borderWidth: 1,
    borderColor: '#EAEAEA',
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
  hideSearchBtn: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCollapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  searchCollapsedText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
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
  resultsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
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
