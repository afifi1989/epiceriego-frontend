import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ProductUnitDisplay } from "../../../components/client/ProductUnitDisplay";
import { ProductImageModal } from "../../../src/components/client/ProductImageModal";
import { FallbackImage } from "../../../components/client/FallbackImage";
import { useLanguage } from "../../../src/context/LanguageContext";
import { cartService } from "../../../src/services/cartService";
import {
  Category,
  categoryService,
} from "../../../src/services/categoryService";
import { epicerieService } from "../../../src/services/epicerieService";
import { productService } from "../../../src/services/productService";
import { CartItem, Epicerie, Product, ProductUnit } from "../../../src/type";
import { formatPrice } from "../../../src/utils/helpers";

type ViewMode = "categories" | "subcategories" | "products";
type SearchMode = "categories" | "search";

export default function EpicerieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [searchMode, setSearchMode] = useState<SearchMode>("categories");
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [selectedProductForCart, setSelectedProductForCart] =
    useState<Product | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageProduct, setSelectedImageProduct] =
    useState<Product | null>(null);
  const [imageLoadingState, setImageLoadingState] = useState<{
    [key: number]: boolean;
  }>({});
  const [imageErrorState, setImageErrorState] = useState<{
    [key: number]: boolean;
  }>({});

  // Définir les fonctions de chargement
  const loadEpicerieInfo = useCallback(async () => {
    try {
      const epicerieId =
        typeof id === "string" ? parseInt(id, 10) : parseInt(id[0], 10);
      const data = await epicerieService.getEpicerieById(epicerieId);
      setEpicerie(data);
    } catch (error) {
      console.error("Erreur lors du chargement de l'épicerie:", error);
    }
  }, [id]);

  const loadAllProducts = useCallback(async () => {
    try {
      const epicerieId =
        typeof id === "string" ? parseInt(id, 10) : parseInt(id[0], 10);
      const data = await productService.getProductsByEpicerie(epicerieId);
      console.log("[LoadAllProducts] Produits chargés:", {
        count: data.length,
        productsWithPhoto: data.filter((p) => p.photoUrl).length,
        products: data.map((p) => ({
          id: p.id,
          nom: p.nom,
          photoUrl: p.photoUrl,
          hasPhoto: !!p.photoUrl,
        })),
      });
      setAllProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error("Erreur lors du chargement des produits:", error);
    }
  }, [id]);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const epicerieId =
        typeof id === "string" ? parseInt(id, 10) : parseInt(id[0], 10);
      const data = await categoryService.getCategoriesByEpicerie(epicerieId);
      setCategories(data);
    } catch (error) {
      Alert.alert(t("common.error"), String(error));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const filterProducts = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setFilteredProducts(allProducts);
        return;
      }

      const filtered = allProducts.filter((product) =>
        product.nom.toLowerCase().includes(query.toLowerCase()),
      );
      setFilteredProducts(filtered);
    },
    [allProducts],
  );

  // Charger les données au montage ET quand l'ID de l'épicerie change
  useEffect(() => {
    if (id) {
      // Réinitialiser la vue et l'état de navigation
      setSearchMode("categories");
      setViewMode("categories");
      setSearchQuery("");
      setSelectedCategory(null);
      setSubCategories([]);
      setSelectedSubCategory(null);
      setProducts([]);

      // Charger les nouvelles données
      loadEpicerieInfo();
      loadCategories();
      loadAllProducts();
    }
  }, [id, loadEpicerieInfo, loadCategories, loadAllProducts]);

  // Recharger TOUS les données CHAQUE FOIS qu'on revient à cette page
  useFocusEffect(
    useCallback(() => {
      const reloadAllData = async () => {
        try {
          // Réinitialiser les états de navigation
          setSearchMode("categories");
          setViewMode("categories");
          setSearchQuery("");
          setSelectedCategory(null);
          setSubCategories([]);
          setSelectedSubCategory(null);
          setProducts([]);
          setShowImageModal(false);
          setSelectedImageProduct(null);

          console.log("[EpicerieDetail] 🔄 États de navigation réinitialisés");

          // Recharger le panier
          const cart = await cartService.getCart();
          console.log(
            "[EpicerieDetail] 🔄 Panier reloadé au focus:",
            cart.length,
            "articles",
          );
          setCart(cart);

          // Recharger les produits
          console.log("[EpicerieDetail] 🔄 Produits reloadés au focus");
          loadAllProducts();

          // Recharger les catégories
          console.log("[EpicerieDetail] 🔄 Catégories reloadées au focus");
          loadCategories();

          // Recharger les infos de l'épicerie
          console.log("[EpicerieDetail] 🔄 Infos épicerie reloadées au focus");
          loadEpicerieInfo();
        } catch (error) {
          console.error(
            "[EpicerieDetail] ❌ Erreur chargement données:",
            error,
          );
        }
      };

      reloadAllData();
    }, [loadAllProducts, loadCategories, loadEpicerieInfo]),
  );

  useEffect(() => {
    if (searchMode === "search") {
      filterProducts(searchQuery);
    }
  }, [searchQuery, searchMode]);

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearchQuery("");
    if (mode === "categories") {
      setViewMode("categories");
    }
  };

  const handleCategoryClick = async (category: Category) => {
    try {
      setLoading(true);
      setSelectedCategory(category);

      // Si la catégorie a des enfants, les afficher
      if (category.children && category.children.length > 0) {
        setSubCategories(category.children);
        setViewMode("subcategories");
      } else {
        // Sinon, charger directement les produits de cette catégorie
        const epicerieId =
          typeof id === "string" ? parseInt(id, 10) : parseInt(id[0], 10);
        const allProductsData =
          await productService.getProductsByEpicerie(epicerieId);
        const filteredProducts = allProductsData.filter(
          (p) => p.categoryId === category.id,
        );
        setProducts(filteredProducts);
        setViewMode("products");
      }
    } catch (error) {
      Alert.alert(t("common.error"), String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubCategoryClick = async (subCategory: Category) => {
    try {
      setLoading(true);
      setSelectedSubCategory(subCategory);

      // Charger les produits de cette catégorie (et de ses enfants si elle en a)
      const epicerieId =
        typeof id === "string" ? parseInt(id, 10) : parseInt(id[0], 10);
      const allProductsData =
        await productService.getProductsByEpicerie(epicerieId);

      // Récupérer tous les IDs de catégorie cible (incluant les enfants)
      const getCategoryIdsRecursive = (cat: Category): number[] => {
        let ids = [cat.id];
        if (cat.children) {
          cat.children.forEach((child) => {
            ids = ids.concat(getCategoryIdsRecursive(child));
          });
        }
        return ids;
      };

      const categoryIds = getCategoryIdsRecursive(subCategory);
      const filteredProducts = allProductsData.filter((p) =>
        categoryIds.includes(p.categoryId!),
      );

      setProducts(filteredProducts);
      setViewMode("products");
    } catch (error) {
      Alert.alert(t("common.error"), String(error));
    } finally {
      setLoading(false);
    }
  };

  const goBackToCategories = () => {
    setViewMode("categories");
    setSelectedCategory(null);
    setSubCategories([]);
  };

  const goBackToSubCategories = () => {
    setViewMode("subcategories");
    setSelectedSubCategory(null);
    setProducts([]);
  };

  const handleAddToCart = (product: Product) => {
    // Si le produit a des unités, ouvrir le sélecteur
    // Sinon, ajouter directement au panier
    if (product.units && product.units.length > 0) {
      setSelectedProductForCart(product);
      setShowUnitSelector(true);
    } else {
      addToCartDirect(product);
    }
  };

  const addToCartDirect = async (product: Product) => {
    try {
      console.log(
        "[addToCartDirect] Ajout du produit:",
        product.nom,
        "avec ID:",
        product.id,
      );

      // Créer un CartItem à partir du Product
      const cartItem: CartItem = {
        productId: product.id,
        productNom: product.nom,
        epicerieId: product.epicerieId,
        quantity: 1,
        unitId: undefined, // Legacy product (no specific unit)
        unitLabel: t("products.piece") || "À l'unité", // Default label for legacy products
        pricePerUnit: product.prix,
        totalPrice: product.prix,
        photoUrl: product.photoUrl,
      };

      console.log("[addToCartDirect] CartItem créé:", cartItem);

      // Ajouter au panier via le service
      const updatedCart = await cartService.addToCart(cartItem);

      console.log(
        "[addToCartDirect] ✅ Panier mis à jour:",
        updatedCart.length,
        "articles",
      );

      // Mettre à jour le state local
      setCart(updatedCart);

      Alert.alert("✅", t("products.addedToCart"));
    } catch (error) {
      console.error("[addToCartDirect] ❌ Erreur ajout panier:", error);
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
        productId: selectedProductForCart.id,
        productNom: selectedProductForCart.nom,
        epicerieId: selectedProductForCart.epicerieId,
        unitId: unitId,
        unitLabel: unit.label,
        quantity: quantity,
        requestedQuantity: quantity,
        pricePerUnit: unit.prix,
        totalPrice: totalPrice,
        photoUrl: selectedProductForCart.photoUrl,
      };

      const updatedCart = await cartService.addToCart(cartItem);
      setCart(updatedCart);

      Alert.alert(
        "✅",
        `${selectedProductForCart.nom} (${unit.label}) ${t("products.addedToCart")}`,
      );
      setShowUnitSelector(false);
      setSelectedProductForCart(null);
    } catch (error) {
      console.error("Erreur ajout panier:", error);
      Alert.alert(t("common.error"), t("products.errorAdding"));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  };

  const goToCart = () => {
    // Le panier est maintenant sauvegardé dans AsyncStorage
    // L'epicerieId est stocké dans chaque CartItem
    router.push("/(client)/cart");
  };

  const getCategoryIcon = (categoryName: string) => {
    const icons: Record<string, string> = {
      "Fruits et Légumes": "🥬",
      "Viandes et Poissons": "🥩",
      "Produits Laitiers": "🥛",
      Épicerie: "🛒",
      Boissons: "🥤",
      Surgelés: "❄️",
      "Pain et Pâtisserie": "🍞",
      "Hygiène et Beauté": "🧴",
      Entretien: "🧹",
      default: "📦",
    };
    return icons[categoryName] || icons["default"];
  };

  const openGoogleMaps = async () => {
    if (!epicerie?.latitude || !epicerie?.longitude) {
      Alert.alert(
        t("common.error"),
        "Coordonnées GPS non disponibles pour cette épicerie",
      );
      return;
    }

    try {
      // URL pour ouvrir Google Maps avec les coordonnées
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${epicerie.latitude},${epicerie.longitude}&destination_place_id=${epicerie.nomEpicerie}`;

      // Vérifier si Google Maps peut être ouvert
      const canOpen = await Linking.canOpenURL(googleMapsUrl);

      if (canOpen) {
        await Linking.openURL(googleMapsUrl);
      } else {
        // Fallback: essayer d'ouvrir avec un autre format d'URL
        const webUrl = `https://maps.google.com/?q=${epicerie.latitude},${epicerie.longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error("Erreur ouverture Google Maps:", error);
      Alert.alert(t("common.error"), "Impossible d'ouvrir Google Maps");
    }
  };

  const renderCategoryCard = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.newCategoryCard}
      onPress={() => handleCategoryClick(item)}
      activeOpacity={0.85}
    >
      {/* Category Image Background */}
      <View style={styles.categoryImageSection}>
        <View style={styles.categoryImageBg}>
          <Text style={styles.categoryLargeIcon}>
            {getCategoryIcon(item.name)}
          </Text>
        </View>
        {/* Overlay Gradient Effect */}
        <View style={styles.categoryOverlay} />
      </View>

      {/* Category Info Section */}
      <View style={styles.categoryContent}>
        <Text style={styles.newCategoryName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.newCategoryDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.categoryFooter}>
          <Text style={styles.categoryArrowText}>Voir →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSubCategoryCard = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.subCategoryCard}
      onPress={() => handleSubCategoryClick(item)}
    >
      <Text style={styles.subCategoryIcon}>📂</Text>
      <Text style={styles.subCategoryName}>{item.name}</Text>
      {item.description && (
        <Text style={styles.subCategoryDescription}>{item.description}</Text>
      )}
      <View style={styles.subCategoryArrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );

  const goToProductDetail = (product: Product) => {
    router.push(`/(client)/(epicerie)/product/${product.id}?epicerieId=${id}`);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const imageUrls = item.photoUrl
      ? productService.getImageUrls(item.photoUrl)
      : [];
    const isImageLoading = imageLoadingState[item.id] || false;
    const isImageError = imageErrorState[item.id] || false;

    console.log(
      `[RenderProduct] Product: ${item.nom}, photoUrl: ${item.photoUrl}, imageUrls: ${imageUrls.join(", ")}, loading: ${isImageLoading}, error: ${isImageError}`,
    );

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => goToProductDetail(item)}
        activeOpacity={0.9}
      >
        {/* Image ou emoji */}
        <TouchableOpacity
          style={styles.productImageContainer}
          onPress={(e) => {
            if (item.photoUrl && !isImageError) {
              e.stopPropagation();
              setSelectedImageProduct(item);
              setShowImageModal(true);
            }
          }}
          activeOpacity={0.7}
        >
          {isImageLoading && (
            <View style={styles.imageLoadingSpinner}>
              <ActivityIndicator size="small" color="#4CAF50" />
            </View>
          )}

          {item.photoUrl && !isImageError ? (
            <>
              <FallbackImage
                urls={imageUrls}
                style={[
                  styles.productImage,
                  { opacity: isImageLoading ? 0.5 : 1 },
                ]}
                resizeMode="cover"
                onLoadStart={() => {
                  console.log(`[RenderProduct.onLoadStart] ${item.nom}`);
                  setImageLoadingState((prev) => ({
                    ...prev,
                    [item.id]: true,
                  }));
                }}
                onLoadEnd={() => {
                  console.log(`[RenderProduct.onLoadEnd] ${item.nom}`);
                  setImageLoadingState((prev) => ({
                    ...prev,
                    [item.id]: false,
                  }));
                }}
                onError={(error) => {
                  console.error(
                    `[RenderProduct.onError] Image load error for ${item.nom}:`,
                    error.nativeEvent?.error || "Unknown error",
                  );
                  setImageErrorState((prev) => ({ ...prev, [item.id]: true }));
                }}
              />
              {!isImageLoading && (
                <View style={styles.zoomIconOverlay}>
                  <Text style={styles.zoomIcon}>🔍</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.productEmojiInContainer}>📦</Text>
          )}
        </TouchableOpacity>

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.nom}</Text>
          <Text style={styles.productCategory}>
            {item.categoryName || item.categorie || t("products.uncategorized")}
          </Text>
          <Text style={styles.productPrice}>{formatPrice(item.prix)}</Text>
          <Text style={styles.productStock}>
            {t("products.stock")}: {item.stock}
          </Text>
          <Text style={styles.seeMoreText}>👉 {t("products.seeMore")}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={(e) => {
            e.stopPropagation();
            handleAddToCart(item);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <>
      {/* Image Modal avec Zoom */}
      {selectedImageProduct && selectedImageProduct.photoUrl && (
        <ProductImageModal
          visible={showImageModal}
          photoUrl={selectedImageProduct.photoUrl}
          productName={selectedImageProduct.nom}
          onClose={() => {
            setShowImageModal(false);
            setSelectedImageProduct(null);
          }}
        />
      )}

      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        {/* Epicerie Presentation Banner */}
        {epicerie && (
          <>
            {/* Banner Image */}
            <View style={styles.bannerSection}>
              {epicerie.photoUrl ? (
                <FallbackImage
                  urls={[epicerie.photoUrl]}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[styles.bannerImage, styles.bannerImagePlaceholder]}
                >
                  <Text style={styles.bannerPlaceholderEmoji}>🏪</Text>
                </View>
              )}
              {/* Overlay gradient effect */}
              <View style={styles.bannerOverlay} />

              {/* Store Info on Banner */}
              <View style={styles.bannerContent}>
                <Text style={styles.bannerStoreName}>
                  {epicerie.nomEpicerie}
                </Text>
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  style={styles.bannerLocationButton}
                >
                  <Text style={styles.bannerAddress}>
                    📍 {epicerie.adresse}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Store Info Card Below Banner */}
            <View style={styles.storeInfoCard}>
              <View style={styles.storeInfoItem}>
                <Text style={styles.storeInfoLabel}>Produits</Text>
                <Text style={styles.storeInfoValue}>
                  {epicerie.nombreProducts}
                </Text>
              </View>
              {epicerie.description && (
                <View style={styles.storeDescription}>
                  <Text style={styles.descriptionText}>
                    {epicerie.description}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeSelectorButton,
              searchMode === "categories" && styles.modeSelectorButtonActive,
            ]}
            onPress={() => handleSearchModeChange("categories")}
          >
            <Text
              style={[
                styles.modeSelectorText,
                searchMode === "categories" && styles.modeSelectorTextActive,
              ]}
            >
              📂 {t("products.byCategories")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeSelectorButton,
              searchMode === "search" && styles.modeSelectorButtonActive,
            ]}
            onPress={() => handleSearchModeChange("search")}
          >
            <Text
              style={[
                styles.modeSelectorText,
                searchMode === "search" && styles.modeSelectorTextActive,
              ]}
            >
              🔍 {t("products.directSearch")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar (only in search mode) */}
        {searchMode === "search" && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t("products.searchPlaceholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery("")}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Breadcrumb Navigation (only in categories mode) */}
        {searchMode === "categories" && (
          <View style={styles.breadcrumb}>
            <TouchableOpacity onPress={goBackToCategories}>
              <Text
                style={[
                  styles.breadcrumbText,
                  viewMode === "categories" && styles.breadcrumbActive,
                ]}
              >
                📂 {t("products.categories")}
              </Text>
            </TouchableOpacity>

            {(viewMode === "subcategories" || viewMode === "products") && (
              <>
                <Text style={styles.breadcrumbSeparator}> › </Text>
                <TouchableOpacity onPress={goBackToSubCategories}>
                  <Text
                    style={[
                      styles.breadcrumbText,
                      viewMode === "subcategories" && styles.breadcrumbActive,
                    ]}
                  >
                    {selectedCategory?.name}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {viewMode === "products" && (
              <>
                <Text style={styles.breadcrumbSeparator}> › </Text>
                <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>
                  {selectedSubCategory?.name}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Search Results View */}
        {searchMode === "search" && (
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={(item) =>
              `search-product-${item.id}-${item.photoUrl || "no-photo"}`
            }
            contentContainerStyle={styles.list}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            ListHeaderComponent={
              <View style={styles.searchResultsHeader}>
                <Text style={styles.searchResultsText}>
                  {filteredProducts.length} {t("products.productsFound")}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyText}>
                  {t("products.noProductsFound")}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? t("products.tryAnotherSearch")
                    : t("products.startTyping")}
                </Text>
              </View>
            }
          />
        )}

        {/* Categories View */}
        {searchMode === "categories" && viewMode === "categories" && (
          <FlatList
            data={categories}
            renderItem={renderCategoryCard}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.gridList}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📦</Text>
                <Text style={styles.emptyText}>
                  {t("products.noCategoryAvailable")}
                </Text>
              </View>
            }
          />
        )}

        {/* SubCategories View */}
        {searchMode === "categories" && viewMode === "subcategories" && (
          <FlatList
            data={subCategories}
            renderItem={renderSubCategoryCard}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.gridList}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📂</Text>
                <Text style={styles.emptyText}>
                  {t("products.noSubCategoryAvailable")}
                </Text>
              </View>
            }
          />
        )}

        {/* Products View */}
        {searchMode === "categories" && viewMode === "products" && (
          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={(item) =>
              `product-${item.id}-${item.photoUrl || "no-photo"}`
            }
            contentContainerStyle={styles.list}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📦</Text>
                <Text style={styles.emptyText}>
                  {t("products.noProductAvailable")}
                </Text>
              </View>
            }
          />
        )}

        {/* Cart Footer */}
        {cart.length > 0 && (
          <View style={styles.cartFooter}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartText}>
                {cart.length} {t("cart.items")}
              </Text>
              <Text style={styles.cartTotal}>
                {formatPrice(getCartTotal())}
              </Text>
            </View>
            <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
              <Text style={styles.cartButtonText}>{t("cart.viewCart")} 🛒</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Unit Selector Modal */}
      {selectedProductForCart && (
        <Modal
          visible={showUnitSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowUnitSelector(false);
            setSelectedProductForCart(null);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedProductForCart.nom}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowUnitSelector(false);
                  setSelectedProductForCart(null);
                }}
              >
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ProductUnitDisplay
              product={selectedProductForCart}
              onAddToCart={handleAddToCartWithUnit}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  /* === BANNER SECTION === */
  bannerSection: {
    height: 220,
    backgroundColor: "#e0e0e0",
    position: "relative",
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerImagePlaceholder: {
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerPlaceholderEmoji: {
    fontSize: 80,
  },
  bannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  bannerStoreName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  bannerLocationButton: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  bannerAddress: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  /* === STORE INFO CARD === */
  storeInfoCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: -30,
    marginBottom: 15,
    borderRadius: 15,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  storeInfoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  storeInfoLabel: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
  storeInfoValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  storeDescription: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  descriptionText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  modeSelector: {
    flexDirection: "row",
    padding: 12,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modeSelectorButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
  },
  modeSelectorButtonActive: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4CAF50",
  },
  modeSelectorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  modeSelectorTextActive: {
    color: "#4CAF50",
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  clearButton: {
    marginLeft: 10,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 20,
    color: "#bbb",
    fontWeight: "500",
  },
  searchResultsHeader: {
    padding: 15,
    paddingBottom: 5,
  },
  searchResultsText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexWrap: "wrap",
  },
  breadcrumbText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  breadcrumbActive: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  breadcrumbSeparator: {
    fontSize: 13,
    color: "#ddd",
    marginHorizontal: 6,
  },
  gridList: {
    padding: 15,
    paddingTop: 10,
  },
  columnWrapper: {
    justifyContent: "space-between",
    gap: 10,
  },
  /* === NEW CATEGORY CARDS === */
  newCategoryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 15,
    width: "48%",
    height: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: "column",
  },
  categoryImageSection: {
    height: "62%",
    backgroundColor: "#f0f0f0",
    position: "relative",
    overflow: "hidden",
  },
  categoryImageBg: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#4CAF50",
  },
  categoryLargeIcon: {
    fontSize: 80,
  },
  categoryOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  categoryContent: {
    height: "38%",
    padding: 14,
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  newCategoryName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  newCategoryDescription: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },
  categoryFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  categoryArrowText: {
    color: "#4CAF50",
    fontSize: 13,
    fontWeight: "600",
  },
  /* === SUBCATEGORY CARDS === */
  subCategoryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 15,
    width: "48%",
    height: 260,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: "column",
  },
  subCategoryIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  subCategoryName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 5,
  },
  subCategoryDescription: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    marginBottom: 10,
  },
  subCategoryArrow: {
    backgroundColor: "#4CAF50",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  list: {
    padding: 15,
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "#f0f0f0",
  },
  productImageContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginRight: 15,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  zoomIconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },

  zoomIcon: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },

  imageLoadingSpinner: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },

  productEmoji: {
    fontSize: 40,
    marginRight: 15,
  },

  productEmojiInContainer: {
    fontSize: 40,
  },
  productInfo: {
    flex: 1,
    marginLeft: 5,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
    lineHeight: 20,
  },
  productCategory: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
    fontWeight: "500",
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 4,
  },
  productStock: {
    fontSize: 11,
    color: "#bbb",
    marginBottom: 4,
  },
  seeMoreText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
    marginTop: 4,
  },
  addButton: {
    backgroundColor: "#4CAF50",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 3,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    lineHeight: 28,
  },
  cartFooter: {
    backgroundColor: "#fff",
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cartInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  cartText: {
    fontSize: 15,
    color: "#999",
    fontWeight: "500",
  },
  cartTotal: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  cartButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 11,
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  cartButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 70,
    marginBottom: 20,
    opacity: 0.8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  /* === MODAL STYLES === */
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalCloseButton: {
    fontSize: 28,
    color: "#666",
  },
});
