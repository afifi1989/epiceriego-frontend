export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FallbackImage } from '../../../../components/client/FallbackImage';
import { ProductUnitDisplay } from '../../../../components/client/ProductUnitDisplay';
import { BrandChip } from '../../../../src/components/client/BrandChip';
import { StickyMiniCart } from '../../../../src/components/client/StickyMiniCart';
import { Skeleton, useToast } from '../../../../src/components/feedback';
import { ScreenState } from '../../../../src/components/shared/ScreenState';
import { useLanguage } from '../../../../src/context/LanguageContext';
import {
  activePromosForEpicerie,
  bestPromoForProduct,
  effectivePriceForProduct,
  effectivePriceForUnit,
} from '../../../../src/features/promotions/utils';
import { useNow } from '../../../../src/features/promotions/hooks';
import { cartService, groupCartByEpicerie } from '../../../../src/services/cartService';
import { epicerieService } from '../../../../src/services/epicerieService';
import { productService } from '../../../../src/services/productService';
import { Promotion, promotionService } from '../../../../src/services/promotionService';
import { deriveBranding } from '../../../../src/theme/epicerieBranding/deriveBranding';
import { CartItem, Epicerie, Product, ProductUnit, UnitType } from '../../../../src/type';
import { canOrder } from '../../../../src/utils/unitCalculations';
import { formatPrice } from '../../../../src/utils/helpers';

/**
 * Hauteur approximative de la StickyMiniCart hors safe area (cf. [id].tsx) —
 * sert à surélever la barre d'ajout persistante quand le mini-panier est visible.
 */
const MINI_CART_BAR_HEIGHT = 72;

const SCREEN_WIDTH = Dimensions.get('window').width;

/** Image du header avec, optionnellement, le format (ProductUnit) qu'elle représente. */
interface GallerySlide {
  url: string;
  /** id de la variante associée, ou null pour la photo principale du produit. */
  unitId: number | null;
  /** Libellé du format (ex. « 500 g ») affiché en pastille sur l'image. */
  label?: string;
}

