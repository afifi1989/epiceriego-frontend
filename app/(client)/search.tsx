export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EpicerieDiscoverCard } from '../../src/components/client/EpicerieDiscoverCard';
import { Skeleton, useToast } from '../../src/components/feedback';
import { useLanguage } from '../../src/context/LanguageContext';
import { useCurrency } from '../../src/context/CurrencyContext';
import { cartService } from '../../src/services/cartService';
import { epicerieService } from '../../src/services/epicerieService';
import { favoritesService } from '../../src/services/favoritesService';
import { productService } from '../../src/services/productService';
import { promotionService, Promotion } from '../../src/services/promotionService';
import {
  activePromosForEpicerie,
  bestPromoForProduct,
  effectivePriceForProduct,
} from '../../src/features/promotions/utils';
import { Theme, useTheme } from '../../src/theme';
import { CartItem, Epicerie, Product } from '../../src/type';

type SearchTab = 'products' | 'epiceries';

/** Délai anti-rebond avant de lancer une recherche (ms). */
const DEBOUNCE_MS = 350;
/** Longueur minimale du terme avant d'interroger le backend. */
const MIN_QUERY_LENGTH = 2;

/**
 * Écran de recherche mixte (produits + épiceries).
 *
 * <p>Branché sur la barre de recherche de la home. Deux onglets :
 *  - « Produits » : recherche GLOBALE multi-épiceries via
 *    {@link productService.searchProducts} → chaque résultat affiche photo,
 *    prix, boutique et un bouton « + » pour l'ajout direct au panier. Le tap
 *    sur la carte ouvre la fiche produit ; le tap sur le nom de la boutique
 *    ouvre l'épicerie.
 *  - « Épiceries » : recherche par nom via {@link epicerieService.searchByName}
 *    et réutilise {@link EpicerieDiscoverCard} pour un rendu cohérent avec
 *    l'onglet Épiceries existant.</p>
 *
 * <p>La recherche est anti-rebond (350 ms) et ne part qu'à partir de 2
 * caractères — on évite de marteler le backend à chaque frappe.</p>
 */
