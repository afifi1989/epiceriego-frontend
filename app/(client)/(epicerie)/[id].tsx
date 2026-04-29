import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
import { ProductUnitDisplay } from "../../../components/client/ProductUnitDisplay";
import { ProductImageModal } from "../../../src/components/client/ProductImageModal";
import { FallbackImage } from "../../../components/client/FallbackImage";
import { ChatbotModal } from "../../../src/components/client/ChatbotModal";
import { useLanguage } from "../../../src/context/LanguageContext";
import { cartService } from "../../../src/services/cartService";
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
import { promotionService, Promotion } from "../../../src/services/promotionService";
import { PromoProductBadge } from "../../../src/features/promotions/components";
import {
  activePromosForEpicerie,
  bestPromoForCategory,
  bestPromoForProduct,
  effectivePriceForProduct,
} from "../../../src/features/promotions/utils";

export default function EpicerieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { setCurrency } = useCurrency();

  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [selectedProductForCart, setSelectedProductForCart] = useState<Product | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageProduct, setSelectedImageProduct] = useState<Product | null>(null);
  const [imageLoadingState, setImageLoadingState] = useState<{ [key: number]: boolean }>({});
  const [imageErrorState, setImageErrorState] = useState<{ [key: number]: boolean }>({});
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  // Gates the WhatsApp + AI chatbot entry points. Resolved once we know both the
  // current user and the epicerie id. Fail-closed on error (see the hook).
  const { isClient: isClientOfEpicerie, ready: clientStatusReady } = useEpicerieClientStatus(
    clientId,
    typeof id === "string" ? parseInt(id, 10) : id ? parseInt(id[0], 10) : null,
  );
  const canUseAssistedOrdering = clientStatusReady && isClientOfEpicerie;
  const [viewMode, setViewMode] = useState<"card" | "list" | "grid">("card");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);

  // Load loyalty balance when store loads
  useEffect(() => {
    if (id && canUseAssistedOrdering) {
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      loyaltyService.getMyBalanceAtStore(epicerieId)
        .then(b => b.isActive ? setLoyaltyBalance(b) : null)
        .catch(() => {});
    }
  }, [id, canUseAssistedOrdering]);

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
    }
  }, [getEpicerieId]);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await categoryService.getCategoriesByEpicerie(getEpicerieId());
      setCategories(data);
    } catch (error) {
      Alert.alert(t("common.error"), String(error));
    } finally {
      setLoading(false);
    }
  }, [getEpicerieId, t]);

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

  const handleTagToggle = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId];
      loadProducts(0, searchQuery, selectedCategoryIds, false, next);
      return next;
    });
  }, [searchQuery, selectedCategoryIds, loadProducts]);

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

  // Chargement initial uniquement quand l'ID change
  useEffect(() => {
    if (id) {
      setSearchQuery("");
      setSelectedCategoryId(null);
      setSelectedTagIds([]);
      setProducts([]);
      loadEpicerieInfo();
      loadCategories();
      loadTags();
      loadActivePromos();
      loadProducts(0, "", undefined, false);
    }
  }, [id]);

  // Au focus : recharge uniquement le panier (données légères qui changent souvent)
  // Les produits/catégories sont mis en cache et ne nécessitent pas d'être rechargés
  useFocusEffect(
    useCallback(() => {
      cartService.getCart().then(setCart).catch(() => {});
    }, []),
  );

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
    setShowCategoryModal(false);
    setCategorySearch("");
    const catIds = catId === null
      ? undefined
      : (() => {
          const cat = flatCategories.find((c) => c.id === catId);
          return cat ? getCategoryIdsRecursive(cat) : [catId];
        })();
    // isSearch=false → spinner principal pour un feedback visuel clair
    loadProducts(0, searchQuery, catIds, false, selectedTagIds);
  }, [flatCategories, getCategoryIdsRecursive, searchQuery, selectedTagIds, loadProducts]);

  // ── Recherche déclenchée manuellement (bouton ou clavier "Rechercher") ────

  const handleSearchSubmit = useCallback(() => {
    loadProducts(0, searchQuery, selectedCategoryIds, false, selectedTagIds);
  }, [searchQuery, selectedCategoryIds, selectedTagIds, loadProducts]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    loadProducts(0, "", selectedCategoryIds, false, selectedTagIds);
  }, [selectedCategoryIds, selectedTagIds, loadProducts]);

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

  const addToCartDirect = async (product: Product) => {
    try {
      const cartItem: CartItem = {
        itemType: "PRODUCT",
        productId: product.id,
        productNom: product.nom,
        epicerieId: product.epicerieId,
        quantity: 1,
        unitId: undefined,
        unitLabel: t("products.piece") || t("products.addQuantity"),
        pricePerUnit: product.prix,
        totalPrice: product.prix,
        photoUrl: product.photoUrl,
      };
      const updatedCart = await cartService.addToCart(cartItem);
      setCart(updatedCart);
      Alert.alert("✅", t("products.addedToCart"));
    } catch {
      Alert.alert(t("common.error"), t("products.errorAdding"));
    }
  };

  const handleAddToCartWithUnit = async (
    unitId: number,
    quantity: number,
    totalPrice: number,
    unit: ProductUnit,
  ) => {
    if (!selectedProductForCart) return;
    try {
      const cartItem: CartItem = {
        itemType: "PRODUCT",
        productId: selectedProductForCart.id,
        productNom: selectedProductForCart.nom,
        epicerieId: selectedProductForCart.epicerieId,
        unitId,
        unitLabel: unit.label,
        quantity,
        requestedQuantity: quantity,
        pricePerUnit: unit.prix,
        totalPrice,
        photoUrl: selectedProductForCart.photoUrl,
      };
      const updatedCart = await cartService.addToCart(cartItem);
      setCart(updatedCart);
      Alert.alert("✅", `${selectedProductForCart.nom} (${unit.label}) ${t("products.addedToCart")}`);
      setShowUnitSelector(false);
      setSelectedProductForCart(null);
    } catch {
      Alert.alert(t("common.error"), t("products.errorAdding"));
    }
  };

  const handleChatbotAddToCart = async (products: ParsedProduct[]) => {
    try {
      let addedCount = 0;
      for (const p of products) {
        if (p.isMatched && p.matchedProductId && p.matchedProductUnitId) {
          await cartService.addToCart({
            itemType: "PRODUCT",
            productId: p.matchedProductId,
            productNom: p.matchedProductName || p.productName,
            epicerieId: getEpicerieId(),
            unitId: p.matchedProductUnitId,
            unitLabel: p.matchedUnitLabel || p.unit,
            quantity: p.quantity,
            requestedQuantity: p.quantity,
            pricePerUnit: p.matchedPrice || 0,
            totalPrice: (p.matchedPrice || 0) * p.quantity,
          });
          addedCount++;
        }
      }
      const updatedCart = await cartService.getCart();
      setCart(updatedCart);
      if (addedCount > 0) {
        Alert.alert("✅", `${addedCount} ${t("epicerieDetail.addedToCartSuccess")}`);
      } else {
        Alert.alert(t("common.error"), t("epicerieDetail.addToCartError"));
      }
    } catch {
      Alert.alert(t("common.error"), t("epicerieDetail.addToCartError"));
    }
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const goToCart = () => router.push("/(client)/cart");
  const goToProductDetail = (product: Product) =>
    router.push(`/(client)/(epicerie)/product/${product.id}?epicerieId=${id}`);

  // ── Helpers UI ────────────────────────────────────────────────────────────

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const empty = 5 - Math.ceil(rating);
    return "⭐".repeat(full) + (rating % 1 >= 0.5 ? "⭐" : "") + "☆".repeat(empty);
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
      Alert.alert(t("common.error"), t("epicerieDetail.noGpsCoords"));
      return;
    }
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${epicerie.latitude},${epicerie.longitude}`;
      const canOpen = await Linking.canOpenURL(url);
      await Linking.openURL(canOpen ? url : `https://maps.google.com/?q=${epicerie.latitude},${epicerie.longitude}`);
    } catch {
      Alert.alert(t("common.error"), t("epicerieDetail.cantOpenMaps"));
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
        {item.brandName ? (
          <View style={styles.epicCardBrandRow}>
            <Text style={styles.epicCardBrandText}>{item.brandName}</Text>
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
          {item.brandName && (
            <View style={[styles.brandBadge, { marginBottom: 2 }]}>
              <Text style={styles.brandBadgeText} numberOfLines={1}>{item.brandName}</Text>
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
          <Text style={[styles.productPrice, price.hasDiscount && styles.productPricePromo]}>
            {formatPrice(price.display)}
          </Text>
          <Text style={styles.productStock}>{t("products.stock")}: {item.stock}</Text>
          <Text style={styles.seeMoreText}>👉 {t("products.seeMore")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, item.stock === 0 && styles.addButtonOos]}
          onPress={(e) => { e.stopPropagation(); if (item.stock > 0) handleAddToCart(item); }}
          disabled={item.stock === 0}
          activeOpacity={0.7}
        >
          <Ionicons name={item.stock === 0 ? "close" : "cart"} size={20} color="#fff" />
        </TouchableOpacity>
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
      if (item.stock === 0)   return { label: `✗ ${t("products.outOfStockShort")}`,  color: "#F44336", bg: "#FFEBEE" };
      if (item.stock < 3)     return { label: `⚠ ${item.stock} ${t("products.inStockUnits")}`, color: "#F44336", bg: "#FFEBEE" };
      if (item.stock <= 10)   return { label: `⚡ ${item.stock} ${t("products.inStockUnits")}`, color: "#FF6F00", bg: "#FFF3E0" };
      return                         { label: `✓ ${t("products.inStock")}`, color: "#2E7D32", bg: "#E8F5E9" };
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

            <TouchableOpacity
              style={[styles.gridAddBtn, item.stock === 0 && styles.gridAddBtnOos]}
              onPress={(e) => { e.stopPropagation(); if (item.stock > 0) handleAddToCart(item); }}
              activeOpacity={0.85}
              disabled={item.stock === 0}
            >
              <Text style={styles.gridAddBtnIcon}>🛒</Text>
              <Text style={styles.gridOverlayBtnText}>
                {item.stock === 0 ? t("epicerieDetail.soldOut") : t("epicerieDetail.add")}
              </Text>
            </TouchableOpacity>
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

          {item.brandName && (
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText} numberOfLines={1}>{item.brandName}</Text>
            </View>
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

  // ── Header de la liste ────────────────────────────────────────────────────

  const renderListHeader = () => (
    <>
      {/* Bannière épicerie */}
      {epicerie && (
        <>
          <TouchableOpacity
            style={styles.bannerSection}
            onPress={() => epicerie.presentationPhotoUrl && setShowBannerModal(true)}
            activeOpacity={epicerie.presentationPhotoUrl ? 0.9 : 1}
            disabled={!epicerie.presentationPhotoUrl}
          >
            {epicerie.presentationPhotoUrl ? (
              <>
                <FallbackImage
                  urls={[epicerie.presentationPhotoUrl]}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                <View style={styles.bannerZoomIcon}>
                  <Text style={styles.zoomIconText}>🔍</Text>
                </View>
              </>
            ) : (
              <View style={[styles.bannerImage, styles.bannerImagePlaceholder]}>
                <Text style={styles.bannerPlaceholderEmoji}>🏪</Text>
              </View>
            )}
            <View style={styles.bannerOverlay} />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerStoreName}>{epicerie.nomEpicerie}</Text>
              {epicerie.epicerieTypeIcon && epicerie.epicerieTypeLabel && (
                <View style={styles.storeTypeBadge}>
                  <Text style={styles.storeTypeBadgeText}>
                    {epicerie.epicerieTypeIcon} {epicerie.epicerieTypeLabel}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Infos épicerie */}
          <View style={styles.storeInfoCard}>
            {(epicerie.nomGerant || epicerie.prenomGerant) && (
              <View style={styles.gerantSection}>
                <Text style={styles.gerantLabel}>👤 {t("epicerieDetail.shopkeeper")}</Text>
                <Text style={styles.gerantName}>
                  {[epicerie.prenomGerant, epicerie.nomGerant].filter(Boolean).join(" ")}
                </Text>
                <View style={styles.ratingContainer}>
                  <Text style={styles.starsText}>{renderStars(epicerie.averageRating || 0)}</Text>
                  <Text style={styles.ratingText}>{(epicerie.averageRating || 0).toFixed(1)}</Text>
                  <Text style={styles.totalRatingsText}>({epicerie.totalRatings || 0} {t("epicerieDetail.reviews")})</Text>
                </View>
              </View>
            )}
            {loyaltyBalance && loyaltyBalance.balance > 0 && (
              <TouchableOpacity
                style={styles.loyaltyBadge}
                onPress={() => router.push({ pathname: '/(client)/fidelite-detail' as any, params: { epicerieId: String(getEpicerieId()) } })}
                activeOpacity={0.7}
              >
                <Text style={styles.loyaltyBadgeIcon}>⭐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loyaltyBadgeLabel}>{loyaltyBalance.programName ?? 'Fidelite'}</Text>
                  <Text style={styles.loyaltyBadgePoints}>{loyaltyBalance.balance} {loyaltyBalance.programType === 'STAMPS' ? 'tampons' : 'points'}</Text>
                </View>
                <Text style={{ fontSize: 22, color: '#F57C00', fontWeight: '700' }}>›</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={openGoogleMaps} style={styles.addressSection} activeOpacity={0.7}>
              <Text style={styles.addressLabel}>📍 {t("epicerieDetail.address")}</Text>
              <Text style={styles.addressText}>{epicerie.adresse}</Text>
              <Text style={styles.mapsLinkText}>📲 {t("epicerieDetail.openInMaps")}</Text>
            </TouchableOpacity>
            <View style={styles.storeInfoItem}>
              <Text style={styles.storeInfoLabel}>{t("epicerieDetail.productsLabel")}</Text>
              <Text style={styles.storeInfoValue}>{epicerie.nombreProducts}</Text>
            </View>
            {epicerie.description && (
              <View style={styles.storeDescription}>
                <Text style={styles.descriptionText}>{epicerie.description}</Text>
              </View>
            )}
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
        </>
      )}

    </>
  );

  // ── Chargement ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  return (
    <>
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
        {/* ── Barre de recherche fixe (hors FlatList pour éviter le démontage du TextInput) ── */}
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder={t("epicerieDetail.searchProduct")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              placeholderTextColor="#aaa"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleSearchClear} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.searchSubmitBtn}
            onPress={handleSearchSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.searchSubmitIcon}>🔍</Text>
          </TouchableOpacity>

          {/* Bouton filtre catégorie */}
          <TouchableOpacity
            style={[styles.filterBtn, selectedCategoryId !== null && styles.filterBtnActive]}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.filterBtnIcon}>⚡</Text>
            <Text style={[styles.filterBtnText, selectedCategoryId !== null && styles.filterBtnTextActive]}>
              {selectedCategoryId !== null
                ? flatCategories.find((c) => c.id === selectedCategoryId)?.name ?? t("epicerieDetail.categories")
                : t("epicerieDetail.categories")}
            </Text>
            {selectedCategoryId !== null && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleCategorySelect(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.filterBtnClear}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Tag chips */}
        {availableTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsBar} contentContainerStyle={styles.tagsBarContent}>
            {availableTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              const c = tag.color || '#607D8B';
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagChip,
                    { borderColor: c, backgroundColor: isSelected ? c : c + '15' },
                  ]}
                  onPress={() => handleTagToggle(tag.id)}
                  activeOpacity={0.7}
                >
                  {isSelected && <Text style={[styles.tagChipCheck, { color: '#fff' }]}>{'✓ '}</Text>}
                  <Text style={[
                    styles.tagChipText,
                    { color: isSelected ? '#fff' : '#333' },
                  ]}>{tag.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Résumé filtre actif */}
        {selectedCategoryId !== null && (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterLabel}>
              {getCategoryIcon(flatCategories.find((c) => c.id === selectedCategoryId)?.name ?? "")}
              {"  "}
              {flatCategories.find((c) => c.id === selectedCategoryId)?.name}
            </Text>
            <TouchableOpacity onPress={() => handleCategorySelect(null)}>
              <Text style={styles.activeFilterClear}>{t("epicerieDetail.showAll")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Compteur résultats + toggle vue */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {totalProducts} {totalProducts !== 1 ? t("epicerieDetail.products") : t("epicerieDetail.productSingular")}
            {selectedCategoryId !== null || searchQuery
              ? " " + (totalProducts !== 1 ? t("epicerieDetail.foundPlural") : t("epicerieDetail.found"))
              : ""}
          </Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "card" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("card")}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "card" && styles.viewToggleIconActive]}>▬</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("list")}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "list" && styles.viewToggleIconActive]}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "grid" && styles.viewToggleBtnActive]}
              onPress={() => setViewMode("grid")}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleIcon, viewMode === "grid" && styles.viewToggleIconActive]}>⊞</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          key={viewMode === "grid" ? "grid" : "single"}
          data={products}
          renderItem={viewMode === "grid" ? renderProductGrid : viewMode === "list" ? renderProduct : renderProductCard}
          numColumns={viewMode === "grid" ? 2 : 1}
          columnWrapperStyle={viewMode === "grid" ? styles.gridColumnWrapper : undefined}
          keyExtractor={(item) => `product-${item.id}-${item.photoUrl || "no-photo"}`}
          contentContainerStyle={styles.listGrid}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#4CAF50" />
              </View>
            ) : hasMore ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: "#aaa", fontSize: 12 }}>
                  {products.length} / {totalProducts} produits
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>{t("products.noProductsFound")}</Text>
              <Text style={styles.emptySubtext}>
                {(searchQuery || selectedCategoryId !== null) && !loading
                  ? t("epicerieDetail.tryOtherFilters")
                  : t("epicerieDetail.noProductsYet")}
              </Text>
              {(searchQuery || selectedCategoryId !== null) && !loading && (
                <TouchableOpacity
                  style={styles.resetFiltersBtn}
                  onPress={() => { handleSearchClear(); handleCategorySelect(null); }}
                >
                  <Text style={styles.resetFiltersBtnText}>{t("epicerieDetail.clearFilters")}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

        {/* Barre panier */}
        {cart.length > 0 && (
          <View style={styles.cartFooter}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartText}>{cart.length} {t("cart.items")}</Text>
              <Text style={styles.cartTotal}>{formatPrice(getCartTotal())}</Text>
            </View>
            <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
              <Text style={styles.cartButtonText}>{t("cart.viewCart")} 🛒</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bouton WhatsApp flottant — réservé aux clients enregistrés de cette épicerie */}
        {epicerie && canUseAssistedOrdering && epicerie.whatsappEnabled && epicerie.whatsappPhone && (
          <TouchableOpacity
            style={[
              styles.whatsappFab,
              cart.length > 0 && styles.whatsappFabWithCart,
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
              cart.length > 0 && { bottom: 110 },
            ]}
            onPress={() => setShowChatbot(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.chatbotButtonText}>🤖</Text>
            <Text style={styles.chatbotButtonLabel}>{t("epicerieDetail.aiAssistant")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal sélection catégorie */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.catModalContainer}>
          {/* Header */}
          <View style={styles.catModalHeader}>
            <Text style={styles.catModalTitle}>{t("epicerieDetail.categories")}</Text>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              style={styles.catModalCloseBtn}
            >
              <Text style={styles.catModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Recherche dans les catégories */}
          <View style={styles.catSearchWrapper}>
            <Text style={styles.catSearchIcon}>🔍</Text>
            <TextInput
              style={styles.catSearchInput}
              placeholder={t("epicerieDetail.findCategory")}
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholderTextColor="#aaa"
              autoFocus={false}
            />
            {categorySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCategorySearch("")}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Option "Tous les produits" */}
          <TouchableOpacity
            style={[styles.catAllRow, selectedCategoryId === null && styles.catAllRowActive]}
            onPress={() => handleCategorySelect(null)}
            activeOpacity={0.75}
          >
            <View style={[styles.catAllIcon, selectedCategoryId === null && styles.catAllIconActive]}>
              <Text style={styles.catAllEmoji}>🛍️</Text>
            </View>
            <View style={styles.catAllInfo}>
              <Text style={[styles.catAllLabel, selectedCategoryId === null && styles.catAllLabelActive]}>
                {t("epicerieDetail.allProducts")}
              </Text>
              <Text style={styles.catAllCount}>{totalProducts} {t("epicerieDetail.products")}</Text>
            </View>
            {selectedCategoryId === null && <Text style={styles.catCheckmark}>✓</Text>}
          </TouchableOpacity>

          <View style={styles.catDivider} />

          {/* Grille catégories */}
          <ScrollView style={styles.catGrid} showsVerticalScrollIndicator={false}>
            <View style={styles.catGridInner}>
              {flatCategories
                .filter((c) =>
                  categorySearch === "" ||
                  c.name.toLowerCase().includes(categorySearch.toLowerCase())
                )
                .map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const catPromo = bestPromoForCategory(activePromos, cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catGridItem, isSelected && styles.catGridItemActive]}
                      onPress={() => {
                        handleCategorySelect(isSelected ? null : cat.id);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.catGridIcon, isSelected && styles.catGridIconActive]}>
                        <Text style={styles.catGridEmoji}>{getCategoryIcon(cat.name)}</Text>
                      </View>
                      {catPromo && (
                        <View style={styles.catGridPromoBadge}>
                          <Text style={styles.catGridPromoText}>
                            -{Math.round(catPromo.reductionPercentage)}%
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.catGridName, isSelected && styles.catGridNameActive]} numberOfLines={2}>
                        {cat.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.catGridCheck}>
                          <Text style={styles.catGridCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          </ScrollView>
        </View>
      </Modal>

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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },

  /* === BANNIÈRE === */
  bannerSection: { height: 220, backgroundColor: "#e0e0e0", position: "relative", overflow: "hidden" },
  bannerImage: { width: "100%", height: "100%" },
  bannerImagePlaceholder: { backgroundColor: "#4CAF50", justifyContent: "center", alignItems: "center" },
  bannerPlaceholderEmoji: { fontSize: 80 },
  bannerOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  bannerZoomIcon: {
    position: "absolute", top: 12, right: 12,
    backgroundColor: "rgba(255,255,255,0.9)", width: 36, height: 36,
    borderRadius: 18, justifyContent: "center", alignItems: "center",
    elevation: 4,
  },
  zoomIconText: { fontSize: 18 },
  bannerContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(0,0,0,0.2)" },
  bannerStoreName: {
    fontSize: 28, fontWeight: "bold", color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3,
  },
  storeTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  storeTypeBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  /* === INFOS ÉPICERIE === */
  storeInfoCard: {
    backgroundColor: "#fff", marginHorizontal: 12, marginTop: -16, marginBottom: 12,
    borderRadius: 14, padding: 16, elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, zIndex: 10,
  },
  gerantSection: { paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  gerantLabel: { fontSize: 12, color: "#999", fontWeight: "600", marginBottom: 4 },
  gerantName: { fontSize: 17, fontWeight: "bold", color: "#333", marginBottom: 6 },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  starsText: { fontSize: 14 },
  ratingText: { fontSize: 15, fontWeight: "bold", color: "#FFB300" },
  totalRatingsText: { fontSize: 12, color: "#999" },
  addressSection: { paddingVertical: 10, marginBottom: 12, backgroundColor: "#f8f9fa", borderRadius: 10, padding: 12 },
  addressLabel: { fontSize: 12, color: "#999", fontWeight: "600", marginBottom: 4 },
  addressText: { fontSize: 14, color: "#333", fontWeight: "500", marginBottom: 6, lineHeight: 20 },
  mapsLinkText: { fontSize: 12, color: "#4CAF50", fontWeight: "600" },
  storeInfoItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  storeInfoLabel: { fontSize: 13, color: "#999", fontWeight: "500" },
  storeInfoValue: { fontSize: 17, fontWeight: "bold", color: "#4CAF50" },
  storeDescription: { borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  descriptionText: { fontSize: 13, color: "#666", lineHeight: 20 },

  /* === BARRE DE RECHERCHE + FILTRE === */
  searchBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#333" },
  clearBtn: { padding: 4, marginRight: 2 },
  clearBtnText: { fontSize: 16, color: "#bbb" },
  searchSubmitBtn: {
    backgroundColor: "#4CAF50",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchSubmitIcon: { fontSize: 18 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    gap: 5,
    maxWidth: 140,
  },
  filterBtnActive: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4CAF50",
  },
  filterBtnIcon: { fontSize: 14 },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: "#666", flexShrink: 1 },
  filterBtnTextActive: { color: "#2E7D32" },
  filterBtnClear: { fontSize: 13, color: "#4CAF50", fontWeight: "700", marginLeft: 2 },

  /* === FILTRE ACTIF === */
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#c8e6c9",
  },
  activeFilterLabel: { fontSize: 13, fontWeight: "600", color: "#2E7D32" },
  activeFilterClear: { fontSize: 12, color: "#4CAF50", fontWeight: "700" },

  /* === TAGS BAR === */
  tagsBar: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  tagsBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
  },
  tagChipCheck: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },

  /* === PRODUCT TAG BADGES === */
  productTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: 2,
  },
  productTagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  productTagBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },

  /* === RÉSULTATS + TOGGLE === */
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  resultsCount: { fontSize: 13, color: "#999", fontWeight: "500" },
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
  listGrid: { paddingTop: 8, paddingBottom: 20 },
  listCard: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20 },

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

  /* === CARTE PRODUIT — MODE GRILLE === */
  gridCard: {
    width: (SCREEN_WIDTH - 32) / 2,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
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
  brandBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E3F2FD",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 4,
  },
  brandBadgeText: {
    fontSize: 10,
    color: "#1565C0",
    fontWeight: "600",
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

  /* === CARTE PRODUIT === */
  productCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4,
    elevation: 2, borderWidth: 0.5, borderColor: "#f0f0f0",
  },
  productImageContainer: {
    width: 76, height: 76, backgroundColor: "#f5f5f5", borderRadius: 10,
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

  /* === CARTE EPICIER-STYLE (mode card) === */
  epicCardWrapper: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  epicCardImageBox: {
    width: '100%',
    height: 140,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
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

  /* === PANIER === */
  cartFooter: {
    backgroundColor: "#fff", padding: 14, paddingBottom: 18,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 3,
  },
  cartInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, alignItems: "center" },
  cartText: { fontSize: 14, color: "#999", fontWeight: "500" },
  cartTotal: { fontSize: 20, fontWeight: "bold", color: "#333" },
  cartButton: {
    backgroundColor: "#4CAF50", paddingVertical: 13, paddingHorizontal: 20,
    borderRadius: 11, alignItems: "center",
  },
  cartButtonText: { color: "#fff", fontSize: 15, fontWeight: "bold" },

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

  /* === MODAL CATÉGORIES === */
  catModalContainer: { flex: 1, backgroundColor: "#fff" },
  catModalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  catModalTitle: { fontSize: 20, fontWeight: "800", color: "#333" },
  catModalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center",
  },
  catModalCloseText: { fontSize: 15, color: "#666", fontWeight: "600" },
  catSearchWrapper: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 14, marginVertical: 12,
    backgroundColor: "#f5f5f5", borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: "#e8e8e8",
  },
  catSearchIcon: { fontSize: 15, marginRight: 8 },
  catSearchInput: { flex: 1, fontSize: 15, color: "#333" },
  catAllRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 14, marginBottom: 4,
    padding: 12, borderRadius: 14,
    backgroundColor: "#f8f8f8", borderWidth: 1.5, borderColor: "#ececec",
    gap: 12,
  },
  catAllRowActive: { backgroundColor: "#e8f5e9", borderColor: "#4CAF50" },
  catAllIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "#ececec", justifyContent: "center", alignItems: "center",
  },
  catAllIconActive: { backgroundColor: "#c8e6c9" },
  catAllEmoji: { fontSize: 26 },
  catAllInfo: { flex: 1 },
  catAllLabel: { fontSize: 15, fontWeight: "700", color: "#333" },
  catAllLabelActive: { color: "#2E7D32" },
  catAllCount: { fontSize: 12, color: "#999", marginTop: 2 },
  catCheckmark: { fontSize: 18, color: "#4CAF50", fontWeight: "bold" },
  catDivider: { height: 1, backgroundColor: "#f0f0f0", marginHorizontal: 14, marginVertical: 10 },
  catGrid: { flex: 1, paddingHorizontal: 14 },
  catGridInner: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 10, paddingBottom: 30,
  },
  catGridItem: {
    width: "30%",
    backgroundColor: "#f8f8f8",
    borderRadius: 14, padding: 12,
    alignItems: "center",
    borderWidth: 1.5, borderColor: "#ececec",
    position: "relative",
  },
  catGridItemActive: { backgroundColor: "#e8f5e9", borderColor: "#4CAF50" },
  catGridIcon: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: "#ececec",
    justifyContent: "center", alignItems: "center",
    marginBottom: 8,
  },
  catGridIconActive: { backgroundColor: "#c8e6c9" },
  catGridEmoji: { fontSize: 28 },
  catGridName: {
    fontSize: 12, fontWeight: "600", color: "#444",
    textAlign: "center", lineHeight: 16,
  },
  catGridNameActive: { color: "#2E7D32", fontWeight: "700" },
  catGridCount: {
    fontSize: 11, color: "#aaa", marginTop: 4, fontWeight: "500",
  },
  catGridCheck: {
    position: "absolute", top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#4CAF50", justifyContent: "center", alignItems: "center",
  },
  catGridCheckText: { fontSize: 11, color: "#fff", fontWeight: "bold" },
  catGridPromoBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "#E53935",
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
    shadowColor: "#E53935",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  catGridPromoText: { fontSize: 10, color: "#fff", fontWeight: "900", letterSpacing: 0.3 },

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