export default function ProductDetailScreen() {
  const { productId, epicerieId } = useLocalSearchParams<{ productId: string; epicerieId: string }>();
  const router = useRouter();
  const { t, language } = useLanguage();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [loading, setLoading] = useState(true);
  // Erreur de chargement initial : on affiche un état erreur + Réessayer au
  // lieu d'éjecter l'utilisateur via router.back() (perte de contexte).
  const [loadError, setLoadError] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [epicerieName, setEpicerieName] = useState<string>('');
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  // M-g : tick léger (30 s) qui force un re-render pour que bestPromoForProduct
  // revérifie la fenêtre de la promo → une promo qui expire pendant que la fiche
  // est ouverte cesse d'être affichée/remisée sans attendre un nouveau fetch.
  useNow(30_000);
  // Variant currently picked in <ProductUnitDisplay>. Used only to switch
  // the hero image — the actual selection logic stays inside the component.
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);

  // ── Barre d'ajout persistante + mini-panier ─────────────────────────────
  const insets = useSafeAreaInsets();
  // Quantité LOCALE de la barre sticky (indépendante du stepper interne de
  // ProductUnitDisplay). Réinitialisée quand on change de format.
  const [stickyQty, setStickyQty] = useState(1);
  // Panier global (multi-épicerie) pour alimenter la StickyMiniCart. Rechargé
  // au focus et après chaque ajout — le client peut enchaîner les ajouts puis
  // rejoindre le panier quand il le décide (plus de router.back() forcé).
  const [cart, setCart] = useState<CartItem[]>([]);
  // Produits « dans le même rayon » (même catégorie/épicerie, produit courant
  // exclu). Échec silencieux → carrousel masqué.
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);

  useEffect(() => {
    setStickyQty(1);
  }, [selectedUnit?.id]);

  // Résumé du panier pour CETTE épicerie (le cart est multi-épicerie).
  const currentEpicerieCart = useMemo(() => {
    const epId = product?.epicerieId;
    if (!epId) return null;
    return groupCartByEpicerie(cart).find((g) => g.epicerieId === epId) ?? null;
  }, [cart, product?.epicerieId]);
  const miniCartVisible = (currentEpicerieCart?.itemCount ?? 0) > 0;

  // The hero photo follows the selected variant; falls back to the product's
  // main photo when the variant has none. Switch is instant (no crossfade) —
  // React's normal re-render is enough.
  const heroPhotoUrl = selectedUnit?.photoUrl || product?.photoUrl || null;

  // ── Branding épicier (V101) ────────────────────────────────────────────
  // Palette dérivée de l'épicerie propriétaire du produit, avec fallback au
  // vert AbridGO. Appliquée en override inline (header, prix, bouton ajouter)
  // → la fiche produit adopte le thème de la boutique, comme la page épicerie.
  const brand = useMemo(() => {
    const b = deriveBranding(epicerie);
    return {
      primary: b?.primary ?? '#4CAF50',
      primarySubtle: b?.primarySubtle ?? '#E8F5E9',
      accent: b?.accent ?? '#FFA726',
      onPrimary: b?.onPrimary ?? '#FFFFFF',
    };
  }, [epicerie]);

  // ── Carrousel d'images du header (une image par format) ─────────────────
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // Sélection poussée vers ProductUnitDisplay quand l'utilisateur fait défiler
  // le carrousel (swipe image → format sélectionné).
  const [controlledUnitId, setControlledUnitId] = useState<number | null>(null);
  const galleryRef = useRef<ScrollView>(null);
  // True pendant un scrollTo déclenché par le code (sélection d'un format) :
  // évite que l'event de fin de scroll ré-sélectionne le format → pas de boucle.
  const isProgrammaticScroll = useRef(false);

  /**
   * Diapos du header : une par variante AYANT une photo (dans l'ordre des
   * formats), suivie de la photo principale du produit si elle est distincte.
   * Dédupliquées par URL. Vide → le header affiche le placeholder.
   */
  const galleryImages = useMemo<GallerySlide[]>(() => {
    if (!product) return [];
    const slides: GallerySlide[] = [];
    const seen = new Set<string>();
    (product.units ?? []).forEach((u) => {
      if (u.photoUrl && !seen.has(u.photoUrl)) {
        seen.add(u.photoUrl);
        slides.push({ url: u.photoUrl, unitId: u.id, label: u.label });
      }
    });
    if (product.photoUrl && !seen.has(product.photoUrl)) {
      seen.add(product.photoUrl);
      slides.push({ url: product.photoUrl, unitId: null });
    }
    return slides;
  }, [product]);

  // Format sélectionné → on amène le header sur l'image correspondante.
  useEffect(() => {
    if (!selectedUnit || galleryImages.length === 0) return;
    const idx = galleryImages.findIndex((g) => g.unitId === selectedUnit.id);
    if (idx >= 0 && idx !== activeImageIndex) {
      isProgrammaticScroll.current = true;
      galleryRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
      setActiveImageIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit, galleryImages]);

  // Fin de défilement du header → met à jour les points + (si swipe manuel)
  // sélectionne le format de l'image affichée.
  const onGalleryScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx === activeImageIndex) {
      isProgrammaticScroll.current = false;
      return;
    }
    setActiveImageIndex(idx);
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }
    const slide = galleryImages[idx];
    if (slide?.unitId != null) setControlledUnitId(slide.unitId);
  };

  // Image actuellement visible (pour le zoom plein écran).
  const currentImageUrl = galleryImages[activeImageIndex]?.url ?? heroPhotoUrl;

  useEffect(() => {
    loadProduct({ silent: false });
  }, [productId]);

  // Refetch silencieux sur chaque retour de focus pour voir en temps réel les
  // modifs de l'épicier (prix, stock, photo, variantes). Le tout 1er focus est
  // skip car le useEffect([productId]) vient déjà de charger.
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // Recharge le panier à CHAQUE focus (y compris le 1er) pour que la
      // StickyMiniCart reflète les ajouts faits ici ou ailleurs.
      cartService.getCart().then(setCart).catch(() => {});

      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      loadProduct({ silent: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, epicerieId]),
  );

  // ── Carrousel « Dans le même rayon » ────────────────────────────────────
  // Produits de la même catégorie (à défaut, de la même épicerie), produit
  // courant exclu, gardés uniquement s'ils sont disponibles. Best-effort :
  // toute erreur → liste vide → le carrousel ne s'affiche pas.
  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await productService.getProductsByEpicerie(product.epicerieId);
        if (cancelled) return;
        const sameCategory = product.categoryId != null
          ? list.filter((p) => p.categoryId === product.categoryId)
          : list;
        const filtered = sameCategory
          .filter((p) => p.id !== product.id)
          .filter((p) => p.isAvailable && (p.inStock ?? (p.stock != null && p.stock > 0)))
          .slice(0, 12);
        setSimilarProducts(filtered);
      } catch {
        if (!cancelled) setSimilarProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.categoryId, product?.epicerieId]);

  const loadProduct = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      // En mode silent on garde l'écran affiché avec les anciennes données
      // jusqu'à la réponse — pas de skeleton qui ferait un flash gênant.
      if (!silent) {
        setLoading(true);
        setLoadError(false);
      }
      const parsedProductId = typeof productId === 'string' ? parseInt(productId, 10) : parseInt(productId[0], 10);
      const parsedEpicerieId = typeof epicerieId === 'string' ? parseInt(epicerieId, 10) : parseInt(epicerieId[0], 10);

      // Charge la boutique en parallèle pour récupérer son branding (couleurs
      // V101). Best-effort : un échec laisse `brand` au vert AbridGO par défaut,
      // sans bloquer l'affichage du produit.
      epicerieService
        .getEpicerieById(parsedEpicerieId)
        .then(setEpicerie)
        .catch(() => {});

      // Chargement ciblé du produit via GET /products/{id} — évite de récupérer
      // tout le catalogue de l'épicerie pour n'en garder qu'un seul (ancien
      // getProductsByEpicerie().find()). Un 404/410 rejette → traité en erreur.
      const foundProduct = await productService.getProductById(parsedProductId);

      setProduct(foundProduct);
      // Historique « récemment consultés » (best-effort, non bloquant).
      void productService.addRecentlyViewedProduct(foundProduct.id);
      // Récupérer le nom de l'épicerie depuis le produit
      if (foundProduct.epicerieNom) {
        setEpicerieName(foundProduct.epicerieNom);
      }
      // Charge les promos actives de l'épicerie pour servir de fallback
      // quand le backend n'a pas encore écrit prixBarre sur les unités.
      try {
        const promos = await promotionService.getAllActivePromotions();
        setActivePromos(activePromosForEpicerie(promos, parsedEpicerieId));
      } catch {
        setActivePromos([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du produit:', error);
      // En mode silent (refocus), on garde l'écran tel quel — une erreur réseau
      // transitoire ne doit pas vider la fiche déjà affichée. Au load initial,
      // on bascule sur un état erreur + Réessayer (plus de router.back qui
      // éjecte l'utilisateur et lui fait perdre son contexte de navigation).
      if (!silent) setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAddToCart = async (
    unitId: number | null,
    quantity: number,
    totalPrice: number,
    unit: ProductUnit,
    pricePerUnit: number,
  ) => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      setAddingToCart(true);

      // unitId === null → produit sans variante (tarif Product.prix).
      // On stocke `undefined` dans le CartItem pour qu'il soit omis du payload
      // de commande (le backend déclenche "Unit not found" sur unitId=0/null
      // explicite si la ProductUnit n'existe pas).
      //
      // onPromo : fige si l'article est ajouté à un prix remisé par une promotion
      // produit (même source de vérité que le prix effectif). Sert au calcul de
      // cartHasPromoItems pour la preview du code promo (non cumulable). Pour le
      // legacy (unitId null), `unit` est une variante synthétique dont le prix est
      // déjà le prix remisé → on réévalue via effectivePriceForProduct sur product.
      const promoForItem = bestPromoForProduct(activePromos, product);
      const onPromo = unitId != null
        ? effectivePriceForUnit(unit, promoForItem).hasDiscount
        : effectivePriceForProduct(product, promoForItem).hasDiscount;
      const cartItem = {
        productId: product.id,
        productNom: product.nom,
        epicerieId: product.epicerieId,
        unitId: unitId ?? undefined,
        unitLabel: unit.label,
        quantity: quantity,
        // requestedQuantity = quantité dans l'unité de base (L, kg, pcs) attendue
        // par le backend pour la vérification stock. unit.quantity porte le volume
        // de la variante (0.25 pour 250ml, 0.5 pour 500g, 1 pour "à l'unité").
        // Sans cette multiplication, commander 1 bouteille de 250ml envoyait
        // requestedQuantity=1, que le backend interprétait comme 1 L = 4 bouteilles,
        // d'où "insufficient stock" même avec du stock disponible.
        requestedQuantity: quantity * (unit.quantity ?? 1),
        // Prix EFFECTIF (remisé) résolu par ProductUnitDisplay — surtout pas
        // unit.prix (brut). Sinon le panier persiste le tarif plein et
        // computeItemTotal recalcule un total faux à partir du prix d'origine,
        // d'où le bug "ajouté au prix d'origine au lieu du prix promo".
        pricePerUnit: pricePerUnit,
        totalPrice: totalPrice,
        onPromo,
        photoUrl: unit.photoUrl || product.photoUrl,
      };

      const updatedCart = await cartService.addToCart(cartItem);

      // On NE quitte PLUS la fiche après un ajout : le client reste sur place et
      // peut enchaîner plusieurs ajouts. Retour visuel = toast + haptic succès,
      // et la StickyMiniCart apparaît en bas pour rejoindre le panier au choix.
      setCart(updatedCart);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(t('products.addedToCart'), `${product.nom} (${unit.label})`);
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
      toast.error(t('common.error'), t('products.errorAdding'));
    } finally {
      setAddingToCart(false);
    }
  };

  // Ajout déclenché par la barre persistante basse. Reconstruit les mêmes
  // arguments que ProductUnitDisplay et délègue à handleAddToCart (source
  // unique de vérité pour le prix effectif / requestedQuantity / onPromo).
  const handleStickyAdd = () => {
    if (!product) return;
    const promoForItem = bestPromoForProduct(activePromos, product);
    if (selectedUnit) {
      const price = effectivePriceForUnit(selectedUnit, promoForItem).display;
      handleAddToCart(
        selectedUnit.id,
        stickyQty,
        +(price * stickyQty).toFixed(2),
        selectedUnit,
        price,
      );
      return;
    }
    // Produit legacy (sans variante) : unité synthétique « à l'unité », alignée
    // sur ce que construit ProductUnitDisplay pour rester cohérent côté panier.
    const price = effectivePriceForProduct(product, promoForItem).display;
    const defaultUnit: ProductUnit = {
      id: 0,
      unitType: UnitType.PIECE,
      quantity: 1,
      label: 'À l\'unité',
      prix: price,
      stock: product.stock,
      isAvailable: product.isAvailable,
      displayOrder: 0,
      formattedQuantity: '1 pcs',
      formattedPrice: `${price.toFixed(2)} DH`,
      baseUnit: 'pcs',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    handleAddToCart(null, stickyQty, +(price * stickyQty).toFixed(2), defaultUnit, price);
  };

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        {/* Image hero placeholder */}
        <Skeleton variant="rect" height={280} animated />

        <View style={{ padding: 16 }}>
          {/* Nom + prix */}
          <Skeleton variant="text" width="75%" height={22} style={{ marginBottom: 8 }} />
          <Skeleton variant="text" width="40%" height={20} style={{ marginBottom: 16 }} />

          {/* Description */}
          <Skeleton variant="text" width="95%" style={{ marginBottom: 6 }} />
          <Skeleton variant="text" width="90%" style={{ marginBottom: 6 }} />
          <Skeleton variant="text" width="60%" style={{ marginBottom: 20 }} />

          {/* Variantes / unités (3 lignes) */}
          {[0, 1, 2].map(i => (
            <View key={i} style={{
              backgroundColor: '#fff',
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Skeleton variant="text" width="50%" style={{ marginBottom: 6 }} />
                  <Skeleton variant="text" width="35%" />
                </View>
                <Skeleton variant="rect" width={90} height={36} style={{ borderRadius: 8 }} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (loadError || !product) {
    return (
      <View style={styles.container}>
        {/* Header retour conservé pour ne pas piéger l'utilisateur sur l'erreur. */}
        <View style={[styles.backHeader, { backgroundColor: brand.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={brand.onPrimary} />
            <Text style={[styles.backLabel, { color: brand.onPrimary }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <View style={{ width: 70 }} />
        </View>
        <ScreenState
          variant="error"
          onRetry={() => loadProduct({ silent: false })}
          title={t('products.loadErrorTitle')}
          message={t('products.loadErrorMessage')}
        />
      </View>
    );
  }

  // Source de vérité du stock : `inStock` est calculé côté backend en
  // sommant les variantes (cf. Product.isInStock). Le champ `stock` legacy
  // au niveau du produit ne vaut que si le produit n'a aucune variante —
  // pour les produits modernes (≥ 1 ProductUnit), il reste à 0 et donne
  // un faux "rupture" si on l'utilise seul.
  const hasStock = product.inStock ?? (product.stock != null && product.stock > 0);
  const isAvailable = product.isAvailable && hasStock;

  // ── Prix live de la barre d'ajout persistante ───────────────────────────
  // Prix unitaire EFFECTIF (remisé) du format sélectionné (ou du produit legacy),
  // multiplié par la quantité locale. Recalculé à chaque render → total live.
  const stickyPromo = bestPromoForProduct(activePromos, product);
  const stickyUnitPrice = selectedUnit
    ? effectivePriceForUnit(selectedUnit, stickyPromo).display
    : effectivePriceForProduct(product, stickyPromo).display;
  const stickyTotal = +(stickyUnitPrice * stickyQty).toFixed(2);
  // Peut-on ajouter ? Miroir de la logique interne de ProductUnitDisplay.
  const canStickyAdd = selectedUnit ? canOrder(selectedUnit, stickyQty) : isAvailable;

  // Surélévation de la barre d'ajout quand la StickyMiniCart est visible, +
  // dégagement bas du scroll pour ne rien masquer sous les barres empilées.
  const miniCartHeight = MINI_CART_BAR_HEIGHT + Math.max(insets.bottom + 10, 16);
  const bottomClearance = (isAvailable ? 84 : 72)
    + (miniCartVisible ? miniCartHeight : Math.max(insets.bottom, 16))
    + 24;

  return (
    <>
      {/* === HEADER RETOUR (teinté au thème de la boutique) === */}
      <View style={[styles.backHeader, { backgroundColor: brand.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={brand.onPrimary} />
          <Text style={[styles.backLabel, { color: brand.onPrimary }]}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.backHeaderTitle, { color: brand.onPrimary }]} numberOfLines={1}>
          {epicerieName || product.nom}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      {/* === IMAGE ZOOM MODAL === */}
      {showImageZoom && currentImageUrl && (
        <View style={styles.zoomModal}>
          <TouchableOpacity
            style={styles.zoomModalOverlay}
            onPress={() => setShowImageZoom(false)}
          />
          <View style={styles.zoomModalContent}>
            <FallbackImage
              urls={[currentImageUrl]}
              style={styles.zoomedImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={() => setShowImageZoom(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}>
          {/* === CARROUSEL D'IMAGES (une par format) === */}
          <View style={styles.imageSection}>
            {galleryImages.length > 0 ? (
              <>
                <ScrollView
                  ref={galleryRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onGalleryScrollEnd}
                  scrollEventThrottle={16}
                >
                  {galleryImages.map((slide) => (
                    <TouchableOpacity
                      key={slide.url}
                      style={styles.gallerySlide}
                      activeOpacity={0.95}
                      onPress={() => setShowImageZoom(true)}
                    >
                      <FallbackImage
                        urls={[slide.url]}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Voile bas pour lisibilité des overlays */}
                <View style={styles.imageOverlay} pointerEvents="none" />

                {/* Pastille du format de l'image affichée */}
                {galleryImages[activeImageIndex]?.label && (
                  <View
                    style={[styles.imageFormatBadge, { backgroundColor: brand.primary }]}
                    pointerEvents="none"
                  >
                    <Text style={styles.imageFormatBadgeText}>
                      {galleryImages[activeImageIndex].label}
                    </Text>
                  </View>
                )}

                {/* Points de pagination */}
                {galleryImages.length > 1 && (
                  <View style={styles.dotsRow} pointerEvents="none">
                    {galleryImages.map((slide, i) => (
                      <View
                        key={slide.url}
                        style={[
                          styles.dot,
                          i === activeImageIndex && [styles.dotActive, { backgroundColor: brand.primary }],
                        ]}
                      />
                    ))}
                  </View>
                )}

                {/* Indicateur zoom */}
                <View style={styles.zoomIndicator} pointerEvents="none">
                  <Ionicons name="expand-outline" size={14} color="#333" />
                  <Text style={styles.zoomText}>{t('products.zoom')}</Text>
                </View>
              </>
            ) : (
              <View style={[styles.productImage, styles.imagePlaceholder]}>
                <Ionicons name="cube-outline" size={72} color="#cfcfcf" />
              </View>
            )}
          </View>

          {/* === PRODUCT NAME & CATEGORY === */}
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.nom}</Text>
            {product.categoryName && (
              <View style={[styles.categoryTag, { backgroundColor: brand.primarySubtle, borderColor: brand.primary }]}>
                <Text style={[styles.categoryTagText, { color: brand.primary }]}>{product.categoryName}</Text>
              </View>
            )}
            {product.brandName && product.brandId && (
              <View style={{ marginTop: 6 }}>
                <BrandChip
                  name={product.brandName}
                  logoUrl={product.brandLogoUrl}
                  size="md"
                  variant="badge"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    router.push(`/(client)/(epicerie)/${product.epicerieId}?brandId=${product.brandId}`);
                  }}
                />
              </View>
            )}
          </View>

          {/* === QUANTITY & FORMAT SELECTOR === */}
          {isAvailable && (
            <View style={styles.quantitySection}>
              <ProductUnitDisplay
                product={product}
                onAddToCart={handleAddToCart}
                promo={bestPromoForProduct(activePromos, product)}
                onUnitChanged={setSelectedUnit}
                accentColor={brand.primary}
                controlledUnitId={controlledUnitId}
              />
            </View>
          )}

          {/* === DESCRIPTION SECTION === */}
          {product.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>{t('products.description')}</Text>
              <Text style={styles.descriptionText}>
                {product.translations?.[language]?.description || product.description}
              </Text>
            </View>
          )}

          {/* === CHARACTERISTICS SECTION === */}
          {product.characteristics && product.characteristics.length > 0 && (
            <View style={styles.characteristicsSection}>
              <Text style={styles.sectionLabel}>{t('products.characteristics')}</Text>
              {product.characteristics.map((char, index) => (
                <View key={char.id ?? index} style={[styles.charRow, index % 2 === 0 && styles.charRowEven]}>
                  <Text style={styles.charKey}>{char.keyName}</Text>
                  <Text style={styles.charValue}>{char.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* === CARROUSEL « DANS LE MÊME RAYON » === */}
          {similarProducts.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={[styles.sectionLabel, styles.sectionLabelInset]}>{t('products.sameAisle')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarRow}
              >
                {similarProducts.map((p) => {
                  const price = effectivePriceForProduct(p, bestPromoForProduct(activePromos, p));
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.similarCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        router.push({
                          pathname: '/(client)/(epicerie)/product/[productId]',
                          params: { productId: String(p.id), epicerieId: String(p.epicerieId) },
                        });
                      }}
                    >
                      <View style={styles.similarImageWrap}>
                        {p.photoUrl ? (
                          <FallbackImage urls={[p.photoUrl]} style={styles.similarImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.similarImage, styles.similarImagePlaceholder]}>
                            <Ionicons name="cube-outline" size={30} color="#cfcfcf" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.similarName} numberOfLines={2}>{p.nom}</Text>
                      <View style={styles.similarPriceRow}>
                        {price.hasDiscount && price.original != null && (
                          <Text style={styles.similarPrixBarre}>{formatPrice(price.original)}</Text>
                        )}
                        <Text
                          style={[styles.similarPrice, { color: price.hasDiscount ? '#e53935' : brand.primary }]}
                          numberOfLines={1}
                        >
                          {formatPrice(price.display)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.spacer} />
        </ScrollView>

        {/* === BARRE D'AJOUT PERSISTANTE (produit disponible) === */}
        {isAvailable ? (
          <View
            style={[
              styles.stickyAddBar,
              {
                bottom: miniCartVisible ? miniCartHeight : 0,
                paddingBottom: miniCartVisible ? 12 : Math.max(insets.bottom, 12),
              },
            ]}
          >
            {/* Stepper quantité locale */}
            <View style={styles.stickyStepper}>
              <TouchableOpacity
                style={styles.stickyStepBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setStickyQty((q) => Math.max(1, q - 1));
                }}
                disabled={stickyQty <= 1}
                accessibilityRole="button"
              >
                <Ionicons name="remove" size={20} color={stickyQty <= 1 ? '#bbb' : '#333'} />
              </TouchableOpacity>
              <Text style={styles.stickyQtyText}>{stickyQty}</Text>
              <TouchableOpacity
                style={styles.stickyStepBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setStickyQty((q) => q + 1);
                }}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Bouton ajouter · prix total live */}
            <TouchableOpacity
              style={[
                styles.stickyAddButton,
                { backgroundColor: brand.primary, shadowColor: brand.primary },
                (!canStickyAdd || addingToCart) && styles.stickyAddButtonDisabled,
              ]}
              onPress={handleStickyAdd}
              disabled={!canStickyAdd || addingToCart}
              activeOpacity={0.85}
            >
              <Ionicons name="cart" size={20} color={brand.onPrimary} />
              <Text style={[styles.stickyAddButtonText, { color: brand.onPrimary }]} numberOfLines={1}>
                {t('products.addWithPrice').replace('{{price}}', formatPrice(stickyTotal))}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Message de rupture — Only show if not available */
          <View style={styles.footer}>
            <View style={styles.outOfStockButton}>
              <Ionicons name="close-circle" size={18} color="#c62828" />
              <Text style={styles.outOfStockText}>{t('products.outOfStock')}</Text>
            </View>
          </View>
        )}

        {/* === MINI-PANIER : rejoindre le panier après un ou plusieurs ajouts === */}
        <StickyMiniCart
          itemCount={currentEpicerieCart?.itemCount ?? 0}
          subtotalLabel={formatPrice(currentEpicerieCart?.subtotal ?? 0)}
          itemsLabel={t('epicerieDetail.stickyCartItems').replace('{{count}}', String(currentEpicerieCart?.itemCount ?? 0))}
          ctaLabel={t('epicerieDetail.stickyCartCta')}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/(client)/cart');
          }}
          backgroundColor={brand.primary}
          textColor={brand.onPrimary}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingEnd: 8,
    minWidth: 70,
  },
  backArrow: {
    color: '#fff',
    fontSize: 22,
    marginEnd: 4,
  },
  backLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  backHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  /* === IMAGE SECTION === */
  imageSection: {
    position: 'relative',
    width: '100%',
    height: 340,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  gallerySlide: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#4CAF50',
  },
  imageFormatBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
  },
  imageFormatBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  imagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 80,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  zoomText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  /* === ZOOM MODAL === */
  zoomModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  zoomModalContent: {
    width: '90%',
    height: '80%',
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: '100%',
    height: '100%',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: -50,
    right: 0,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 22,
  },
  zoomCloseText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  /* === PRODUCT HEADER === */
  productHeader: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
  },
  /* === QUANTITY SECTION === */
  quantitySection: {
    backgroundColor: '#fff',
    padding: 18,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  /* === DESCRIPTION SECTION === */
  descriptionSection: {
    backgroundColor: '#fff',
    padding: 18,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#555',
  },
  /* === CHARACTERISTICS SECTION === */
  characteristicsSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    padding: 18,
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  charRowEven: {
    backgroundColor: '#f8f9fa',
  },
  charKey: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  charValue: {
    fontSize: 13,
    color: '#222',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  spacer: {
    height: 20,
  },
  /* === STICKY FOOTER === */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  footerPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginStart: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  outOfStockButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#ffb3ba',
  },
  outOfStockText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
  },
  /* === STICKY ADD BAR === */
  stickyAddBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 14,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 90,
  },
  stickyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f7f7f7',
    overflow: 'hidden',
  },
  stickyStepBtn: {
    width: 42,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyQtyText: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  stickyAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  stickyAddButtonDisabled: {
    backgroundColor: '#c5c5c5',
    shadowOpacity: 0,
    elevation: 0,
  },
  stickyAddButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  /* === SIMILAR PRODUCTS CAROUSEL === */
  similarSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    paddingTop: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionLabelInset: {
    paddingHorizontal: 18,
  },
  similarRow: {
    paddingHorizontal: 18,
    gap: 12,
  },
  similarCard: {
    width: 130,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 8,
  },
  similarImageWrap: {
    width: '100%',
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  similarImage: {
    width: '100%',
    height: '100%',
  },
  similarImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  similarName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    minHeight: 34,
  },
  similarPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  similarPrixBarre: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  similarPrice: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});
