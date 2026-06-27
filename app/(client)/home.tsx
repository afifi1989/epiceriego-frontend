export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EpicerieStories } from '../../src/components/client/EpicerieStories';
import { FlashDealsSection } from '../../src/components/client/FlashDealsSection';
import { HomeCategories } from '../../src/components/client/HomeCategories';
import { HomeHeader } from '../../src/components/client/HomeHeader';
import { BundleOfferCarousel } from '../../src/components/client/BundleOfferCarousel';
import { OngoingOrderCard } from '../../src/components/client/OngoingOrderCard';
import { Skeleton, useToast } from '../../src/components/feedback';
import { CategorySuggestion } from '../../src/services/categoryService';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService } from '../../src/services/orderService';
import { productService } from '../../src/services/productService';
import { Promotion, promotionService } from '../../src/services/promotionService';
import { reorderService } from '../../src/services/reorderService';
import { useTheme, Theme } from '../../src/theme';
import { Epicerie, Order, Product } from '../../src/type';

/** Statuts de commande "rejouables" — voir reorderService. */
const REORDER_ALLOWED_STATUSES = new Set(['DELIVERED', 'CANCELLED']);
/** Au-delà, on ne propose plus la dernière commande sur la home (info périmée). */
const REORDER_HOME_MAX_AGE_DAYS = 60;

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 50) / 2;
const EPICERIE_CARD_WIDTH = width * 0.45;