export default function SearchScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { format } = useCurrency();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const toast = useToast();
  const params = useLocalSearchParams<{ q?: string }>();

  // Helper i18n tolérant : t() renvoie la clé brute si absente — on bascule
  // alors sur le fallback français passé en 2e argument.
  const tr = useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v === key ? fallback : v;
    },
    [t],
  );

  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [epiceries, setEpiceries] = useState<Epicerie[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  // Promotions actives multi-épiceries. La recherche couvre plusieurs boutiques,
  // donc on charge le pool global une fois et on le filtre par épicerie du produit
  // au moment de l'ajout (bestPromoForProduct) — cf. handleQuickAdd (H8).
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);

  // ── Anti-rebond du terme de recherche ───────────────────────────────────
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // ── Position (best-effort, pour afficher la distance des épiceries) ──────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setUserLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        }
      } catch {
        // Distance optionnelle — on ignore silencieusement.
      }
    })();
    loadFavoriteIds();
    // Pool de promotions actives (toutes épiceries) pour appliquer le prix promo
    // effectif à l'ajout rapide, comme la fiche épicerie. Échec silencieux → on
    // retombe sur le prix brut / prixBarre.
    promotionService.getAllActivePromotions()
      .then(setActivePromos)
      .catch(() => setActivePromos([]));
  }, []);

  const loadFavoriteIds = async () => {
    try {
      setFavoriteIds(await favoritesService.getFavoriteIds());
    } catch (error) {
      console.error('[SearchScreen] favoris load failed', error);
    }
  };

  // ── Recherche (relancée sur changement de terme OU d'onglet) ─────────────
  // Garde-fou contre les réponses hors-séquence : seule la dernière requête
  // émise a le droit d'écrire dans le state.
  const requestSeq = useRef(0);
  // Cache mémoire par onglet, clé = terme de recherche. Évite un refetch réseau
  // à chaque bascule d'onglet quand le terme n'a pas changé (ex: aller-retour
  // Produits ⇄ Épiceries). Durée de vie = session écran (Map non persistée).
  const productCache = useRef<Map<string, Product[]>>(new Map());
  const epicerieCache = useRef<Map<string, Epicerie[]>>(new Map());

  useEffect(() => {
    const term = debounced;
    if (term.length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setEpiceries([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setHasSearched(true);

    // Cache hit → on affiche instantanément sans requête réseau ni skeleton.
    if (activeTab === 'products') {
      const cached = productCache.current.get(term);
      if (cached) {
        setProducts(cached);
        setLoading(false);
        return;
      }
    } else {
      const cached = epicerieCache.current.get(term);
      if (cached) {
        setEpiceries(cached);
        setLoading(false);
        return;
      }
    }

    const seq = ++requestSeq.current;
    setLoading(true);

    (async () => {
      try {
        if (activeTab === 'products') {
          const data = await productService.searchProducts(term);
          if (seq === requestSeq.current) {
            productCache.current.set(term, data);
            setProducts(data);
          }
        } else {
          const data = await epicerieService.searchByName(term) || [];
          if (seq === requestSeq.current) {
            epicerieCache.current.set(term, data);
            setEpiceries(data);
          }
        }
      } catch (error) {
        if (seq === requestSeq.current) {
          console.log('[SearchScreen] search error:', error);
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    })();
  }, [debounced, activeTab]);

  // ── Actions produit ──────────────────────────────────────────────────────

  const openProduct = (product: Product) => {
    router.push({
      pathname: '/(client)/(epicerie)/product/[productId]',
      params: { productId: product.id.toString(), epicerieId: product.epicerieId.toString() },
    });
  };

  const openStore = (epicerieId: number) => {
    router.push(`/(client)/(epicerie)/${epicerieId}`);
  };

  /**
   * Ajout rapide au panier depuis un résultat de recherche.
   *
   * <p>Produit SANS variante → ajout direct au prix promo EFFECTIF (H8).
   * Produit AVEC variantes → on ne peut pas deviner l'unité/le prix, donc on
   * ouvre la fiche produit où vit le sélecteur d'unité (évite un mauvais prix
   * au panier).</p>
   */
  const handleQuickAdd = async (product: Product) => {
    if (product.units && product.units.length > 0) {
      openProduct(product);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAddingId(product.id);
    try {
      // Prix promo effectif, aligné sur la fiche épicerie ([id].tsx). On filtre
      // le pool de promos par l'épicerie DU produit (la recherche est
      // multi-boutiques), on élit la meilleure promo qui le touche, puis
      // effectivePriceForProduct applique — avec repli automatique sur
      // `prixBarre` si présent, même sans promo chargée.
      const promo = bestPromoForProduct(
        activePromosForEpicerie(activePromos, product.epicerieId),
        product,
      );
      const eff = effectivePriceForProduct(product, promo);
      const effectivePrice = eff.display;
      const cartItem: CartItem = {
        itemType: 'PRODUCT',
        productId: product.id,
        productNom: product.nom,
        epicerieId: product.epicerieId,
        quantity: 1,
        unitId: undefined,
        unitLabel: tr('products.piece', 'À l\'unité'),
        pricePerUnit: effectivePrice,
        totalPrice: effectivePrice,
        // Fige si ajouté à un prix remisé par une promotion produit → alimente
        // cartHasPromoItems pour la preview du code promo (non cumulable).
        onPromo: eff.hasDiscount,
        photoUrl: product.photoUrl,
      };
      await cartService.addToCart(cartItem);
      toast.success(tr('products.addedToCart', 'Ajouté au panier'), product.nom);
    } catch (error) {
      console.error('[SearchScreen] addToCart failed', error);
      toast.error(t('common.error'), tr('products.errorAdding', 'Impossible d\'ajouter au panier'));
    } finally {
      setAddingId(null);
    }
  };

  // ── Favoris (onglet Épiceries) ───────────────────────────────────────────
  const handleToggleFavorite = async (epicerieId: number, isCurrentlyFavorite: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const snapshot = favoriteIds;
    setFavoriteIds(
      isCurrentlyFavorite ? favoriteIds.filter((id) => id !== epicerieId) : [...favoriteIds, epicerieId],
    );
    try {
      const ok = await favoritesService.toggleFavorite(epicerieId, isCurrentlyFavorite);
      if (!ok) throw new Error('toggleFavorite returned false');
    } catch (error) {
      console.error('[SearchScreen] toggleFavorite failed', error);
      setFavoriteIds(snapshot);
      toast.error(t('common.error'), tr('epiceries.favoritesError', 'Erreur favoris'));
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────

  const renderProductRow = ({ item }: { item: Product }) => {
    const hasVariants = !!(item.units && item.units.length > 0);
    return (
      <TouchableOpacity
        style={styles.productRow}
        onPress={() => openProduct(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${item.nom}, ${item.epicerieNom}, ${item.prix ? format(item.prix) : ''}`}
      >
        {item.photoUrl ? (
          <ExpoImage source={{ uri: item.photoUrl }} style={styles.productThumb} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.productThumb, styles.thumbPlaceholder]}>
            <Text style={styles.placeholderEmoji}>📦</Text>
          </View>
        )}

        <View style={styles.productMeta}>
          <Text style={styles.productName} numberOfLines={2}>{item.nom}</Text>
          <TouchableOpacity
            onPress={() => openStore(item.epicerieId)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel={item.epicerieNom}
          >
            <View style={styles.storeLine}>
              <Ionicons name="storefront-outline" size={12} color={theme.colors.brand} />
              <Text style={styles.storeName} numberOfLines={1}>{item.epicerieNom}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.productPrice}>
            {item.prix ? format(item.prix) : tr('products.priceNA', 'Prix N/A')}
            {hasVariants && (
              <Text style={styles.fromLabel}>  {tr('client.search.fromVariants', '· plusieurs formats')}</Text>
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => handleQuickAdd(item)}
          disabled={addingId === item.id}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tr('products.addToCart', 'Ajouter au panier')}
        >
          {addingId === item.id ? (
            <ActivityIndicator size="small" color={theme.colors.onBrand} />
          ) : (
            <Ionicons name={hasVariants ? 'options-outline' : 'add'} size={22} color={theme.colors.onBrand} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSkeletons = () => (
    <View style={{ paddingTop: 8 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton variant="rect" width={64} height={64} style={{ borderRadius: 12 }} />
          <View style={{ flex: 1, marginStart: 12 }}>
            <Skeleton variant="text" width="70%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="40%" height={12} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (loading) return renderSkeletons();
    if (debounced.length < MIN_QUERY_LENGTH) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyText}>{tr('client.search.startTitle', 'Que cherchez-vous ?')}</Text>
          <Text style={styles.emptySubtext}>
            {tr('client.search.startHint', 'Tapez le nom d\'un produit ou d\'une épicerie.')}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🤔</Text>
        <Text style={styles.emptyText}>{tr('client.search.noResults', 'Aucun résultat')}</Text>
        <Text style={styles.emptySubtext}>
          {activeTab === 'products'
            ? tr('client.search.noProductHint', 'Essayez un autre mot ou cherchez une épicerie.')
            : tr('client.search.noStoreHint', 'Essayez un autre nom de boutique.')}
        </Text>
      </View>
    );
  };

  const resultCount = activeTab === 'products' ? products.length : epiceries.length;

  return (
    <View style={styles.container}>
      {/* Barre de recherche */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={tr('client.search.placeholder', 'Rechercher produits, épiceries...')}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus={!initialQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Onglets Produits / Épiceries */}
      <View style={styles.tabs}>
        {(['products', 'epiceries'] as SearchTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'products'
            ? tr('client.search.tabProducts', 'Produits')
            : tr('client.search.tabStores', 'Épiceries');
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab === 'products' ? 'pricetag-outline' : 'storefront-outline'}
                size={16}
                color={isActive ? theme.colors.brand : theme.colors.textMuted}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Compteur de résultats */}
      {hasSearched && !loading && resultCount > 0 && (
        <Text style={styles.resultsCount}>
          {resultCount}{' '}
          {activeTab === 'products'
            ? tr('client.search.productsFound', 'produit(s) trouvé(s)')
            : tr('client.search.storesFound', 'épicerie(s) trouvée(s)')}
        </Text>
      )}

      {/* Liste */}
      {activeTab === 'products' ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProductRow}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty()}
        />
      ) : (
        <FlatList
          data={epiceries}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty()}
          renderItem={({ item }) => (
            <EpicerieDiscoverCard
              epicerie={item}
              isFavorite={favoriteIds.includes(item.id)}
              onPress={(e) => openStore(e.id)}
              onToggleFavorite={handleToggleFavorite}
              userLocation={userLocation}
            />
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: {
    backgroundColor: theme.colors.brandSubtle,
    borderColor: theme.colors.brand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.brand,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  // ── Product row ───────────────────────────────────────────────────────────
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 28,
  },
  productMeta: {
    flex: 1,
    minWidth: 0,
    marginStart: theme.spacing.md,
    marginEnd: theme.spacing.sm,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  storeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.brand,
    flexShrink: 1,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  fromLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Skeleton ──────────────────────────────────────────────────────────────
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
