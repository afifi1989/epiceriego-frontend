import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ProductUnitDisplay } from '../../../components/client/ProductUnitDisplay';
import { useLanguage } from '../../../src/context/LanguageContext';
import { cartService } from '../../../src/services/cartService';
import { Category, categoryService } from '../../../src/services/categoryService';
import { epicerieService } from '../../../src/services/epicerieService';
import { productService } from '../../../src/services/productService';
import { CartItem, Epicerie, Product, ProductUnit } from '../../../src/type';
import { formatPrice } from '../../../src/utils/helpers';

type ViewMode = 'categories' | 'subcategories' | 'products';
type SearchMode = 'categories' | 'search';

export default function EpicerieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [searchMode, setSearchMode] = useState<SearchMode>('categories');
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [selectedProductForCart, setSelectedProductForCart] = useState<Product | null>(null);

  // Charger les données au montage
  useEffect(() => {
    loadEpicerieInfo();
    loadCategories();
    loadAllProducts();
  }, []);

  // Recharger le panier CHAQUE FOIS qu'on revient à cette page
  useFocusEffect(
    useCallback(() => {
      const loadCart = async () => {
        try {
          const cart = await cartService.getCart();
          console.log('[EpicerieDetail] 🔄 Panier reloadé au focus:', cart.length, 'articles');
          setCart(cart);
        } catch (error) {
          console.error('[EpicerieDetail] ❌ Erreur chargement panier:', error);
        }
      };

      loadCart();
    }, [])
  );

  useEffect(() => {
    if (searchMode === 'search') {
      filterProducts(searchQuery);
    }
  }, [searchQuery, searchMode]);

  const loadEpicerieInfo = async () => {
    try {
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      const data = await epicerieService.getEpicerieById(epicerieId);
      setEpicerie(data);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'épicerie:', error);
    }
  };

  const loadAllProducts = async () => {
    try {
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      const data = await productService.getProductsByEpicerie(epicerieId);
      setAllProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    }
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      const data = await categoryService.getActiveCategoriesByEpicerie(epicerieId);
      setCategories(data);
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = (query: string) => {
    if (!query.trim()) {
      setFilteredProducts(allProducts);
      return;
    }

    const filtered = allProducts.filter(product =>
      product.nom.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredProducts(filtered);
  };

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearchQuery('');
    if (mode === 'categories') {
      setViewMode('categories');
    }
  };

  const handleCategoryClick = async (category: Category) => {
    try {
      setLoading(true);
      setSelectedCategory(category);
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      const subCats = await categoryService.getActiveCategoryChildrenByEpicerie(category.id, epicerieId);
      setSubCategories(subCats);
      setViewMode('subcategories');
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubCategoryClick = async (subCategory: SubCategory) => {
    try {
      setLoading(true);
      setSelectedSubCategory(subCategory);
      // Charger les produits par épicerie et sous-catégorie
      const epicerieId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
      const allProducts = await productService.getProductsByEpicerie(epicerieId);
      // Filtrer par sous-catégorie en utilisant subCategoryName
      const filteredProducts = allProducts.filter(
        (p) => p.subCategoryName === subCategory.name
      );
      setProducts(filteredProducts);
      setViewMode('products');
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setLoading(false);
    }
  };

  const goBackToCategories = () => {
    setViewMode('categories');
    setSelectedCategory(null);
    setSubCategories([]);
  };

  const goBackToSubCategories = () => {
    setViewMode('subcategories');
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
      console.log('[addToCartDirect] Ajout du produit:', product.nom, 'avec ID:', product.id);

      // Créer un CartItem à partir du Product
      const cartItem: CartItem = {
        productId: product.id,
        productNom: product.nom,
        epicerieId: product.epicerieId,
        quantity: 1,
        pricePerUnit: product.prix,
        totalPrice: product.prix,
        photoUrl: product.photoUrl,
      };

      console.log('[addToCartDirect] CartItem créé:', cartItem);

      // Ajouter au panier via le service
      const updatedCart = await cartService.addToCart(cartItem);

      console.log('[addToCartDirect] ✅ Panier mis à jour:', updatedCart.length, 'articles');

      // Mettre à jour le state local
      setCart(updatedCart);

      Alert.alert('✅', t('products.addedToCart'));
    } catch (error) {
      console.error('[addToCartDirect] ❌ Erreur ajout panier:', error);
      Alert.alert(t('common.error'), t('products.errorAdding'));
    }
  };

  const handleAddToCartWithUnit = async (unitId: number, quantity: number, totalPrice: number, unit: ProductUnit) => {
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

      Alert.alert('✅', `${selectedProductForCart.nom} (${unit.label}) ${t('products.addedToCart')}`);
      setShowUnitSelector(false);
      setSelectedProductForCart(null);
    } catch (error) {
      console.error('Erreur ajout panier:', error);
      Alert.alert(t('common.error'), t('products.errorAdding'));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  };

  const goToCart = () => {
    // Le panier est maintenant sauvegardé dans AsyncStorage
    // L'epicerieId est stocké dans chaque CartItem
    router.push('/(client)/cart');
  };

  const getCategoryIcon = (categoryName: string) => {
    const icons: Record<string, string> = {
      'Fruits et Légumes': '🥬',
      'Viandes et Poissons': '🥩',
      'Produits Laitiers': '🥛',
      'Épicerie': '🛒',
      'Boissons': '🥤',
      'Surgelés': '❄️',
      'Pain et Pâtisserie': '🍞',
      'Hygiène et Beauté': '🧴',
      'Entretien': '🧹',
      'default': '📦'
    };
    return icons[categoryName] || icons['default'];
  };

  const renderCategoryCard = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => handleCategoryClick(item)}
    >
      <Text style={styles.categoryIcon}>{getCategoryIcon(item.name)}</Text>
      <Text style={styles.categoryName}>{item.name}</Text>
      {item.description && (
        <Text style={styles.categoryDescription}>{item.description}</Text>
      )}
      <View style={styles.categoryArrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSubCategoryCard = ({ item }: { item: SubCategory }) => (
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

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => goToProductDetail(item)}
      activeOpacity={0.9}
    >
      <Text style={styles.productEmoji}>📦</Text>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.nom}</Text>
        <Text style={styles.productCategory}>{item.subCategoryName || item.categorie || t('products.uncategorized')}</Text>
        <Text style={styles.productPrice}>{formatPrice(item.prix)}</Text>
        <Text style={styles.productStock}>{t('products.stock')}: {item.stock}</Text>
        <Text style={styles.seeMoreText}>👉 {t('products.seeMore')}</Text>
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        {/* Epicerie Info Header */}
        {epicerie && (
          <View style={styles.epicerieHeader}>
            <Text style={styles.epicerieIcon}>🏪</Text>
            <View style={styles.epicerieInfo}>
              <Text style={styles.epicerieName}>{epicerie.nomEpicerie}</Text>
              <Text style={styles.epicerieAddress}>📍 {epicerie.adresse}</Text>
            </View>
          </View>
        )}
        
        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeSelectorButton, searchMode === 'categories' && styles.modeSelectorButtonActive]}
            onPress={() => handleSearchModeChange('categories')}
          >
            <Text style={[styles.modeSelectorText, searchMode === 'categories' && styles.modeSelectorTextActive]}>
              📂 {t('products.byCategories')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeSelectorButton, searchMode === 'search' && styles.modeSelectorButtonActive]}
            onPress={() => handleSearchModeChange('search')}
          >
            <Text style={[styles.modeSelectorText, searchMode === 'search' && styles.modeSelectorTextActive]}>
              🔍 {t('products.directSearch')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar (only in search mode) */}
        {searchMode === 'search' && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('products.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Breadcrumb Navigation (only in categories mode) */}
        {searchMode === 'categories' && (
        <View style={styles.breadcrumb}>
        <TouchableOpacity onPress={goBackToCategories}>
          <Text style={[styles.breadcrumbText, viewMode === 'categories' && styles.breadcrumbActive]}>
            📂 {t('products.categories')}
          </Text>
        </TouchableOpacity>
        
        {(viewMode === 'subcategories' || viewMode === 'products') && (
          <>
            <Text style={styles.breadcrumbSeparator}> › </Text>
            <TouchableOpacity onPress={goBackToSubCategories}>
              <Text style={[styles.breadcrumbText, viewMode === 'subcategories' && styles.breadcrumbActive]}>
                {selectedCategory?.name}
              </Text>
            </TouchableOpacity>
          </>
        )}
        
        {viewMode === 'products' && (
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
      {searchMode === 'search' && (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.searchResultsHeader}>
              <Text style={styles.searchResultsText}>
                {filteredProducts.length} {t('products.productsFound')}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>{t('products.noProductsFound')}</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? t('products.tryAnotherSearch') : t('products.startTyping')}
              </Text>
            </View>
          }
        />
      )}

      {/* Categories View */}
      {searchMode === 'categories' && viewMode === 'categories' && (
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
              <Text style={styles.emptyText}>{t('products.noCategoryAvailable')}</Text>
            </View>
          }
        />
      )}

      {/* SubCategories View */}
      {searchMode === 'categories' && viewMode === 'subcategories' && (
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
              <Text style={styles.emptyText}>{t('products.noSubCategoryAvailable')}</Text>
            </View>
          }
        />
      )}

      {/* Products View */}
      {searchMode === 'categories' && viewMode === 'products' && (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>{t('products.noProductAvailable')}</Text>
            </View>
          }
        />
      )}

      {/* Cart Footer */}
      {cart.length > 0 && (
        <View style={styles.cartFooter}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartText}>{cart.length} {t('cart.items')}</Text>
            <Text style={styles.cartTotal}>{formatPrice(getCartTotal())}</Text>
          </View>
          <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
            <Text style={styles.cartButtonText}>{t('cart.viewCart')} 🛒</Text>
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
              <Text style={styles.modalTitle}>{selectedProductForCart.nom}</Text>
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
    backgroundColor: '#f5f5f5',
  },
  epicerieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#4CAF50',
  },
  epicerieIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  epicerieInfo: {
    flex: 1,
  },
  epicerieName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  epicerieAddress: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 15,
    paddingBottom: 10,
    backgroundColor: '#fff',
    gap: 10,
  },
  modeSelectorButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  modeSelectorButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  modeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeSelectorTextActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 10,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 20,
    color: '#999',
  },
  searchResultsHeader: {
    padding: 15,
    paddingBottom: 5,
  },
  searchResultsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexWrap: 'wrap',
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  breadcrumbActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 5,
  },
  gridList: {
    padding: 15,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  categoryIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  categoryArrow: {
    backgroundColor: '#4CAF50',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCategoryCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  subCategoryIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  subCategoryName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  subCategoryDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  subCategoryArrow: {
    backgroundColor: '#4CAF50',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    padding: 15,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productEmoji: {
    fontSize: 40,
    marginRight: 15,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  productStock: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  seeMoreText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 5,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cartFooter: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cartText: {
    fontSize: 16,
    color: '#666',
  },
  cartTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  cartButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  /* === MODAL STYLES === */
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#666',
  },
});
