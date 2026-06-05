import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Skeleton, useToast } from "../../../src/components/feedback";
import { searchHistoryService } from "../../../src/services/searchHistoryService";
import { clientPreferencesService, ClientPreference } from "../../../src/services/clientPreferencesService";

const SCREEN_WIDTH = Dimensions.get("window").width;
import { ProductUnitDisplay } from "../../../components/client/ProductUnitDisplay";
import { ProductImageModal } from "../../../src/components/client/ProductImageModal";
import { FallbackImage } from "../../../components/client/FallbackImage";
import { ChatbotModal } from "../../../src/components/client/ChatbotModal";
import { BrandChip } from "../../../src/components/client/BrandChip";
import { StickyMiniCart } from "../../../src/components/client/StickyMiniCart";
import { InlineQuantitySelector } from "../../../src/components/client/InlineQuantitySelector";
import { EpicerieTabs, EpicerieTab } from "../../../src/components/client/EpicerieTabs";
import { ProductSectionsView } from "../../../src/components/client/ProductSectionsView";
import { EpicerieMetaPills, MetaPill } from "../../../src/components/client/EpicerieMetaPills";
import { ExpandableText } from "../../../src/components/client/ExpandableText";
import { EpicerieHero } from "../../../src/components/client/EpicerieHero";
import { EpicerieIdentityBar } from "../../../src/components/client/EpicerieIdentityBar";
import { BundleOfferCarousel } from "../../../src/components/client/BundleOfferCarousel";
import { EpicerieSearchReveal } from "../../../src/components/client/EpicerieSearchReveal";
import { EpicerieFiltersSheet } from "../../../src/components/client/EpicerieFiltersSheet";
import { useLanguage } from "../../../src/context/LanguageContext";
import { cartService, groupCartByEpicerie } from "../../../src/services/cartService";
import {
  Category,
  categoryService,
} from "../../../src/services/categoryService";
import { epicerieService } from "../../../src/services/epicerieService";
import { productService, ProductPage } from "../../../src/services/productService";
import { authService } from "../../../src/services/authService";
import { ParsedProduct } from "../../../src/services/chatbotService";
import { useEpicerieClientStatus } from "../../../src/hooks/useEpicerieClientStatus";
import { CartItem, Epicerie, Product, ProductUnit, Tag } from "../../../src/type";
import { tagService } from "../../../src/services/tagService";
import { formatPrice } from "../../../src/utils/helpers";
import { useCurrency } from "../../../src/context/CurrencyContext";
import { loyaltyService, LoyaltyBalance } from "../../../src/services/loyaltyService";
import { ratingService, Rating, RatingStats } from "../../../src/services/ratingService";
import { promotionService, Promotion } from "../../../src/services/promotionService";
import { PromoProductBadge } from "../../../src/features/promotions/components";
import {
  activePromosForEpicerie,
  bestPromoForCategory,
  bestPromoForProduct,
  effectivePriceForProduct,
  effectivePriceForUnit,
} from "../../../src/features/promotions/utils";
import { EpicerieThemeProvider } from "../../../src/theme/epicerieBranding";
import { deriveBranding } from "../../../src/theme/epicerieBranding/deriveBranding";

// ─── Helpers stock ──────────────────────────────────────────────────────────
// Source de vérité du stock : un produit moderne (≥ 1 variante) maintient son
// stock dans ProductUnit.stock, pas dans le champ legacy Product.stock. Le
// backend expose `totalStock` (somme des variantes) et `inStock` (boolean)
// précalculés ; on les utilise en priorité et on retombe sur le legacy
// seulement quand le DTO n'a pas ces champs (très anciens backends).
const hasStock = (p: Pick<Product, "inStock" | "stock">): boolean =>
  p.inStock ?? (p.stock != null && p.stock > 0);

const effectiveStock = (p: Pick<Product, "totalStock" | "stock">): number =>
  p.totalStock ?? p.stock ?? 0;