export default function HomeScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const toast = useToast();
  const [searchText, setSearchText] = useState('');
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [popularEpiceries, setPopularEpiceries] = useState<Epicerie[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [reordering, setReordering] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // (userLocation supprimé — il n'alimentait que la section cards épiceries,
  //  retirée par l'audit UX sprint 4 ; la géoloc reste utilisée ci-dessous
  //  pour les promotions de proximité.)

  useEffect(() => {
    loadHomeData();
  }, [language]);

  /**
   * Charge les 4 sections en parallèle (avant: séquentiellement → temps total
   * = somme des appels). Promise.allSettled : un endpoint cassé n'empêche pas
   * les autres sections de s'afficher. La home reste utile même si la moitié
   * des services backend sont indisponibles.
   */
  const loadHomeData = async () => {
    try {
      const trendingPromise = productService.getTrendingProducts(6)
        .then(p => p || [])
        .catch(() => [] as Product[]);

      const popularPromise = epicerieService.getPopularEpiceries(8)
        .then(p => p || [])
        .catch(() => [] as Epicerie[]);

      const recentPromise = productService.getRecentlyViewedProducts(4)
        .then(p => p || [])
        .catch(() => [] as Product[]);

      const lastOrderPromise = orderService.getMyOrders()
        .then(orders => pickReorderableOrder(orders || []))
        .catch(() => null);

      const promotionsPromise = (async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          return (await promotionService.getNearbyPromotions(
            location.coords.latitude, location.coords.longitude, 5
          )) || [];
        } catch {
          try {
            return (await promotionService.getFavoriteEpiceriesPromotions()) || [];
          } catch {
            return [] as Promotion[];
          }
        }
      })();

      const [trending, popular, recent, promos, last] = await Promise.all([
        trendingPromise, popularPromise, recentPromise, promotionsPromise, lastOrderPromise,
      ]);

      setTrendingProducts(trending);
      setPopularEpiceries(popular);
      setRecentlyViewed(recent);
      setPromotions(promos);
      setLastOrder(last);
    } catch (error) {
      console.error('Error loading home data:', error);
      toast.error(t('common.error'), 'Impossible de charger les données');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  /**
   * Sélectionne la commande la plus récente rejouable parmi celles renvoyées
   * par l'API. Critères:
   * - status DELIVERED ou CANCELLED (action terminée)
   * - moins de 60 jours (au-delà l'info perd sa pertinence sur la home)
   * - au moins 1 item (sinon rien à recommander)
   */
  const pickReorderableOrder = (orders: Order[]): Order | null => {
    const cutoff = Date.now() - REORDER_HOME_MAX_AGE_DAYS * 24 * 3600 * 1000;
    const candidates = orders
      .filter(o =>
        REORDER_ALLOWED_STATUSES.has(o.status)
        && o.items?.length > 0
        && new Date(o.createdAt).getTime() >= cutoff
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return candidates[0] ?? null;
  };

  const handleQuickReorder = async () => {
    if (!lastOrder || reordering) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setReordering(true);
    try {
      const result = await reorderService.reorderFromOrder(lastOrder);
      if (result.added === 0) {
        toast.warning(
          t('common.error'),
          t('orders.reorderEmpty') || 'Aucun article disponible'
        );
        return;
      }
      const detail = result.skipped > 0
        ? `${result.added} article(s) • ${result.skipped} indispo`
        : `${result.added} article(s)`;
      toast.success(t('orders.reorderSuccess') || 'Panier rempli', detail);
      router.push('/(client)/cart');
    } catch (error) {
      console.error('[home] quick reorder failed:', error);
      toast.error(t('common.error'), String(error));
    } finally {
      setReordering(false);
    }
  };

  const formatRelativeDate = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (24 * 3600 * 1000));
    if (days <= 0) return t('common.today');
    if (days === 1) return t('common.yesterday');
    // Concat tolerante aux prefixes vides (ex. en anglais : "3 days ago" sans prefixe).
    const join = (...parts: (string | number)[]) =>
      parts.map(p => String(p)).filter(p => p.length > 0).join(' ');
    if (days < 7) return join(t('common.daysAgoPrefix'), days, t('common.days'));
    if (days < 30) {
      const w = Math.floor(days / 7);
      return join(t('common.weeksAgoPrefix'), w, w === 1 ? t('common.week') : t('common.weeks'));
    }
    const m = Math.floor(days / 30);
    return join(t('common.monthsAgoPrefix'), m, m === 1 ? t('common.month') : t('common.months'));
  };

  const handleSearch = () => {
    if (searchText.trim()) {
      router.push({
        pathname: '/(client)/epiceries',
        params: { search: searchText },
      });
    }
  };

  const handleCategoryTap = (category: CategorySuggestion) => {
    router.push({
      pathname: '/(client)/epiceries',
      params: { categoryId: category.id.toString(), category: category.name },
    });
  };

  const handleSeeMoreCategories = () => {
    router.push('/(client)/epiceries');
  };

  const handleProductTap = (product: Product) => {
    router.push({
      pathname: '/(client)/(epicerie)/[id]',
      params: { id: product.epicerieId.toString() },
    });
  };

  const handleEpicerieTap = (epicerie: Epicerie) => {
    router.push({
      pathname: '/(client)/(epicerie)/[id]',
      params: { id: epicerie.id.toString() },
    });
  };

  /**
   * Section "Pour vous" — fusion des anciennes sections « Tendances » et
   * « Vus récemment » (audit UX sprint 4 : la home empilait 12+ sections).
   * Le signal personnel (vus récemment) passe en premier, complété par les
   * tendances globales, dédupliqué par id, plafonné à 6 produits.
   */
  const forYouProducts = useMemo(() => {
    const seen = new Set<number>();
    const merged: Product[] = [];
    for (const product of [...recentlyViewed, ...trendingProducts]) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product);
      if (merged.length >= 6) break;
    }
    return merged;
  }, [recentlyViewed, trendingProducts]);

  /**
   * Carte "Reprendre votre commande" — différenciateur 2026: 1 tap = panier
   * rempli avec la commande précédente. Affichée uniquement si on a une
   * commande rejouable récente.
   */
  const renderQuickReorder = () => {
    if (!lastOrder) return null;
    return (
      <TouchableOpacity
        style={styles.reorderCard}
        onPress={handleQuickReorder}
        disabled={reordering}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Recommander chez ${lastOrder.epicerieNom}`}
      >
        <View style={styles.reorderIconBox}>
          <Ionicons name="repeat" size={22} color={theme.colors.onBrand} />
        </View>
        <View style={styles.reorderContent}>
          <Text style={styles.reorderTitle} numberOfLines={1}>
            {t('client.home.reorderTitle') || 'Reprendre votre commande'}
          </Text>
          <Text style={styles.reorderSubtitle} numberOfLines={1}>
            {lastOrder.epicerieNom} • {formatRelativeDate(lastOrder.createdAt)}
          </Text>
          <Text style={styles.reorderMeta} numberOfLines={1}>
            {lastOrder.nombreItems} {lastOrder.nombreItems > 1 ? (t('orders.items') || 'articles') : (t('orders.item') || 'article')}
          </Text>
        </View>
        <View style={styles.reorderCta}>
          <Text style={styles.reorderCtaText}>
            {reordering ? '…' : '→'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // renderPromoBanner supprimé (audit UX sprint 4) : il consommait la MÊME
  // liste `promotions` que FlashDealsSection — deux affichages des mêmes
  // promos sur la même page. FlashDeals (compte à rebours) est conservée.

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputWrapper}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('client.home.searchPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // renderPopularEpiceries supprimé (audit UX sprint 4) : la section cards
  // affichait LES MÊMES épiceries que les Stories en haut de page. Le détail
  // riche (distance, note, filtres) vit dans l'onglet Épiceries.

  /** "Pour vous" — remplace « Tendances » + « Vus récemment » (cf. forYouProducts). */
  const renderForYou = () => (
    forYouProducts.length > 0 && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('client.home.forYou')}</Text>
          <TouchableOpacity
            onPress={() => router.push('/(client)/epiceries')}
            accessibilityRole="link"
            accessibilityLabel={`${t('client.home.seeAll')} — ${t('client.home.forYou')}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.seeAllLink}>{t('client.home.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productsGrid}>
          {forYouProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() => handleProductTap(product)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${product.nom}${product.epicerieNom ? `, ${product.epicerieNom}` : ''}${product.prix ? `, ${product.prix.toFixed(2)} DH` : ''}`}
            >
              {product.photoUrl ? (
                <ExpoImage
                  source={{ uri: product.photoUrl }}
                  style={styles.productImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.productImage, styles.productImagePlaceholder]}>
                  <Text style={styles.placeholderEmoji}>📦</Text>
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.nom}
                </Text>
                <Text style={styles.productStore} numberOfLines={1}>
                  {product.epicerieNom}
                </Text>
                <Text style={styles.productPrice}>
                  {product.prix ? `${product.prix.toFixed(2)} DH` : 'N/A'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  );

  if (initialLoading) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <HomeHeader />
        {renderSearchBar()}
        <Skeleton variant="rect" height={90} style={{ marginHorizontal: 15, marginVertical: 15, borderRadius: 15 }} />
        <View style={styles.section}>
          <Skeleton variant="text" width="40%" height={18} style={{ marginBottom: 12, marginStart: 15 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingStart: 15 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ width: 84, alignItems: 'center', marginEnd: 12 }}>
                <Skeleton variant="circle" width={64} height={64} style={{ marginBottom: 8 }} />
                <Skeleton variant="text" width={60} height={10} />
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={styles.section}>
          <Skeleton variant="text" width="50%" height={18} style={{ marginBottom: 12, marginStart: 15 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingStart: 15 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.epicerieCard}>
                <Skeleton variant="rect" height={100} style={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }} />
                <View style={styles.epicerieInfo}>
                  <Skeleton variant="text" width="80%" style={{ marginBottom: 6 }} />
                  <Skeleton variant="text" width="60%" />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={styles.spacer} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.brand}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader />
      <OngoingOrderCard />
      {renderSearchBar()}
      <EpicerieStories
        epiceries={popularEpiceries}
        onPress={handleEpicerieTap}
      />
      <FlashDealsSection
        promotions={promotions}
        onPress={(p) => router.push({
          pathname: '/(client)/(epicerie)/[id]',
          params: { id: p.epicerieId.toString() },
        })}
      />
      {/* Bundles featured cross-epicerie. Auto-masque si aucun epicier n'a
          encore flag un bundle comme featured. */}
      <BundleOfferCarousel mode="featured" limit={8} accent={theme.colors.brand} />
      {renderQuickReorder()}
      <HomeCategories
        onPress={handleCategoryTap}
        onSeeMore={handleSeeMoreCategories}
      />
      {renderForYou()}

      {forYouProducts.length === 0 &&
        popularEpiceries.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🏪</Text>
            <Text style={styles.emptyStateText}>
              {t('client.home.startShopping')}
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push('/(client)/epiceries')}
            >
              <Text style={styles.emptyStateButtonText}>
                {t('client.home.discoverStores')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  reorderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.brand,
    ...theme.shadows.sm,
  },
  reorderIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderContent: {
    flex: 1,
    minWidth: 0,
  },
  reorderTitle: {
    ...theme.typography.titleSm,
    color: theme.colors.textPrimary,
  },
  reorderSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  reorderMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  reorderCta: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderCtaText: {
    color: theme.colors.brand,
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  searchIcon: {
    marginEnd: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    padding: 4,
    marginStart: theme.spacing.xs,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.titleMd,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  seeAllLink: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  epicerieCard: {
    width: EPICERIE_CARD_WIDTH,
    marginEnd: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  epicerieImage: {
    width: '100%',
    height: 110,
    backgroundColor: theme.colors.surfaceMuted,
  },
  epicerieImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  epicerieInfo: {
    padding: theme.spacing.md,
  },
  epicerieName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  epicerieAddress: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  epicerieStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  statusOpen: {
    backgroundColor: theme.colors.successSubtle,
  },
  statusClosed: {
    backgroundColor: theme.colors.dangerSubtle,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeTextOpen: {
    color: theme.colors.success,
  },
  statusBadgeTextClosed: {
    color: theme.colors.danger,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  productImage: {
    width: '100%',
    height: 140,
    backgroundColor: theme.colors.surfaceMuted,
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: theme.spacing.sm,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  productStore: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.brand,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 60,
    marginBottom: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    fontWeight: '500',
  },
  emptyStateButton: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  emptyStateButtonText: {
    color: theme.colors.onBrand,
    fontSize: 14,
    fontWeight: '700',
  },
  spacer: {
    height: theme.spacing.xl,
  },
});