export default function EpicerieDetailScreen() {
  const { id, brandId: brandIdParam } = useLocalSearchParams<{ id: string; brandId?: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { setCurrency } = useCurrency();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  // Note: `branding` est calculé plus bas via useMemo dès qu'epicerie est défini.
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  /** Bottom-sheet "Filtres" unifié (catégories + tags + marque). Remplace
   *  l'ancien modal catégories + la barre tags chips. */
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  /** Barre de recherche révélée en slide-down sous les tabs. Au repos, la
   *  loupe vit dans le hero et dans le mini-header sticky. */
  const [searchVisible, setSearchVisible] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Bascule à false après le 1er loadProducts. Sert à montrer le skeleton
   *  uniquement au tout 1er chargement. Les refetch suivants (filtre, recherche)
   *  laissent la liste actuelle visible pour éviter un flash. */
  const [initialLoading, setInitialLoading] = useState(true);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);

  // ── Branding (V101) ──────────────────────────────────────────────
  // Calculé une fois quand epicerie change. Memoization sur l'identité de
  // l'épicerie + ses champs branding → pas de recalcul ni re-render parasite.
  // `branding` est null si epicerie pas chargée OU si elle est sur le thème
  // par défaut → tous les sites consommateurs fallback aux couleurs AbridGO.
  const branding = useMemo(
    () => deriveBranding(epicerie),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      epicerie?.id,
      epicerie?.themePreset,
      epicerie?.primaryColor,
      epicerie?.primarySubtle,
      epicerie?.accentColor,
      epicerie?.onPrimaryColor,
      epicerie?.brandStatement,
      epicerie?.photoUrl,
      epicerie?.presentationPhotoUrl,
    ],
  );
  /** Palette dérivée avec fallback AbridGO. Utilisée en inline style override
   *  sur tous les composants visibles (boutons, prix, FAB, filtres, spinners).
   *  Identique aux tokens du thème app si pas de branding → zéro régression. */
  const brand = useMemo(() => ({
    primary:       branding?.primary       ?? '#4CAF50',
    primarySubtle: branding?.primarySubtle ?? '#E8F5E9',
    accent:        branding?.accent        ?? '#FFA726',
    onPrimary:     branding?.onPrimary     ?? '#FFFFFF',
  }), [branding]);

  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [selectedProductForCart, setSelectedProductForCart] = useState<Product | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageProduct, setSelectedImageProduct] = useState<Product | null>(null);
  const [imageLoadingState, setImageLoadingState] = useState<{ [key: number]: boolean }>({});
  const [imageErrorState, setImageErrorState] = useState<{ [key: number]: boolean }>({});
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  // Profil d'achat (P5) — declare ici car consomme par le useMemo displayedProducts.
  const [preferences, setPreferences] = useState<ClientPreference | null>(null);
  // Gates the WhatsApp + AI chatbot entry points. Resolved once we know both the
  // current user and the epicerie id. Fail-closed on error (see the hook).
  const { isClient: isClientOfEpicerie, ready: clientStatusReady } = useEpicerieClientStatus(
    clientId,
    typeof id === "string" ? parseInt(id, 10) : id ? parseInt(id[0], 10) : null,
  );
  const canUseAssistedOrdering = clientStatusReady && isClientOfEpicerie;
  const [viewMode, setViewMode] = useState<"card" | "list" | "grid" | "sections">("sections");

  /** Onglet actif sous le hero (sticky tabs) — défaut Produits. */
  const [activeTab, setActiveTab] = useState<EpicerieTab>("products");

  /** Position de scroll de la FlatList pour piloter le mini-header collapsable.
   *  Initialisée à 0 ; mise à jour via Animated.event sur onScroll. useNativeDriver
   *  est OK car on n'animera que opacity et translateY (props supportées natif).
   *
   *  Partagée entre les 3 scrollables (FlatList Produits + ScrollView Avis/Infos) —
   *  on la reset à 0 quand l'utilisateur change de tab pour éviter que le
   *  mini-header reste visible alors qu'on vient d'arriver en haut d'un autre tab. */
  const scrollY = useRef(new Animated.Value(0)).current;
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  // ── Avis (V102 phase 2) ──────────────────────────────────────────────
  // Liste réelle des avis clients + distribution par étoiles. Chargées
  // paresseusement à la 1ère ouverture du tab Avis pour ne pas alourdir le
  // montage de l'écran (le tab par défaut est Produits).
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [reviewStats, setReviewStats] = useState<RatingStats | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  /** Historique de recherche local par épicerie (8 dernières, MRU). */
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Brand filter applied client-side over the already-fetched product list.
  // Seeded from a ?brandId= query param so deep-links from the product detail
  // page land directly on a filtered list.
  const initialBrandId = brandIdParam ? parseInt(brandIdParam, 10) : null;
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(
    Number.isFinite(initialBrandId) ? initialBrandId : null,
  );
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(null);
  const [selectedBrandLogoUrl, setSelectedBrandLogoUrl] = useState<string | null>(null);

  // Load loyalty balance when store loads
  useEffect(() => {
    if (id && canUseAssistedOrdering) {
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      loyaltyService.getMyBalanceAtStore(epicerieId)
        .then(b => b.isActive ? setLoyaltyBalance(b) : null)
        .catch(() => {});
    }
  }, [id, canUseAssistedOrdering]);

  /** Bug #1 fix : reset la position de scroll à chaque changement de tab.
   *  Sans ça, le mini-header sticky (piloté par scrollY) reste visible quand
   *  l'utilisateur bascule de Produits vers Avis/Infos avec un scroll élevé. */
  useEffect(() => {
    scrollY.setValue(0);
  }, [activeTab, scrollY]);

  // ── Chargement ────────────────────────────────────────────────────────────

  const getEpicerieId = useCallback(() => {
    return typeof id === "string" ? parseInt(id, 10) : parseInt(id[0], 10);
  }, [id]);

  const loadEpicerieInfo = useCallback(async () => {
    try {
      const data = await epicerieService.getEpicerieById(getEpicerieId());
      setEpicerie(data);
    } catch (error) {
      console.error("Erreur chargement épicerie:", error);
    }
  }, [getEpicerieId]);

  // Propage la devise de l'épicerie au CurrencyContext pour que tous les
  // composants enfants (panier, fiche produit, modales) formatent les
  // prix dans la bonne devise. Reset à la sortie pour ne pas polluer
  // l'écran suivant si le client revient à la liste des épiceries.
  useEffect(() => {
    setCurrency(epicerie?.currency ?? null);
    return () => setCurrency(null);
  }, [epicerie?.currency, setCurrency]);

  const loadProducts = useCallback(async (
    page: number,
    search: string,
    categoryIds: number[] | undefined,
    append: boolean,
    tagIds?: number[],
  ) => {
    try {
      if (!append) setLoading(true);

      const result: ProductPage = await productService.getProductsByEpiceriePaginated(
        getEpicerieId(), page, 20, search || undefined, categoryIds,
        tagIds && tagIds.length > 0 ? tagIds : undefined,
      );
      // On remplace ou on ajoute — jamais de flash "liste vide"
      setProducts((prev) => append ? [...prev, ...result.content] : result.content);
      setCurrentPage(result.number);
      setTotalProducts(result.totalElements);
      setHasMore(!result.last);
    } catch (error) {
      console.error('[loadProducts] ERREUR:', error);
    } finally {
      setLoading(false);
      // Une fois la 1ère page chargée (succès ou échec), on quitte le mode
      // skeleton pour de bon. Les refetch suivants gardent la liste affichée.
      if (!append) setInitialLoading(false);
    }
  }, [getEpicerieId]);

  const loadCategories = useCallback(async () => {
    // Note: ne touche plus à `loading` — les catégories sont auxiliaires
    // (filtres). Si elles tardent, on n'empêche pas l'affichage des produits.
    try {
      const data = await categoryService.getCategoriesByEpicerie(getEpicerieId());
      setCategories(data);
    } catch (error) {
      console.error('[loadCategories] ERREUR:', error);
      toast.error(t("common.error"), String(error));
    }
  }, [getEpicerieId, t, toast]);

  const loadTags = useCallback(async () => {
    try {
      const data = await tagService.getByEpicerie(getEpicerieId());
      setAvailableTags(data);
    } catch {
      // Tags non critiques — fallback silencieux
    }
  }, [getEpicerieId]);

  const loadActivePromos = useCallback(async () => {
    try {
      const promos = await promotionService.getAllActivePromotions();
      setActivePromos(activePromosForEpicerie(promos, getEpicerieId()));
    } catch {
      setActivePromos([]);
    }
  }, [getEpicerieId]);

  /**
   * Charge la liste réelle des avis + la distribution par étoiles. Les deux
   * appels sont parallélisés ; un échec retombe sur un état vide (jamais
   * d'erreur bloquante — les avis sont un complément, pas un bloqueur).
   * `force` ignore le flag `reviewsLoaded` pour permettre un refresh après
   * qu'un client vient de poster son avis.
   */
  const loadReviews = useCallback(async (force = false) => {
    if (reviewsLoaded && !force) return;
    setReviewsLoading(true);
    try {
      const eid = getEpicerieId();
      const [list, stats] = await Promise.all([
        ratingService.getEpicerieRatings(eid),
        ratingService.getEpicerieStats(eid),
      ]);
      // Plus récents d'abord (le backend ne garantit pas l'ordre).
      const sorted = [...list].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setReviews(sorted);
      setReviewStats(stats);
      setReviewsLoaded(true);
    } catch {
      setReviews([]);
      setReviewStats(null);
    } finally {
      setReviewsLoading(false);
    }
  }, [getEpicerieId, reviewsLoaded]);

  // Chargement paresseux : dès que l'utilisateur ouvre le tab Avis (et une
  // seule fois, sauf refresh explicite).
  useEffect(() => {
    if (activeTab === "reviews") loadReviews();
  }, [activeTab, loadReviews]);

  // ── Brand filter (client-side) ────────────────────────────────────────────
  // Filtering happens in-memory rather than re-fetching: simpler, and the page
  // already loads paginated batches that the user can drill into anyway.
  const displayedProducts = useMemo(() => {
    let list = selectedBrandId === null
      ? products
      : products.filter((p) => p.brandId === selectedBrandId);

    // Boost des habitudes (P5) : on remonte les produits frequents du client en
    // tete, UNIQUEMENT en navigation par defaut (sans recherche/categorie/tag)
    // pour ne pas ecraser la pertinence serveur. Tri stable O(n log n) sur la
    // page deja en RAM — cout imperceptible, profil null = ordre inchange.
    const isDefaultBrowse =
      !searchQuery.trim() && selectedCategoryId === null && selectedTagIds.length === 0;
    if (isDefaultBrowse && preferences && preferences.topProducts.length > 0) {
      const rank = new Map(preferences.topProducts.map((tp) => [tp.productId, tp.orderCount]));
      list = list
        .map((p, i) => ({ p, i, score: rank.get(p.id) ?? 0 }))
        .sort((a, b) => (b.score - a.score) || (a.i - b.i))
        .map((x) => x.p);
    }
    return list;
  }, [products, selectedBrandId, searchQuery, selectedCategoryId, selectedTagIds, preferences]);

  const handleBrandSelect = useCallback((b: { id: number; name: string; logoUrl?: string | null }) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedBrandId(b.id);
    setSelectedBrandName(b.name);
    setSelectedBrandLogoUrl(b.logoUrl ?? null);
  }, []);

  const clearBrandFilter = useCallback(() => {
    setSelectedBrandId(null);
    setSelectedBrandName(null);
    setSelectedBrandLogoUrl(null);
  }, []);

  // When the page is opened via ?brandId=… we don't yet know the brand's name
  // for the active-filter pill. Resolve it from the first matching product
  // once the list arrives.
  useEffect(() => {
    if (selectedBrandId !== null && !selectedBrandName) {
      const found = products.find((p) => p.brandId === selectedBrandId);
      if (found?.brandName) {
        setSelectedBrandName(found.brandName);
        setSelectedBrandLogoUrl(found.brandLogoUrl ?? null);
      }
    }
  }, [products, selectedBrandId, selectedBrandName]);

  // ── Chargement initial ────────────────────────────────────────────────────

  useEffect(() => {
    const loadClientId = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) setClientId(user.userId);
      } catch {}
    };
    loadClientId();
  }, []);

  // Profil d'achat (P5) — fetch en arriere-plan. Boost applique dans
  // displayedProducts. Echec silencieux : pas de profil = ordre serveur inchange.
  useEffect(() => {
    const eid = getEpicerieId();
    if (!eid || !clientId) return;
    let cancelled = false;
    clientPreferencesService.getPreferences(eid, clientId).then((p) => {
      if (!cancelled) setPreferences(p);
    });
    return () => { cancelled = true; };
  }, [clientId, getEpicerieId]);

  // Chargement initial uniquement quand l'ID change
  useEffect(() => {
    if (id) {
      setSearchQuery("");
      setSelectedCategoryId(null);
      setSelectedTagIds([]);
      setProducts([]);
      // Reset des avis : on repart sur un chargement propre pour la nouvelle épicerie.
      setReviews([]);
      setReviewStats(null);
      setReviewsLoaded(false);
      loadEpicerieInfo();
      loadCategories();
      loadTags();
      loadActivePromos();
      loadProducts(0, "", undefined, false);
      // Hydrate l'historique de recherche pour cette épicerie
      searchHistoryService.list(getEpicerieId()).then(setSearchHistory).catch(() => {});
    }
  }, [id]);

  // Au focus : recharge le panier ET le catalogue épicier (produits, catégories,
  // tags, promos). Le client doit voir en temps réel les ajouts/modifs faits par
  // l'épicier — sans ce refetch, il fallait se déconnecter/reconnecter pour
  // forcer le démontage du composant et perdre le cache state React.
  //
  // Le tout 1er focus est skip car le useEffect([id]) vient de tout charger
  // synchroniquement — sans ça on aurait 2 fetchs en parallèle au montage.
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      cartService.getCart().then(setCart).catch(() => {});

      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }

      // Refetch silencieux (pas de skeleton, on garde la liste affichée jusqu'à
      // la réponse) — l'utilisateur ne doit pas voir l'écran "se vider" alors
      // qu'il a juste fait un aller-retour sur une fiche produit.
      loadEpicerieInfo();
      loadCategories();
      loadTags();
      loadActivePromos();
      loadProducts(
        0,
        searchQuery,
        selectedCategoryId != null ? [selectedCategoryId] : undefined,
        false,
        selectedTagIds.length > 0 ? selectedTagIds : undefined,
      );
    }, [
      loadEpicerieInfo,
      loadCategories,
      loadTags,
      loadActivePromos,
      loadProducts,
      searchQuery,
      selectedCategoryId,
      selectedTagIds,
    ]),
  );

  // ── Parsing horaires ────────────────────────────────────────────────────
  // Le champ `epicerie.horaires` est un JSON stringifié au format
  // `{ lundi: { isOpen, openTime: "HH:MM", closeTime: "HH:MM" }, ... }`
  // (cf. StepHours dans l'onboarding épicier). On parse en safe-mode et on
  // formate proprement pour l'affichage client — JAMAIS de JSON brut visible.
  type DayHours = { isOpen?: boolean; openTime?: string; closeTime?: string };
  type WeekSchedule = Partial<Record<
    'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche',
    DayHours
  >>;
  const DAY_KEYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

  const parseHoraires = (raw?: string): WeekSchedule | null => {
    if (!raw || !raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      // Pas du JSON — on laisse le caller utiliser le string brut s'il veut.
      return null;
    }
  };

  /** "08:00" → "8h", "08:30" → "8h30". Minimaliste, lisible sur petite pastille. */
  const formatTimeShort = (hhmm?: string): string => {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':');
    const hNum = parseInt(h, 10);
    if (isNaN(hNum)) return hhmm;
    return m === '00' || !m ? `${hNum}h` : `${hNum}h${m}`;
  };

  /** Horaire d'AUJOURD'HUI formaté pour la pastille — null si non disponible. */
  const formatHoraireToday = (schedule: WeekSchedule | null): string | null => {
    if (!schedule) return null;
    const todayKey = DAY_KEYS[new Date().getDay()];
    const day = schedule[todayKey];
    if (!day) return null;
    if (day.isOpen === false) return t('epicerieDetail.closedToday');
    if (!day.openTime || !day.closeTime) return null;
    return `${formatTimeShort(day.openTime)} - ${formatTimeShort(day.closeTime)}`;
  };

  // ── Pastilles méta-info (#3 + #4) ───────────────────────────────────────
  // Construit la rangée scrollable de pastilles affichée juste sous le brand
  // ribbon : statut ouvert/fermé + rating + livraison + horaires. L'ordre est
  // pensé pour scanabilité : ouvert/fermé est l'info la plus critique (le
  // client ne veut pas perdre son temps à fouiller un magasin fermé), puis
  // la qualité (rating), puis les modalités pratiques (livraison/horaires).
  const buildMetaPills = useCallback((e: Epicerie): MetaPill[] => {
    const pills: MetaPill[] = [];

    // 1. Statut ouvert / fermé — vert ou rouge pour signal immédiat.
    if (e.isOpen != null) {
      pills.push(e.isOpen
        ? { label: t("epicerieDetail.statusOpen"),   bgColor: '#DCFCE7', textColor: '#166534' }
        : { label: t("epicerieDetail.statusClosed"), bgColor: '#FEE2E2', textColor: '#991B1B' });
    }

    // 2. Note moyenne (si au moins 1 avis).
    if (e.averageRating != null && e.averageRating > 0) {
      pills.push({
        label: t("epicerieDetail.pillReviews")
          .replace('{{rating}}', e.averageRating.toFixed(1))
          .replace('{{count}}', String(e.totalRatings ?? 0)),
        bgColor: '#FEF3C7',
        textColor: '#92400E',
      });
    }

    // 3. Mode de livraison — formaté selon FLAT_RATE / ZONES / NONE.
    if (e.deliveryMode === 'FLAT_RATE' && e.flatDeliveryFee != null) {
      pills.push({
        label: t("epicerieDetail.pillDeliveryFlat")
          .replace('{{fee}}', formatPrice(e.flatDeliveryFee)),
        bgColor: '#E0E7FF',
        textColor: '#3730A3',
      });
    } else if (e.deliveryMode === 'ZONES') {
      pills.push({
        label: t("epicerieDetail.pillDeliveryZones"),
        bgColor: '#E0E7FF',
        textColor: '#3730A3',
      });
    } else if (e.deliveryMode === 'NONE' || !e.hasLivreur) {
      pills.push({
        label: t("epicerieDetail.pillPickupOnly"),
        bgColor: '#F1F5F9',
        textColor: '#475569',
      });
    }

    // 4. Horaires d'AUJOURD'HUI — parsing safe du JSON `epicerie.horaires`.
    // Si parse OK + jour courant trouvé → formaté joliment ("8h - 20h").
    // Si JSON invalide ou jour absent → on n'affiche pas la pastille (pas de
    // JSON brut visible au client, contrairement à la V1).
    const todayHours = formatHoraireToday(parseHoraires(e.horaires));
    if (todayHours) {
      pills.push({
        label: `🕐 ${t('epicerieDetail.todayHoursPrefix')} ${todayHours}`,
        bgColor: '#F1F5F9',
        textColor: '#475569',
      });
    }

    return pills;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // ── Mini-cart sticky : résumé du panier pour CETTE épicerie ──────────────
  // Le cart global est multi-épicerie (V96) : on filtre via groupCartByEpicerie
  // pour ne montrer que ce que le client a ajouté ici. La barre apparaît dès
  // qu'il y a ≥ 1 article et amène au checkout en 1 tap.
  const currentEpicerieCart = useMemo(() => {
    const epId = getEpicerieId();
    if (!epId) return null;
    const groups = groupCartByEpicerie(cart);
    return groups.find((g) => g.epicerieId === epId) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, id]);

  // ── Catégories à plat pour les chips ─────────────────────────────────────

  const flatCategories = useMemo(() => {
    const flatten = (cats: Category[]): Category[] =>
      cats.flatMap((c) => [c, ...(c.children ? flatten(c.children) : [])]);
    return flatten(categories);
  }, [categories]);

  // Tous les IDs d'une catégorie (parent + enfants récursivement) — envoyés au serveur
  const getCategoryIdsRecursive = useCallback((cat: Category): number[] => {
    let ids = [cat.id];
    if (cat.children) {
      cat.children.forEach((child) => {
        ids = ids.concat(getCategoryIdsRecursive(child));
      });
    }
    return ids;
  }, []);

  const selectedCategoryIds = useMemo((): number[] | undefined => {
    if (selectedCategoryId === null) return undefined;
    const cat = flatCategories.find((c) => c.id === selectedCategoryId);
    return cat ? getCategoryIdsRecursive(cat) : [selectedCategoryId];
  }, [selectedCategoryId, flatCategories, getCategoryIdsRecursive]);

  // ── Sélection de catégorie avec rechargement serveur ─────────────────────

  const handleCategorySelect = useCallback((catId: number | null) => {
    setSelectedCategoryId(catId);
    const catIds = catId === null
      ? undefined
      : (() => {
          const cat = flatCategories.find((c) => c.id === catId);
          return cat ? getCategoryIdsRecursive(cat) : [catId];
        })();
    // isSearch=false → spinner principal pour un feedback visuel clair
    loadProducts(0, searchQuery, catIds, false, selectedTagIds);
  }, [flatCategories, getCategoryIdsRecursive, searchQuery, selectedTagIds, loadProducts]);

  /**
   * Applique en lot les choix faits dans la bottom-sheet Filtres : on lance
   * UN SEUL fetch produits avec la nouvelle combinaison (catégorie + tags).
   * Avant la refonte, chaque toggle déclenchait son propre fetch.
   */
  const handleFiltersApply = useCallback((next: { categoryId: number | null; tagIds: number[] }) => {
    setSelectedCategoryId(next.categoryId);
    setSelectedTagIds(next.tagIds);
    const catIds = next.categoryId === null
      ? undefined
      : (() => {
          const cat = flatCategories.find((c) => c.id === next.categoryId);
          return cat ? getCategoryIdsRecursive(cat) : [next.categoryId!];
        })();
    loadProducts(0, searchQuery, catIds, false, next.tagIds);
  }, [flatCategories, getCategoryIdsRecursive, searchQuery, loadProducts]);

  // ── Recherche déclenchée manuellement (bouton ou clavier "Rechercher") ────

  const handleSearchSubmit = useCallback(() => {
    loadProducts(0, searchQuery, selectedCategoryIds, false, selectedTagIds);
    // Mémorise la requête (≥ 2 chars, sinon ignoré par le service)
    searchHistoryService.add(getEpicerieId(), searchQuery).then(setSearchHistory).catch(() => {});
    // On replie la barre de recherche après submit pour rendre l'écran aux
    // résultats. L'utilisateur peut la rouvrir via la loupe du mini-header.
    setSearchVisible(false);
  }, [searchQuery, selectedCategoryIds, selectedTagIds, loadProducts, getEpicerieId]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    loadProducts(0, "", selectedCategoryIds, false, selectedTagIds);
  }, [selectedCategoryIds, selectedTagIds, loadProducts]);

  /** Sélection d'une recherche depuis l'historique: remplit + lance la requête. */
  const handleHistoryPick = useCallback((query: string) => {
    setSearchQuery(query);
    loadProducts(0, query, selectedCategoryIds, false, selectedTagIds);
    // Réordonne l'entrée en tête (MRU) sans changer le contenu
    searchHistoryService.add(getEpicerieId(), query).then(setSearchHistory).catch(() => {});
    setSearchVisible(false);
  }, [selectedCategoryIds, selectedTagIds, loadProducts, getEpicerieId]);

  const handleHistoryRemove = useCallback((query: string) => {
    searchHistoryService.remove(getEpicerieId(), query).then(setSearchHistory).catch(() => {});
  }, [getEpicerieId]);

  /**
   * Reset complet de TOUS les filtres actifs (recherche + catégorie + tags +
   * marque) en un seul fetch. Utilisé par l'empty-state "Réinitialiser
   * filtres" qui sinon ne nettoyait que la requête + la catégorie.
   */
  const resetAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategoryId(null);
    setSelectedTagIds([]);
    clearBrandFilter();
    loadProducts(0, "", undefined, false, []);
  }, [loadProducts, clearBrandFilter]);

  // ── Chargement de la page suivante (infinite scroll) ─────────────────────

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadProducts(currentPage + 1, searchQuery, selectedCategoryIds, true, selectedTagIds)
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, currentPage, searchQuery, selectedCategoryIds, selectedTagIds, loadProducts]);

  // ── Panier ────────────────────────────────────────────────────────────────

  const handleAddToCart = (product: Product) => {
    if (product.units && product.units.length > 0) {
      setSelectedProductForCart(product);
      setShowUnitSelector(true);
    } else {
      addToCartDirect(product);
    }
  };

  /**
   * Quantité actuelle d'un produit dans le panier (toutes variantes confondues).
   * Permet au selector inline d'afficher le compteur dynamiquement et à
   * `getRemainingStock` de calculer le stock encore disponible.
   */
  const getCartQuantityForProduct = useCallback((productId: number): number => {
    return cart
      .filter((c) => c.productId === productId)
      .reduce((sum, c) => sum + (c.quantity || 0), 0);
  }, [cart]);

  /**
   * Decrement inline d'un produit. Pour les produits sans variantes c'est
   * direct. Pour ceux avec variantes (rare via ce path, le selector désactive
   * le "−" dans ce cas), on retire 1 unité à la 1ère ligne matching trouvée.
   */
  const handleDecrement = async (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const line = cart.find((c) => c.productId === product.id);
      if (!line) return;
      const updatedCart = await cartService.updateQuantity(product.id, -1, line.unitId);
      setCart(updatedCart);
    } catch {
      toast.error(t("common.error"), t("products.errorAdding"));
    }
  };

  const addToCartDirect = async (product: Product) => {
    // Haptic léger AVANT l'await: feedback corporel instantané qui rend
    // l'attente AsyncStorage imperceptible (~10-50ms).
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      // Prix remisé si une promotion active touche ce produit. Pour les
      // produits SANS variantes, PromotionApplicationService côté backend ne
      // modifie pas Product.prix — la remise n'est que runtime côté front.
      // Sans ce calcul, le panier garderait le prix d'origine.
      const promo = bestPromoForProduct(activePromos, product);
      const effectivePrice = effectivePriceForProduct(product, promo).display;
      const cartItem: CartItem = {
        itemType: "PRODUCT",
        productId: product.id,
        productNom: product.nom,
        epicerieId: product.epicerieId,
        quantity: 1,
        unitId: undefined,
        unitLabel: t("products.piece") || t("products.addQuantity"),
        pricePerUnit: effectivePrice,
        totalPrice: effectivePrice,
        photoUrl: product.photoUrl,
      };
      const updatedCart = await cartService.addToCart(cartItem);
      setCart(updatedCart);
      toast.success(t("products.addedToCart"), product.nom);
    } catch {
      toast.error(t("common.error"), t("products.errorAdding"));
    }
  };

  const handleAddToCartWithUnit = async (
    unitId: number | null,
    quantity: number,
    totalPrice: number,
    unit: ProductUnit,
  ) => {
    if (!selectedProductForCart) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const productName = selectedProductForCart.nom;
    try {
      // unitId === null → produit sans variante (tarif Product.prix).
      // On stocke `undefined` dans le CartItem pour qu'il soit omis du payload
      // de commande (le backend déclenche "Unit not found" sur unitId=0/null
      // explicite si la ProductUnit n'existe pas).
      //
      // Prix unitaire remisé : aligne le pricePerUnit du panier sur le total
      // déjà remisé (totalPrice vient de ProductUnitDisplay.getTotalPrice qui
      // applique effectivePriceForUnit). Sans ça, modifier la quantité dans
      // le panier recalculerait à `quantity * unit.prix` (prix d'origine) et
      // perdrait la remise.
      const promo = bestPromoForProduct(activePromos, selectedProductForCart);
      const effectivePerUnit = unitId != null
        ? effectivePriceForUnit(unit, promo).display
        : effectivePriceForProduct(selectedProductForCart, promo).display;
      const cartItem: CartItem = {
        itemType: "PRODUCT",
        productId: selectedProductForCart.id,
        productNom: productName,
        epicerieId: selectedProductForCart.epicerieId,
        unitId: unitId ?? undefined,
        unitLabel: unit.label,
        quantity,
        // requestedQuantity = quantité dans l'unité de base (L, kg, pcs) attendue
        // par le backend pour la vérification stock. unit.quantity porte le volume
        // de la variante (0.25 pour 250ml, 0.5 pour 500g, 1 pour "à l'unité").
        // Sans cette multiplication, le backend interprète mal et renvoie
        // "insufficient stock" sur des produits qui en ont pourtant.
        requestedQuantity: quantity * (unit.quantity ?? 1),
        pricePerUnit: effectivePerUnit,
        totalPrice,
        photoUrl: selectedProductForCart.photoUrl,
      };
      const updatedCart = await cartService.addToCart(cartItem);
      setCart(updatedCart);
      // Ferme la modal AVANT le toast pour que l'utilisateur le voie clairement.
      setShowUnitSelector(false);
      setSelectedProductForCart(null);
      toast.success(t("products.addedToCart"), `${productName} (${unit.label})`);
    } catch {
      toast.error(t("common.error"), t("products.errorAdding"));
    }
  };

  const handleChatbotAddToCart = async (products: ParsedProduct[]) => {
    // Pre-scan le panier actuel pour categoriser :
    //   - nouveaux : (productId, unitId) absent du panier → push
    //   - duplicates : deja present → cartService.addToCart va cumuler la qty
    // Sans cette etape, l'utilisateur ne realise pas qu'il a deja ajoute le
    // produit et finit avec 4kg au lieu de 2kg sans s'en rendre compte.
    const currentCart = await cartService.getCart();
    const matchable = products.filter(p => p.isMatched && p.matchedProductId);

    type CategorizedItem = { product: ParsedProduct; existingQty?: number };
    const duplicates: CategorizedItem[] = [];
    const newItems: CategorizedItem[] = [];
    for (const p of matchable) {
      const existing = currentCart.find(
        c => c.productId === p.matchedProductId
            && c.unitId === (p.matchedProductUnitId ?? undefined)
      );
      if (existing) {
        duplicates.push({ product: p, existingQty: existing.quantity });
      } else {
        newItems.push({ product: p });
      }
    }

    // Helper : exécute l'ajout réel (utilise par les 3 branches du dialog).
    const performAdd = async (toAdd: CategorizedItem[]) => {
      try {
        for (const { product: p } of toAdd) {
          const pricePerUnit = p.matchedPrice ?? 0;
          await cartService.addToCart({
            itemType: "PRODUCT",
            productId: p.matchedProductId!,
            productNom: p.matchedProductName || p.productName,
            epicerieId: getEpicerieId(),
            unitId: p.matchedProductUnitId ?? undefined,
            unitLabel: p.matchedUnitLabel || p.unit,
            quantity: p.quantity,
            requestedQuantity: p.quantity,
            pricePerUnit,
            totalPrice: pricePerUnit * p.quantity,
          });
        }
        const updatedCart = await cartService.getCart();
        setCart(updatedCart);
        if (toAdd.length > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          toast.success(`${toAdd.length} ${t("epicerieDetail.addedToCartSuccess")}`);
        }
      } catch {
        toast.error(t("common.error"), t("epicerieDetail.addToCartError"));
      }
    };

    if (matchable.length === 0) {
      toast.error(t("common.error"), t("epicerieDetail.addToCartError"));
      return;
    }

    // Aucun doublon → comportement historique direct, sans dialog parasite.
    if (duplicates.length === 0) {
      await performAdd(newItems);
      return;
    }

    // Doublons detectes → dialog explicite. Choix utilisateur :
    //   - "Cumuler" : ajoute les nouveaux ET cumule les qty des doublons
    //   - "Ignorer doublons" : n'ajoute que les nouveaux, garde panier intact
    //   - "Annuler" : ne touche a rien
    const dupNames = duplicates
      .map(d => `• ${d.product.matchedProductName} (déjà ${d.existingQty})`)
      .join('\n');
    const summary = newItems.length > 0
      ? `${newItems.length} nouveau(x) + ${duplicates.length} déjà présent(s) :\n${dupNames}`
      : `${duplicates.length} produit(s) déjà dans votre panier :\n${dupNames}`;

    Alert.alert(
      'Produits déjà dans le panier',
      summary,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ignorer doublons', onPress: () => performAdd(newItems) },
        { text: 'Cumuler', onPress: () => performAdd([...newItems, ...duplicates]) },
      ],
    );
  };

  const goToProductDetail = (product: Product) =>
    router.push(`/(client)/(epicerie)/product/${product.id}?epicerieId=${id}`);

  // ── Helpers UI ────────────────────────────────────────────────────────────

  const renderStars = (rating: number) => {
    // Borne la note dans [0, 5] puis décompose en pleines / demie / vides.
    // L'ancien calcul utilisait Math.ceil pour les vides, ce qui produisait
    // moins de 5 symboles pour toute décimale < 0.5 (ex: 4.2 → 4 étoiles).
    const safe = Math.max(0, Math.min(5, rating || 0));
    const full = Math.floor(safe);
    const hasHalf = safe - full >= 0.5;
    const empty = 5 - full - (hasHalf ? 1 : 0);
    return "⭐".repeat(full) + (hasHalf ? "⭐" : "") + "☆".repeat(empty);
  };

  /** Date d'avis lisible ("12 mars 2025"). Tolère un ISO absent/invalide. */
  const formatReviewDate = (iso?: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };

  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase().trim();
    const map: Record<string, string> = {
      "fruits et légumes": "🥬", fruits: "🍎", légumes: "🥕",
      "viandes et poissons": "🥩", viande: "🥩", viandes: "🥩", poisson: "🐟",
      "produits laitiers": "🥛", lait: "🥛", fromage: "🧀", beurre: "🧈",
      épicerie: "🛒", pâtes: "🍝", riz: "🍚", conserves: "🥫", huile: "🫒",
      boissons: "🥤", eau: "💧", jus: "🧃", café: "☕", thé: "🍵",
      surgelés: "❄️", "pain et pâtisserie": "🍞", pain: "🍞", pâtisserie: "🥐",
      "hygiène et beauté": "🧴", hygiène: "🧴", savon: "🧼",
      entretien: "🧹", ménage: "🧹", bébé: "👶",
      bio: "🌱", épices: "🌶️", snacks: "🍿", chocolat: "🍫",
    };
    if (map[n]) return map[n];
    for (const [key, icon] of Object.entries(map)) {
      if (n.includes(key) || key.includes(n)) return icon;
    }
    return "📦";
  };

  const openGoogleMaps = async () => {
    if (!epicerie?.latitude || !epicerie?.longitude) {
      toast.warning(t("common.error"), t("epicerieDetail.noGpsCoords"));
      return;
    }
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${epicerie.latitude},${epicerie.longitude}`;
      const canOpen = await Linking.canOpenURL(url);
      await Linking.openURL(canOpen ? url : `https://maps.google.com/?q=${epicerie.latitude},${epicerie.longitude}`);
    } catch {
      toast.error(t("common.error"), t("epicerieDetail.cantOpenMaps"));
    }
  };

  // ── Rendu produit — mode CARTE (défaut) ───────────────────────────────────

  const renderProductCard = ({ item }: { item: Product }) => {
    const stockVal = item.totalStock ?? item.stock ?? 0;
    const stockColor = stockVal <= 0 ? '#e53935' : stockVal <= 5 ? '#f57c00' : '#388e3c';
    const stockBg    = stockVal <= 0 ? '#ffebee' : stockVal <= 5 ? '#fff3e0' : '#e8f5e9';
    const isOos = stockVal <= 0;
    const promo = bestPromoForProduct(activePromos, item);
    const price = effectivePriceForProduct(item, promo);

    return (
      <TouchableOpacity
        style={styles.epicCardWrapper}
        onPress={() => goToProductDetail(item)}
        activeOpacity={0.95}
      >
        {/* Image */}
        <View style={styles.epicCardImageBox}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.epicCardImg} resizeMode="cover" />
          ) : (
            <Text style={styles.epicCardImgPlaceholder}>📦</Text>
          )}
          {promo && (
            <View style={styles.epicCardPromoBadge}>
              <PromoProductBadge promo={promo} compact />
            </View>
          )}
        </View>

        <View style={styles.epicCardBody}>
        {/* Header : nom + prix */}
        <View style={styles.epicCardHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.epicCardName} numberOfLines={1}>{item.nom}</Text>
            {item.description ? (
              <Text style={styles.epicCardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            {promo && promo.titre ? (
              <Text style={styles.epicCardPromoTitle} numberOfLines={1}>🎉 {promo.titre}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {price.hasDiscount && price.original != null && (
              <Text style={styles.epicCardPrixBarre}>{formatPrice(price.original)}</Text>
            )}
            <Text style={[styles.epicCardPrice, price.hasDiscount && { color: '#e53935' }]}>
              {formatPrice(price.display)}
            </Text>
          </View>
        </View>

        {/* Catégorie */}
        {item.categoryName ? (
          <View style={styles.epicCardCatRow}>
            <View style={styles.epicCardCatBadge}>
              <Text style={styles.epicCardCatText}>{item.categoryName}</Text>
            </View>
          </View>
        ) : null}

        {/* Tags */}
        {item.tags && item.tags.length > 0 ? (
          <View style={styles.epicCardTagsRow}>
            {item.tags.map((t) => (
              <View key={t.id} style={[styles.epicCardTagChip, { borderColor: t.color || '#607D8B', backgroundColor: (t.color || '#607D8B') + '15' }]}>
                <Text style={[styles.epicCardTagText, { color: '#333' }]}>{t.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Marque */}
        {item.brandName && item.brandId ? (
          <View style={styles.epicCardBrandRow}>
            <BrandChip
              name={item.brandName}
              logoUrl={item.brandLogoUrl}
              size="md"
              variant="badge"
              onPress={() => handleBrandSelect({ id: item.brandId!, name: item.brandName!, logoUrl: item.brandLogoUrl })}
            />
          </View>
        ) : null}

        {/* Méta : stock + variantes */}
        <View style={styles.epicCardMeta}>
          <View style={[styles.epicCardMetaBadge, { backgroundColor: stockBg }]}>
            <Text style={[styles.epicCardMetaText, { color: stockColor }]}>
              {isOos ? 'Rupture de stock' : `Stock: ${stockVal}`}
            </Text>
          </View>
          {item.units && item.units.length > 0 ? (
            <View style={styles.epicCardMetaBadge}>
              <Text style={styles.epicCardMetaText}>{item.units.length} variante{item.units.length > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions : détails + ajouter au panier */}
        <View style={styles.epicCardActions}>
          <TouchableOpacity
            style={styles.epicCardDetailsBtn}
            onPress={(e) => { e.stopPropagation(); goToProductDetail(item); }}
            activeOpacity={0.8}
          >
            <Text style={styles.epicCardDetailsBtnText}>Voir les détails</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.epicCardCartBtn, isOos && styles.epicCardCartBtnOos]}
            onPress={(e) => { e.stopPropagation(); if (!isOos) handleAddToCart(item); }}
            disabled={isOos}
            activeOpacity={0.8}
          >
            <Ionicons name={isOos ? "close" : "cart"} size={20} color="#fff" />
            {!isOos && <Text style={styles.epicCardCartBtnText}>Ajouter</Text>}
          </TouchableOpacity>
        </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Rendu produit — mode LISTE ─────────────────────────────────────────────

  const renderProduct = ({ item }: { item: Product }) => {
    const imageUrls = item.photoUrl ? [item.photoUrl] : [];
    const isLoading = imageLoadingState[item.id] || false;
    const isError = imageErrorState[item.id] || false;
    const promo = bestPromoForProduct(activePromos, item);
    const price = effectivePriceForProduct(item, promo);

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => goToProductDetail(item)}
        activeOpacity={0.9}
      >
        <TouchableOpacity
          style={styles.productImageContainer}
          onPress={(e) => {
            if (item.photoUrl && !isError) {
              e.stopPropagation();
              setSelectedImageProduct(item);
              setShowImageModal(true);
            }
          }}
          activeOpacity={0.7}
        >
          {isLoading && (
            <View style={styles.imageLoadingSpinner}>
              <ActivityIndicator size="small" color="#4CAF50" />
            </View>
          )}
          {item.photoUrl && !isError ? (
            <>
              <FallbackImage
                urls={imageUrls}
                style={[styles.productImage, { opacity: isLoading ? 0.5 : 1 }]}
                resizeMode="cover"
                onLoadStart={() => setImageLoadingState((p) => ({ ...p, [item.id]: true }))}
                onLoadEnd={() => setImageLoadingState((p) => ({ ...p, [item.id]: false }))}
                onError={() => setImageErrorState((p) => ({ ...p, [item.id]: true }))}
              />
              {!isLoading && (
                <View style={styles.zoomIconOverlay}>
                  <Text style={styles.zoomIcon}>🔍</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.productEmojiInContainer}>📦</Text>
          )}
          {promo && (
            <View style={styles.listPromoBadge}>
              <PromoProductBadge promo={promo} compact />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.nom}</Text>
          {item.brandName && item.brandId && (
            <View style={{ marginBottom: 2 }}>
              <BrandChip
                name={item.brandName}
                logoUrl={item.brandLogoUrl}
                size="sm"
                variant="badge"
                onPress={() => handleBrandSelect({ id: item.brandId!, name: item.brandName!, logoUrl: item.brandLogoUrl })}
              />
            </View>
          )}
          <Text style={styles.productCategory}>
            {item.categoryName || item.categorie || t("products.uncategorized")}
          </Text>
          {promo?.titre ? (
            <Text style={styles.productPromoTitle} numberOfLines={1}>🎉 {promo.titre}</Text>
          ) : null}
          {price.hasDiscount && price.original != null && (
            <Text style={styles.productPrixBarre}>{formatPrice(price.original)}</Text>
          )}
          <Text style={[
            styles.productPrice,
            // Override couleur prix par la couleur de marque de l'épicerie
            { color: brand.primary },
            price.hasDiscount && styles.productPricePromo, // promo prend priorité (rouge)
          ]}>
            {formatPrice(price.display)}
          </Text>
          <Text style={styles.productStock}>{t("products.stock")}: {effectiveStock(item)}</Text>
          <Text style={[styles.seeMoreText, { color: brand.primary }]}>👉 {t("products.seeMore")}</Text>
        </View>

        {/* Sélecteur de quantité inline — remplace l'ancien bouton "+" unique.
            Permet d'ajuster la quantité sans ouvrir le détail produit. */}
        <View onStartShouldSetResponder={() => true}>
          <InlineQuantitySelector
            currentQuantity={getCartQuantityForProduct(item.id)}
            hasVariants={!!(item.units && item.units.length > 0)}
            maxQuantity={effectiveStock(item)}
            disabled={!hasStock(item)}
            onIncrement={() => handleAddToCart(item)}
            onDecrement={() => handleDecrement(item)}
            onAddVariant={() => handleAddToCart(item)}
            color={brand.primary}
            textColor={brand.onPrimary}
            size="compact"
          />
        </View>
      </TouchableOpacity>
    );
  };

  // ── Rendu produit — mode GRILLE ──────────────────────────────────────────

  const renderProductGrid = ({ item }: { item: Product }) => {
    const imageUrls = item.photoUrl ? [item.photoUrl] : [];
    const isLoading = imageLoadingState[item.id] || false;
    const isError = imageErrorState[item.id] || false;
    const promo = bestPromoForProduct(activePromos, item);
    const price = effectivePriceForProduct(item, promo);

    const getStockBadge = () => {
      const n = effectiveStock(item);
      if (!hasStock(item)) return { label: `✗ ${t("products.outOfStockShort")}`,  color: "#F44336", bg: "#FFEBEE" };
      if (n < 3)           return { label: `⚠ ${n} ${t("products.inStockUnits")}`, color: "#F44336", bg: "#FFEBEE" };
      if (n <= 10)         return { label: `⚡ ${n} ${t("products.inStockUnits")}`, color: "#FF6F00", bg: "#FFF3E0" };
      return                       { label: `✓ ${t("products.inStock")}`, color: "#2E7D32", bg: "#E8F5E9" };
    };
    const stock = getStockBadge();

    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => goToProductDetail(item)}
        activeOpacity={0.93}
      >
        {/* ── Image (60 %) ──────────────────────────────────── */}
        <View style={styles.gridImageSection}>
          {isLoading && (
            <View style={styles.gridImageSpinner}>
              <ActivityIndicator size="small" color="#4CAF50" />
            </View>
          )}

          {item.photoUrl && !isError ? (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedImageProduct(item);
                setShowImageModal(true);
              }}
              activeOpacity={0.9}
            >
              <FallbackImage
                urls={imageUrls}
                style={[styles.gridImage, { opacity: isLoading ? 0.5 : 1 }]}
                resizeMode="cover"
                onLoadStart={() => setImageLoadingState((p) => ({ ...p, [item.id]: true }))}
                onLoadEnd={() => setImageLoadingState((p) => ({ ...p, [item.id]: false }))}
                onError={() => setImageErrorState((p) => ({ ...p, [item.id]: true }))}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.gridImagePlaceholder}>
              <Text style={styles.gridPlaceholderEmoji}>📦</Text>
            </View>
          )}

          {promo && (
            <View style={styles.gridPromoBadge}>
              <PromoProductBadge promo={promo} compact />
            </View>
          )}

          {/* Overlay actions au bas de l'image */}
          <View style={styles.gridOverlay}>
            <TouchableOpacity
              style={styles.gridDetailBtn}
              onPress={() => goToProductDetail(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.gridDetailBtnIcon}>👁</Text>
              <Text style={styles.gridOverlayBtnText}>{t("epicerieDetail.details")}</Text>
            </TouchableOpacity>

            <View style={styles.gridOverlaySep} />

            {/* Sélecteur de quantité inline — remplace le bouton "Ajouter".
                Le wrapper View capture l'événement pour qu'un tap ne propage
                pas vers le parent (navigation détail). */}
            <View
              onStartShouldSetResponder={() => true}
              style={styles.gridQtyWrap}
            >
              <InlineQuantitySelector
                currentQuantity={getCartQuantityForProduct(item.id)}
                hasVariants={!!(item.units && item.units.length > 0)}
                maxQuantity={effectiveStock(item)}
                disabled={!hasStock(item)}
                onIncrement={() => handleAddToCart(item)}
                onDecrement={() => handleDecrement(item)}
                onAddVariant={() => handleAddToCart(item)}
                color={brand.primary}
                textColor={brand.onPrimary}
                size="normal"
              />
            </View>
          </View>
        </View>

        {/* ── Infos (40 %) ──────────────────────────────────── */}
        <View style={styles.gridInfoSection}>
          <Text style={styles.gridProductName} numberOfLines={2}>{item.nom}</Text>

          {(item.categoryName || item.categorie) && (
            <View style={styles.gridCategoryChip}>
              <Text style={styles.gridCategoryText} numberOfLines={1}>
                {item.categoryName || item.categorie}
              </Text>
            </View>
          )}

          {item.brandName && item.brandId && (
            <BrandChip
              name={item.brandName}
              logoUrl={item.brandLogoUrl}
              size="sm"
              variant="badge"
              onPress={() => handleBrandSelect({ id: item.brandId!, name: item.brandName!, logoUrl: item.brandLogoUrl })}
            />
          )}

          {promo?.titre ? (
            <Text style={styles.gridPromoTitle} numberOfLines={1}>🎉 {promo.titre}</Text>
          ) : null}

          <View style={styles.gridBottomRow}>
            <View>
              {price.hasDiscount && price.original != null && (
                <Text style={styles.gridPrixBarre}>{formatPrice(price.original)}</Text>
              )}
              <Text style={[styles.gridProductPrice, price.hasDiscount && styles.gridProductPricePromo]}>
                {formatPrice(price.display)}
              </Text>
            </View>
            <View style={[styles.gridStockBadge, { backgroundColor: stock.bg }]}>
              <Text style={[styles.gridStockText, { color: stock.color }]}>{stock.label}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Bloc d'en-tête commun à TOUS les tabs : Hero + identité + pastilles méta
   * + onglets de navigation. Garde la même structure d'arrivée quelle que soit
   * la section active — cohérent avec l'attendu UX (Glovo / Airbnb).
   */
  const renderEpicerieHeader = () => {
    if (!epicerie) return null;
    return (
      <>
        {/* Hero immersif 300px avec actions flottantes (back, loupe, ...) */}
        <EpicerieHero
          photoUrl={epicerie.presentationPhotoUrl}
          brandPrimary={brand.primary}
          onBack={() => router.back()}
          onSearch={() => setSearchVisible(true)}
          onImagePress={epicerie.presentationPhotoUrl ? () => setShowBannerModal(true) : undefined}
          height={300}
        />

        {/* Bandeau identité — nom + adresse (style page d'accueil) */}
        <EpicerieIdentityBar
          logoUrl={epicerie.photoUrl}
          name={epicerie.nomEpicerie}
          address={epicerie.adresse}
          brandPrimary={brand.primary}
          onAddressPress={openGoogleMaps}
        />

        {/* Pastilles méta-info : statut + rating + livraison + horaires */}
        <View style={styles.metaPillsWrapper}>
          <EpicerieMetaPills pills={buildMetaPills(epicerie)} />
        </View>

        {/* Onglets Produits / Avis / Infos */}
        <EpicerieTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeColor={brand.primary}
          labels={{
            products: t("epicerieDetail.tabProducts"),
            reviews: t("epicerieDetail.tabReviews"),
            info: t("epicerieDetail.tabInfo"),
          }}
          reviewsBadge={
            epicerie.averageRating && epicerie.averageRating > 0
              ? epicerie.averageRating.toFixed(1)
              : undefined
          }
        />
      </>
    );
  };

  /**
   * Toolbar du tab Produits — compteur + bouton ⚙ Filtres + view toggle.
   * Affichée juste sous les onglets en mode Produits, masquée dans Avis/Infos
   * pour ne pas suggérer des filtres qui n'auraient aucun effet.
   */
  const renderProductsToolbar = () => {
    const activeFiltersCount =
      (selectedCategoryId !== null ? 1 : 0) +
      selectedTagIds.length +
      (selectedBrandId !== null ? 1 : 0);
    return (
      <View style={styles.toolbar}>
        <Text style={styles.toolbarCount}>
          {totalProducts} {totalProducts !== 1 ? t("epicerieDetail.products") : t("epicerieDetail.productSingular")}
        </Text>
        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={[
              styles.toolbarFiltersBtn,
              activeFiltersCount > 0 && { backgroundColor: brand.primary, borderColor: brand.primary },
            ]}
            onPress={() => setShowFiltersSheet(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toolbarFiltersText,
                activeFiltersCount > 0 && { color: brand.onPrimary },
              ]}
            >
              ⚙ {t("epicerieDetail.filters") || "Filtres"}
              {activeFiltersCount > 0 ? ` · ${activeFiltersCount}` : ""}
            </Text>
          </TouchableOpacity>
          <View style={styles.viewToggle}>
            {/* 📚 Sections (rayons par catégorie, style Instacart) */}
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "sections" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("sections")}
              activeOpacity={0.8}
              accessibilityLabel="Vue par rayons"
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === "sections" }}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "sections" && { color: brand.primary }]}>📚</Text>
            </TouchableOpacity>
            {/* ▤ Carte : 1 colonne, grandes cartes avec photo prominente */}
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "card" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("card")}
              activeOpacity={0.8}
              accessibilityLabel="Vue en cartes"
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === "card" }}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "card" && { color: brand.primary }]}>▤</Text>
            </TouchableOpacity>
            {/* ⊞ Grille : 2 colonnes compactes */}
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "grid" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("grid")}
              activeOpacity={0.8}
              accessibilityLabel="Vue en grille"
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === "grid" }}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "grid" && { color: brand.primary }]}>⊞</Text>
            </TouchableOpacity>
            {/* ☰ Liste : ligne compacte horizontale, image à gauche */}
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("list")}
              activeOpacity={0.8}
              accessibilityLabel="Vue en liste"
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === "list" }}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "list" && { color: brand.primary }]}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /** Pill "filtre marque actif" affichée juste sous la toolbar quand pertinent. */
  const renderActiveBrandPill = () => {
    if (selectedBrandId === null || !selectedBrandName) return null;
    return (
      <View style={styles.activeBrandFilterRow}>
        <View style={styles.activeBrandFilterPill}>
          <BrandChip
            name={selectedBrandName}
            logoUrl={selectedBrandLogoUrl}
            size="md"
            variant="inline"
          />
          <TouchableOpacity
            onPress={clearBrandFilter}
            style={styles.activeBrandFilterClear}
            accessibilityLabel="Retirer le filtre par marque"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.activeBrandFilterClearText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Chargement ────────────────────────────────────────────────────────────

  // Skeleton uniquement au tout 1er rendu (avant le 1er retour serveur).
  // Une fois `initialLoading=false`, les filtres/recherche ne re-déclenchent
  // PLUS le skeleton — la liste actuelle reste visible pendant la requête.
  if (initialLoading) {
    // Squelette aligné sur la nouvelle structure : hero 300px → bandeau identité
    // → pastilles → onglets → toolbar → grille produits. Préserve la position
    // de chaque bloc pour éviter le saut visuel lors de la résolution réelle.
    return (
      <View style={styles.container}>
        <Skeleton variant="rect" height={300} style={{ width: '100%' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#FFF' }}>
          <Skeleton variant="rect" width={48} height={48} style={{ borderRadius: 10 }} />
          <View style={{ flex: 1 }}>
            <Skeleton variant="text" width="55%" height={20} style={{ marginBottom: 6 }} />
            <Skeleton variant="text" width="85%" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF' }}>
          {[60, 80, 70, 90].map((w, i) => (
            <Skeleton key={i} variant="rect" width={w} height={28} style={{ borderRadius: 14 }} />
          ))}
        </View>
        <View style={{ padding: 12, paddingTop: 16 }}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={{
                backgroundColor: '#fff',
                borderRadius: 14,
                padding: 12,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }}
            >
              <Skeleton variant="rect" height={140} style={{ borderRadius: 10, marginBottom: 10 }} />
              <Skeleton variant="text" width="70%" style={{ marginBottom: 8 }} />
              <Skeleton variant="text" width="90%" style={{ marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Skeleton variant="text" width={80} />
                <Skeleton variant="circle" width={36} height={36} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  return (
    // EpicerieThemeProvider rend le branding de cette épicerie disponible à
    // tous les descendants via useEpicerieTheme(). Si epicerie est null ou
    // n'a pas de branding, le hook renvoie null → fallback thème AbridGO.
    // Zéro impact perf : memoization par identifiant + champs branding.
    <EpicerieThemeProvider epicerie={epicerie}>
      {selectedImageProduct?.photoUrl && (
        <ProductImageModal
          visible={showImageModal}
          photoUrl={selectedImageProduct.photoUrl}
          productName={selectedImageProduct.nom}
          onClose={() => { setShowImageModal(false); setSelectedImageProduct(null); }}
        />
      )}

      {epicerie?.presentationPhotoUrl && (
        <ProductImageModal
          visible={showBannerModal}
          photoUrl={epicerie.presentationPhotoUrl}
          productName={epicerie.nomEpicerie}
          onClose={() => setShowBannerModal(false)}
        />
      )}

      {epicerie && clientId && (
        <ChatbotModal
          visible={showChatbot}
          epicerieId={getEpicerieId()}
          epicerieName={epicerie.nomEpicerie}
          clientId={clientId}
          onClose={() => setShowChatbot(false)}
          onAddToCart={handleChatbotAddToCart}
        />
      )}

      <View style={styles.container}>
        {/* ── Tab Produits : Hero + identité + pastilles + tabs + toolbar
              dans le ListHeader → scroll naturel, place aux produits ── */}
        {activeTab === "products" && (
          <Animated.FlatList
            key={viewMode}
            data={viewMode === "sections" ? [] : displayedProducts}
            renderItem={viewMode === "grid"
              ? renderProductGrid
              : viewMode === "list"
                ? renderProduct
                : viewMode === "card"
                  ? renderProductCard
                  : () => null}
            numColumns={viewMode === "grid" ? 2 : 1}
            columnWrapperStyle={viewMode === "grid" ? styles.gridColumnWrapper : undefined}
            keyExtractor={(item: Product) => `product-${item.id}-${item.photoUrl || "no-photo"}`}
            contentContainerStyle={styles.listGrid}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            onEndReached={viewMode === "sections" ? undefined : handleLoadMore}
            onEndReachedThreshold={0.3}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
            ListHeaderComponent={
              <>
                {renderEpicerieHeader()}
                {/* Carousel des offres/paniers de cette epicerie. Auto-masque
                    si l'epicerie n'en a aucun publie — pas de placeholder. */}
                {epicerie?.id != null && (
                  <BundleOfferCarousel
                    mode="epicerie"
                    epicerieId={epicerie.id}
                    accent={brand.primary}
                  />
                )}
                {renderProductsToolbar()}
                {renderActiveBrandPill()}
                {viewMode === "sections" && (
                  <ProductSectionsView
                    products={displayedProducts}
                    accentColor={brand.primary}
                    renderCard={(p) => renderProductGrid({ item: p } as any)}
                    cardWidth={180}
                    labels={{
                      seeAll: t("epicerieDetail.sectionsSeeAll"),
                      emptyState: t("products.noProductsFound"),
                      uncategorized: t("epicerieDetail.sectionsUncategorized"),
                    }}
                    onSeeAllCategory={(_, catId) => {
                      if (catId != null) handleCategorySelect(catId);
                      setViewMode("grid");
                    }}
                  />
                )}
              </>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <ActivityIndicator size="small" color="#4CAF50" />
                </View>
              ) : hasMore && viewMode !== "sections" ? (
                <View style={{ paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ color: "#aaa", fontSize: 12 }}>
                    {products.length} / {totalProducts} produits
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              viewMode === "sections" ? null : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🔍</Text>
                  <Text style={styles.emptyText}>{t("products.noProductsFound")}</Text>
                  <Text style={styles.emptySubtext}>
                    {(searchQuery || selectedCategoryId !== null) && !loading
                      ? t("epicerieDetail.tryOtherFilters")
                      : t("epicerieDetail.noProductsYet")}
                  </Text>
                  {(searchQuery || selectedCategoryId !== null || selectedTagIds.length > 0 || selectedBrandId !== null) && !loading && (
                    <TouchableOpacity
                      style={styles.resetFiltersBtn}
                      onPress={resetAllFilters}
                    >
                      <Text style={styles.resetFiltersBtnText}>{t("epicerieDetail.clearFilters")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            }
          />
        )}

        {/* ── Tab Avis : rating + placeholder commentaires (V102 phase 1) ── */}
        {activeTab === "reviews" && epicerie && (
          <Animated.ScrollView
            style={{ flex: 1, backgroundColor: "#FAFAFA" }}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
          >
            {renderEpicerieHeader()}
            {(() => {
              // Moyenne et total : on privilégie les stats fraîches du endpoint
              // /average ; fallback sur les champs embarqués dans l'épicerie.
              const avg = reviewStats?.averageRating ?? epicerie.averageRating ?? 0;
              const total = reviewStats?.totalRatings ?? epicerie.totalRatings ?? 0;
              const dist: { stars: number; count: number }[] = reviewStats
                ? [
                    { stars: 5, count: reviewStats.fiveStarCount },
                    { stars: 4, count: reviewStats.fourStarCount },
                    { stars: 3, count: reviewStats.threeStarCount },
                    { stars: 2, count: reviewStats.twoStarCount },
                    { stars: 1, count: reviewStats.oneStarCount },
                  ]
                : [];
              return (
                <View style={styles.tabBodyPadding}>
                  {/* Carte résumé : moyenne + étoiles + total + distribution */}
                  <View style={styles.reviewsSummaryCard}>
                    <Text style={styles.reviewsBigRating}>{avg.toFixed(1)}</Text>
                    <Text style={styles.reviewsStars}>{renderStars(avg)}</Text>
                    <Text style={styles.reviewsCount}>
                      {total} {t("epicerieDetail.reviews")}
                    </Text>
                    {reviewStats && reviewStats.recommendationPercentage > 0 && (
                      <Text style={styles.reviewsRecommend}>
                        👍 {t("epicerieDetail.reviewsRecommend")
                          .replace("{{percent}}", String(Math.round(reviewStats.recommendationPercentage)))}
                      </Text>
                    )}
                    {dist.length > 0 && total > 0 && (
                      <View style={styles.reviewsDistribution}>
                        {dist.map(({ stars, count }) => (
                          <View key={stars} style={styles.reviewsDistRow}>
                            <Text style={styles.reviewsDistLabel}>{stars} ⭐</Text>
                            <View style={styles.reviewsDistBarBg}>
                              <View
                                style={[
                                  styles.reviewsDistBarFill,
                                  { width: `${total > 0 ? (count / total) * 100 : 0}%`, backgroundColor: brand.primary },
                                ]}
                              />
                            </View>
                            <Text style={styles.reviewsDistCount}>{count}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Liste des avis / loading / état vide */}
                  {reviewsLoading && !reviewsLoaded ? (
                    <View style={styles.reviewsEmpty}>
                      <ActivityIndicator color={brand.primary} />
                      <Text style={[styles.reviewsEmptyText, { marginTop: 10 }]}>
                        {t("epicerieDetail.reviewsLoading")}
                      </Text>
                    </View>
                  ) : reviews.length > 0 ? (
                    <>
                      <Text style={styles.reviewsListTitle}>
                        💬 {t("epicerieDetail.reviewsListTitle")}
                      </Text>
                      {reviews.map((rev, idx) => {
                        const name = rev.clientName?.trim() || t("epicerieDetail.reviewsAnonymous");
                        const initial = name.charAt(0).toUpperCase();
                        const date = formatReviewDate(rev.createdAt);
                        return (
                          <View key={rev.id ?? idx} style={styles.reviewCard}>
                            <View style={styles.reviewHeader}>
                              {rev.clientPhotoUrl ? (
                                <Image source={{ uri: rev.clientPhotoUrl }} style={styles.reviewAvatar} />
                              ) : (
                                <View style={[styles.reviewAvatar, styles.reviewAvatarFallback, { backgroundColor: brand.primary }]}>
                                  <Text style={styles.reviewAvatarInitial}>{initial}</Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={styles.reviewName} numberOfLines={1}>{name}</Text>
                                {date ? <Text style={styles.reviewDate}>{date}</Text> : null}
                              </View>
                              <Text style={styles.reviewStars}>{renderStars(rev.rating)}</Text>
                            </View>
                            {rev.comment?.trim() ? (
                              <Text style={styles.reviewComment}>{rev.comment.trim()}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </>
                  ) : (
                    <View style={styles.reviewsEmpty}>
                      <Text style={styles.reviewsEmptyTitle}>
                        💬 {t("epicerieDetail.reviewsEmptyTitle")}
                      </Text>
                      <Text style={styles.reviewsEmptyText}>
                        {t("epicerieDetail.reviewsEmptyText")}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </Animated.ScrollView>
        )}

        {/* ── Tab Infos : description, gérant, adresse, horaires, contact, fidélité, WhatsApp ── */}
        {activeTab === "info" && epicerie && (
          <Animated.ScrollView
            style={{ flex: 1, backgroundColor: "#FAFAFA" }}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
          >
            {renderEpicerieHeader()}
            <View style={styles.tabBodyPadding}>
              {epicerie.description && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>
                    ℹ️ {t("epicerieDetail.infoDescriptionTitle")}
                  </Text>
                  <ExpandableText
                    numberOfLines={3}
                    expandLabel={t("epicerieDetail.seeMore")}
                    collapseLabel={t("epicerieDetail.seeLess")}
                    textStyle={styles.infoSectionText}
                    accentColor={brand.primary}
                  >
                    {epicerie.description}
                  </ExpandableText>
                </View>
              )}

              {/* Carte fidélité — migrée depuis l'ancienne storeInfoCard du tab Produits */}
              {loyaltyBalance && loyaltyBalance.balance > 0 && (
                <TouchableOpacity
                  style={styles.loyaltyBadge}
                  onPress={() => router.push({ pathname: '/(client)/fidelite-detail' as any, params: { epicerieId: String(getEpicerieId()) } })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loyaltyBadgeIcon}>⭐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loyaltyBadgeLabel}>{loyaltyBalance.programName ?? 'Fidélité'}</Text>
                    <Text style={styles.loyaltyBadgePoints}>
                      {loyaltyBalance.balance} {loyaltyBalance.programType === 'STAMPS' ? 'tampons' : 'points'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22, color: '#F57C00', fontWeight: '700' }}>›</Text>
                </TouchableOpacity>
              )}

              {(epicerie.nomGerant || epicerie.prenomGerant) && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>
                    👤 {t("epicerieDetail.infoOwnerTitle")}
                  </Text>
                  <Text style={styles.infoSectionText}>
                    {[epicerie.prenomGerant, epicerie.nomGerant].filter(Boolean).join(" ")}
                  </Text>
                  {epicerie.averageRating != null && epicerie.averageRating > 0 && (
                    <View style={styles.ratingContainer}>
                      <Text style={styles.starsText}>{renderStars(epicerie.averageRating || 0)}</Text>
                      <Text style={styles.ratingText}>{(epicerie.averageRating || 0).toFixed(1)}</Text>
                      <Text style={styles.totalRatingsText}>
                        ({epicerie.totalRatings || 0} {t("epicerieDetail.reviews")})
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity onPress={openGoogleMaps} style={styles.infoSection} activeOpacity={0.7}>
                <Text style={styles.infoSectionTitle}>
                  📍 {t("epicerieDetail.address")}
                </Text>
                <Text style={styles.infoSectionText}>{epicerie.adresse}</Text>
                <Text style={[styles.infoSectionLink, { color: brand.primary }]}>
                  📲 {t("epicerieDetail.openInMaps")} ›
                </Text>
              </TouchableOpacity>

              {/* Horaires complets de la semaine */}
              {(() => {
                const sched = parseHoraires(epicerie.horaires);
                if (!sched) return null;
                const todayKey = DAY_KEYS[new Date().getDay()];
                const orderedDays: typeof DAY_KEYS[number][] = [
                  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
                ];
                return (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoSectionTitle}>
                      🕐 {t("epicerieDetail.weeklyHoursTitle")}
                    </Text>
                    {orderedDays.map((dayKey) => {
                      const day = sched[dayKey];
                      const isToday = dayKey === todayKey;
                      const dayLabel = t(`epicerieDetail.day_${dayKey}`);
                      const hoursLabel = !day
                        ? '—'
                        : day.isOpen === false
                          ? t('epicerieDetail.closedDay')
                          : day.openTime && day.closeTime
                            ? `${formatTimeShort(day.openTime)} – ${formatTimeShort(day.closeTime)}`
                            : '—';
                      return (
                        <View
                          key={dayKey}
                          style={[
                            styles.hoursRow,
                            isToday && { backgroundColor: brand.primarySubtle },
                          ]}
                        >
                          <Text style={[
                            styles.hoursDay,
                            isToday && { fontWeight: '800', color: brand.primary },
                          ]}>
                            {dayLabel}{isToday ? ` · ${t('epicerieDetail.todayMarker')}` : ''}
                          </Text>
                          <Text style={[
                            styles.hoursTime,
                            isToday && { fontWeight: '700', color: brand.primary },
                            day?.isOpen === false && styles.hoursClosed,
                          ]}>
                            {hoursLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

              {epicerie.telephonePro && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${epicerie.telephonePro}`)}
                  style={styles.infoSection}
                  activeOpacity={0.7}
                >
                  <Text style={styles.infoSectionTitle}>
                    📞 {t("epicerieDetail.infoContactTitle")}
                  </Text>
                  <Text style={[styles.infoSectionText, { color: brand.primary }]}>
                    {epicerie.telephonePro}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Lien WhatsApp — utilise le marqueur legacy #EID:42 (toujours
                  supporté côté backend). Pour pré-remplir un panier construit
                  dans l'app, voir le bouton "Finir sur WhatsApp" dans cart.tsx
                  qui utilise les nouveaux Shop Link tokens (EG-XXX) via
                  shopLinkService.createPrecart. Ici, le client n'a encore
                  rien construit, donc le simple deep link suffit. */}
              {canUseAssistedOrdering && epicerie.whatsappEnabled && epicerie.whatsappPhone && (
                <TouchableOpacity
                  style={styles.whatsappInfoRow}
                  onPress={() => {
                    const phone = epicerie.whatsappPhone!.replace(/[^0-9+]/g, "").replace("+", "");
                    const message = encodeURIComponent(
                      `Bonjour, je souhaite passer une commande chez ${epicerie.nomEpicerie} #EID:${epicerie.id}`
                    );
                    Linking.openURL(`https://wa.me/${phone}?text=${message}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.whatsappInfoIcon}>💬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whatsappInfoLabel}>Commander par WhatsApp</Text>
                    <Text style={styles.whatsappInfoHint}>Envoyez votre liste par texte ou audio</Text>
                  </View>
                  <Text style={styles.whatsappInfoArrow}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.ScrollView>
        )}

        {/* ── Mini-header collapsable : apparait au scroll au-delà du hero ──
              Reçoit la 2e instance de la loupe (la 1ère vit dans le hero) — quand
              l'utilisateur a scrollé au-delà du hero, il n'a plus accès à la
              loupe du hero, donc on lui en donne une ici. */}
        <Animated.View
          style={[
            styles.miniHeader,
            {
              backgroundColor: brand.primary,
              opacity: scrollY.interpolate({
                inputRange: [180, 280],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
              transform: [{
                translateY: scrollY.interpolate({
                  inputRange: [180, 280],
                  outputRange: [-50, 0],
                  extrapolate: "clamp",
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.miniHeaderBackBtn}
            onPress={() => router.back()}
            hitSlop={6}
          >
            <Ionicons name="chevron-back" size={22} color={brand.onPrimary} />
          </TouchableOpacity>
          <Text style={[styles.miniHeaderTitle, { color: brand.onPrimary }]} numberOfLines={1}>
            {epicerie?.nomEpicerie}
          </Text>
          <View style={styles.miniHeaderRightGroup}>
            {epicerie && epicerie.averageRating != null && epicerie.averageRating > 0 && (
              <Text style={[styles.miniHeaderRating, { color: brand.onPrimary }]}>
                ⭐ {epicerie.averageRating.toFixed(1)}
              </Text>
            )}
            <TouchableOpacity
              style={styles.miniHeaderSearchBtn}
              onPress={() => setSearchVisible(true)}
              hitSlop={6}
            >
              <Ionicons name="search" size={20} color={brand.onPrimary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Bouton WhatsApp flottant — réservé aux clients enregistrés de cette épicerie */}
        {epicerie && canUseAssistedOrdering && epicerie.whatsappEnabled && epicerie.whatsappPhone && (
          <TouchableOpacity
            style={[
              styles.whatsappFab,
              // Surélever si la StickyMiniCart est visible pour cette épicerie
              // (panier non vide) — sinon le FAB chevaucherait la barre.
              (currentEpicerieCart?.itemCount ?? 0) > 0 && styles.whatsappFabWithCart,
            ]}
            onPress={() => {
              const phone = epicerie.whatsappPhone!.replace(/[^0-9+]/g, "").replace("+", "");
              const message = encodeURIComponent(
                `Bonjour, je souhaite commander chez ${epicerie.nomEpicerie} #EID:${epicerie.id}`
              );
              Linking.openURL(`https://wa.me/${phone}?text=${message}`);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.whatsappFabIcon}>💬</Text>
            <Text style={styles.whatsappFabLabel}>WhatsApp</Text>
          </TouchableOpacity>
        )}

        {/* Bouton chatbot flottant — réservé aux clients enregistrés de cette épicerie */}
        {epicerie && clientId && canUseAssistedOrdering && (
          <TouchableOpacity
            style={[
              styles.chatbotButton,
              // Surélever le FAB chatbot si la StickyMiniCart est visible
              // (panier non vide pour CETTE épicerie) — sinon il chevaucherait
              // la barre flottante en bas.
              (currentEpicerieCart?.itemCount ?? 0) > 0 && { bottom: 110 },
            ]}
            onPress={() => setShowChatbot(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.chatbotButtonText}>🤖</Text>
            <Text style={styles.chatbotButtonLabel}>{t("epicerieDetail.aiAssistant")}</Text>
          </TouchableOpacity>
        )}

        {/* ── Mini-cart sticky en bas — visible dès le 1er article au panier ── */}
        <StickyMiniCart
          itemCount={currentEpicerieCart?.itemCount ?? 0}
          subtotalLabel={formatPrice(currentEpicerieCart?.subtotal ?? 0)}
          itemsLabel={t("epicerieDetail.stickyCartItems")
            .replace("{{count}}", String(currentEpicerieCart?.itemCount ?? 0))}
          ctaLabel={t("epicerieDetail.stickyCartCta")}
          onPress={() => router.push("/(client)/cart")}
          backgroundColor={brand.primary}
          textColor={brand.onPrimary}
        />

        {/* ── Barre de recherche slide-down ── Rendue par-dessus tout via
              position absolute pour ne pas pousser le contenu en-dessous. */}
        <View style={styles.searchRevealLayer} pointerEvents={searchVisible ? 'auto' : 'box-none'}>
          <EpicerieSearchReveal
            visible={searchVisible}
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onClose={() => setSearchVisible(false)}
            onClear={handleSearchClear}
            placeholder={t("epicerieDetail.searchProduct")}
            history={searchHistory}
            onHistoryPick={handleHistoryPick}
            onHistoryRemove={handleHistoryRemove}
            accentColor={brand.primary}
            labels={{ recentSearches: t("epicerieDetail.recentSearches") }}
          />
        </View>
      </View>

      {/* ── Bottom-sheet Filtres unifiée : catégories + tags + marque active ── */}
      <EpicerieFiltersSheet
        visible={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        categories={flatCategories.map((c) => {
          const catPromo = bestPromoForCategory(activePromos, c.id);
          return {
            id: c.id,
            name: c.name,
            icon: getCategoryIcon(c.name),
            promoPct: catPromo?.reductionPercentage,
          };
        })}
        tags={availableTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        }))}
        activeBrand={
          selectedBrandId !== null && selectedBrandName
            ? { id: selectedBrandId, name: selectedBrandName, logoUrl: selectedBrandLogoUrl }
            : null
        }
        selectedCategoryId={selectedCategoryId}
        selectedTagIds={selectedTagIds}
        onApply={handleFiltersApply}
        onClearBrand={clearBrandFilter}
        accentColor={brand.primary}
        accentOnColor={brand.onPrimary}
        labels={{
          title: t("epicerieDetail.filters") || "Filtres",
          categoriesTitle: t("epicerieDetail.categories"),
          tagsTitle: t("epicerieDetail.tags") || "Tags",
          brandTitle: t("epicerieDetail.brand") || "Marque",
          findCategory: t("epicerieDetail.findCategory"),
          apply: t("epicerieDetail.applyFilters") || "Appliquer",
          reset: t("epicerieDetail.resetFilters") || "Réinitialiser",
          allCategories: t("epicerieDetail.allProducts"),
          removeBrandFilter: t("epicerieDetail.removeBrandFilter") || "Retirer",
        }}
      />

      {/* Modal sélection unité */}
      {selectedProductForCart && (
        <Modal
          visible={showUnitSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => { setShowUnitSelector(false); setSelectedProductForCart(null); }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedProductForCart.nom}</Text>
              <TouchableOpacity onPress={() => { setShowUnitSelector(false); setSelectedProductForCart(null); }}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
              <ProductUnitDisplay
                product={selectedProductForCart}
                onAddToCart={handleAddToCartWithUnit}
                promo={bestPromoForProduct(activePromos, selectedProductForCart)}
              />
            </ScrollView>
          </View>
        </Modal>
      )}
    </EpicerieThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },

  /* === Refonte V102 — Toolbar Produits, body tabs, search reveal === */
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEE",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  toolbarCount: { fontSize: 12, fontWeight: "500", color: "#737373" },
  toolbarActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolbarFiltersBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
  },
  toolbarFiltersText: { fontSize: 12, fontWeight: "700", color: "#1F1F1F" },

  /** Padding du corps des tabs Avis et Infos (le header commun n'a pas de padding pour
   *  laisser le hero pleine largeur). */
  tabBodyPadding: { padding: 20 },

  /** Couche absolute qui héberge la barre de recherche révélée. Au repos
   *  on laisse passer les touches en-dessous grâce à pointerEvents="box-none". */
  searchRevealLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 12,
  },

  /* === Mini-header sticky : ajout de boutons back + loupe === */
  miniHeaderBackBtn: { padding: 4, marginRight: 6 },
  miniHeaderSearchBtn: { padding: 4, marginLeft: 8 },
  miniHeaderRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  /* === Rating utilisés dans l'onglet Infos (sous le gérant) === */
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  starsText: { fontSize: 14 },
  ratingText: { fontSize: 15, fontWeight: "bold", color: "#FFB300" },
  totalRatingsText: { fontSize: 12, color: "#999" },

  /* === Toggle de vue (sections / list / grid) === */
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  viewToggleBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  viewToggleIcon: { fontSize: 18, color: "#aaa" },
  viewToggleIconActive: { color: "#4CAF50" },

  /* === LISTE === */
  list: { padding: 12, paddingTop: 8 },
  // paddingBottom élargi pour laisser respirer le dernier produit sous la
  // StickyMiniCart (~90px de haut avec safe area iOS). Évite que le bouton
  // "Ajouter" du dernier item soit masqué par la barre flottante.
  listGrid: { paddingTop: 8, paddingBottom: 110 },
  listCard: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 110 },

  /* === CARTE (vue par défaut) === */
  bigCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  bigCardImage: {
    height: 230,
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  bigCardImg: { width: "100%", height: "100%" },
  bigCardPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  bigCardSpinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  bigCardStock: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  bigCardStockText: { fontSize: 12, fontWeight: "700" },
  bigCardInfo: {
    flexDirection: "column",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  bigCardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bigCardDetailsBtn: {
    flex: 1,
    backgroundColor: "#f0f9f0",
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bigCardDetailsBtnText: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "700",
  },
  bigCardName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  bigCardCatChip: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    maxWidth: "70%",
  },
  bigCardCatIcon: { fontSize: 12 },
  bigCardCatLabel: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
    flexShrink: 1,
  },
  bigCardPrice: { fontSize: 18, fontWeight: "800", color: "#2E7D32" },
  bigCardPricePromo: { color: "#e53935" },
  bigCardPrixBarre: { fontSize: 12, color: "#999", textDecorationLine: "line-through", textAlign: "right" },
  bigCardBtn: {
    backgroundColor: "#4CAF50",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bigCardBtnOos: { backgroundColor: "#e0e0e0" },

  /* === GRILLE colonne === */
  gridColumnWrapper: {
    paddingHorizontal: 12,
    gap: 8,
  },

  /* === CARTE PRODUIT — MODE GRILLE ===
     Style e-commerce moderne (AliExpress / Amazon) : carrés nets, bordure
     fine visible, pas d'ombre. Privilégie la densité d'info au "fluff" visuel. */
  gridCard: {
    width: (SCREEN_WIDTH - 32) / 2,
    backgroundColor: "#fff",
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  gridImageSection: {
    height: 160,
    position: "relative",
    backgroundColor: "#f5f5f5",
  },
  gridImage: { width: "100%", height: "100%" },
  gridImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  gridPlaceholderEmoji: { fontSize: 46 },
  gridImageSpinner: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  /* Overlay au bas de l'image */
  gridOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  gridDetailBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  gridDetailBtnIcon: { fontSize: 13 },
  gridOverlaySep: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 6,
  },
  // ── Wrapper des pastilles méta (#3+#4) ─────────────────────────────────
  // Espace généreux en bas pour décoller visuellement du storeInfoCard qui
  // suit (V1 collait → effet "tapée" sur la carte). Background blanc en
  // haut + transparent en bas pour intégrer dans le scroll du hero.
  metaPillsWrapper: {
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },

  // ── Liste hebdomadaire des horaires dans le tab Info ──────────────────
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  hoursDay: { fontSize: 14, color: "#374151", fontWeight: "600" },
  hoursTime: { fontSize: 14, color: "#1f2937", fontWeight: "600", fontVariant: ["tabular-nums"] },
  hoursClosed: { color: "#9CA3AF", fontStyle: "italic" },

  // ── #6 Mini-header sticky qui apparait au scroll ──────────────────────
  // Position absolute en haut du container. Apparait via opacity + translateY
  // interpolés depuis la scroll position de la FlatList (cf. Animated.event).
  miniHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 50,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  miniHeaderTitle: { fontSize: 16, fontWeight: "800", flex: 1, letterSpacing: -0.2 },
  miniHeaderRating: { fontSize: 14, fontWeight: "700", marginLeft: 12 },

  // ── Tab Avis ──────────────────────────────────────────────────────────
  reviewsSummaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 22,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reviewsBigRating: { fontSize: 48, fontWeight: "800", color: "#1a1a1a" },
  reviewsStars: { fontSize: 22, marginTop: 2 },
  reviewsCount: { fontSize: 13, color: "#888", marginTop: 6 },
  reviewsEmpty: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reviewsEmptyTitle: { fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 6 },
  reviewsEmptyText: { fontSize: 13, color: "#777", textAlign: "center", lineHeight: 18 },
  reviewsRecommend: { fontSize: 13, fontWeight: "700", color: "#2E7D32", marginTop: 8 },
  // Distribution par étoiles
  reviewsDistribution: { width: "100%", marginTop: 16, gap: 6 },
  reviewsDistRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewsDistLabel: { fontSize: 12, color: "#666", width: 34 },
  reviewsDistBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#EEE", overflow: "hidden" },
  reviewsDistBarFill: { height: "100%", borderRadius: 4 },
  reviewsDistCount: { fontSize: 12, color: "#888", width: 28, textAlign: "right" },
  // Liste des avis
  reviewsListTitle: { fontSize: 15, fontWeight: "800", color: "#1a1a1a", marginBottom: 10 },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEE" },
  reviewAvatarFallback: { alignItems: "center", justifyContent: "center" },
  reviewAvatarInitial: { color: "#fff", fontSize: 16, fontWeight: "800" },
  reviewName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  reviewDate: { fontSize: 11, color: "#999", marginTop: 1 },
  reviewStars: { fontSize: 13 },
  reviewComment: { fontSize: 13, color: "#444", lineHeight: 19, marginTop: 10 },

  // ── Tab Infos ─────────────────────────────────────────────────────────
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  infoSectionTitle: { fontSize: 13, fontWeight: "700", color: "#666", marginBottom: 6, letterSpacing: 0.3 },
  infoSectionText: { fontSize: 15, color: "#1a1a1a", lineHeight: 22 },
  infoSectionLink: { fontSize: 13, fontWeight: "600", marginTop: 8 },

  // Wrapper de l'InlineQuantitySelector dans l'overlay grille — garde
  // l'équilibre flex:1 avec le bouton Détails à gauche du séparateur.
  // Le selector a sa taille intrinsèque (pill ~36px) ; on centre dedans.
  gridQtyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  gridAddBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
  },
  gridAddBtnOos: { backgroundColor: "#9E9E9E" },
  gridAddBtnIcon: { fontSize: 13 },
  gridOverlayBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  /* Section info */
  gridInfoSection: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  gridProductName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
    lineHeight: 18,
    marginBottom: 5,
  },
  gridCategoryChip: {
    alignSelf: "flex-start",
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 8,
  },
  gridCategoryText: {
    fontSize: 10,
    color: "#888",
    fontWeight: "600",
  },
  // Active brand filter pill (top of products list)
  activeBrandFilterRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  activeBrandFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#E3F2FD",
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: "#BBDEFB",
  },
  activeBrandFilterClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1565C0",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  activeBrandFilterClearText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 12,
  },
  gridBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  gridProductPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4CAF50",
  },
  gridProductPricePromo: { color: "#e53935" },
  gridPrixBarre: { fontSize: 11, color: "#999", textDecorationLine: "line-through" },
  gridPromoBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 2,
  },
  gridPromoTitle: {
    fontSize: 10,
    color: "#C62828",
    fontWeight: "700",
    marginTop: 2,
  },
  gridStockBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  gridStockText: {
    fontSize: 9,
    fontWeight: "700",
  },

  /* === CARTE PRODUIT — MODE LISTE ===
     Style e-commerce moderne : flat + bordure fine visible, pas d'ombre. */
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productImageContainer: {
    width: 76, height: 76, backgroundColor: "#f5f5f5", borderRadius: 4,
    marginRight: 12, overflow: "hidden", justifyContent: "center", alignItems: "center", position: "relative",
  },
  productImage: { width: "100%", height: "100%" },
  zoomIconOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center",
  },
  zoomIcon: { fontSize: 22 },
  imageLoadingSpinner: { position: "absolute", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" },
  productEmojiInContainer: { fontSize: 38 },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 3, lineHeight: 19 },
  productCategory: { fontSize: 11, color: "#aaa", marginBottom: 5, fontWeight: "500" },
  productPrice: { fontSize: 17, fontWeight: "bold", color: "#4CAF50", marginBottom: 3 },
  productPricePromo: { color: "#e53935" },
  productPrixBarre: { fontSize: 12, color: "#999", textDecorationLine: "line-through", marginBottom: 1 },
  productPromoTitle: { fontSize: 11, color: "#C62828", fontWeight: "700", marginBottom: 2 },
  listPromoBadge: { position: "absolute", top: 4, left: 4, zIndex: 2 },
  productStock: { fontSize: 11, color: "#ccc", marginBottom: 3 },
  seeMoreText: { fontSize: 11, color: "#4CAF50", fontWeight: "600" },
  addButton: {
    backgroundColor: "#4CAF50", width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginLeft: 8,
    shadowColor: "#4CAF50", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 3,
  },
  addButtonOos: { backgroundColor: "#e0e0e0", shadowOpacity: 0 },

  /* === CARTE EPICIER-STYLE (mode card) ===
     Même refonte e-commerce moderne : bordure fine, radius minimal, flat. */
  epicCardWrapper: {
    backgroundColor: '#fff',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  epicCardImageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  epicCardBody: {
    padding: 15,
  },
  epicCardImg: {
    width: '100%',
    height: '100%',
  },
  epicCardImgPlaceholder: {
    fontSize: 48,
  },
  epicCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  epicCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  epicCardDesc: {
    fontSize: 13,
    color: '#777',
    lineHeight: 18,
  },
  epicCardPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  epicCardPrixBarre: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  epicCardPromoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  epicCardPromoTitle: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '700',
    marginTop: 4,
  },
  epicCardCatRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  epicCardCatBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  epicCardCatText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  epicCardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  epicCardTagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  epicCardTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  epicCardBrandRow: {
    marginBottom: 8,
  },
  epicCardBrandText: {
    fontSize: 12,
    color: '#9C27B0',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  epicCardMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  epicCardMetaBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  epicCardMetaText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  epicCardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  epicCardDetailsBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  epicCardDetailsBtnText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  epicCardCartBtn: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  epicCardCartBtnOos: {
    backgroundColor: '#bdbdbd',
    shadowOpacity: 0,
  },
  epicCardCartBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* === VIDE === */
  emptyContainer: { alignItems: "center", marginTop: 50, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 60, marginBottom: 16, opacity: 0.7 },
  emptyText: { fontSize: 17, fontWeight: "bold", color: "#333", marginBottom: 8, textAlign: "center" },
  emptySubtext: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20, marginBottom: 16 },
  resetFiltersBtn: {
    backgroundColor: "#e8f5e9", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20,
    borderWidth: 1, borderColor: "#4CAF50",
  },
  resetFiltersBtnText: { color: "#4CAF50", fontWeight: "600", fontSize: 14 },

  /* === WHATSAPP INFO ROW === */
  whatsappInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#E8F5E9", borderRadius: 10,
    padding: 12, marginTop: 10,
  },
  whatsappInfoIcon: { fontSize: 24 },
  whatsappInfoLabel: { fontSize: 14, fontWeight: "700", color: "#25D366" },
  whatsappInfoHint: { fontSize: 12, color: "#666", marginTop: 2 },
  whatsappInfoArrow: { fontSize: 24, color: "#25D366", fontWeight: "bold" },

  /* === WHATSAPP FAB === */
  whatsappFab: {
    position: "absolute", bottom: 20, left: 16,
    backgroundColor: "#25D366", borderRadius: 28,
    paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 8,
    gap: 7,
  },
  whatsappFabWithCart: { bottom: 110 },
  whatsappFabIcon: { fontSize: 22 },
  whatsappFabLabel: { color: "#fff", fontSize: 13, fontWeight: "bold" },

  /* === CHATBOT === */
  chatbotButton: {
    position: "absolute", bottom: 20, right: 16,
    backgroundColor: "#4CAF50", borderRadius: 28,
    paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 8,
    gap: 7,
  },
  chatbotButtonText: { fontSize: 22 },
  chatbotButtonLabel: { color: "#fff", fontSize: 13, fontWeight: "bold" },

  /* === MODAL === */
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#e0e0e0",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#333" },
  modalCloseButton: { fontSize: 26, color: "#666" },
  modalScrollView: { flex: 1 },
  modalScrollContent: { paddingBottom: 20 },

  /* === DIVERS === */
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* === LOYALTY BADGE === */
  loyaltyBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff8e1", borderRadius: 10, padding: 12,
    marginTop: 10, borderWidth: 1, borderColor: "#ffe082",
  },
  loyaltyBadgeIcon: { fontSize: 22 },
  loyaltyBadgeLabel: { fontSize: 11, color: "#e65100", fontWeight: "600" },
  loyaltyBadgePoints: { fontSize: 18, fontWeight: "900", color: "#e65100" },
});
