import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { productService } from '../../src/services/productService';
import { Promotion, promotionService } from '../../src/services/promotionService';
import { Epicerie, Product } from '../../src/type';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 50) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchText, setSearchText] = useState('');
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [popularEpiceries, setPopularEpiceries] = useState<Epicerie[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  // Main categories for quick access
  const categories = [
    { id: 1, name: t('client.home.fruits'), emoji: '🍎', color: '#FFE5E5' },
    { id: 2, name: t('client.home.vegetables'), emoji: '🥬', color: '#E5F5E5' },
    { id: 3, name: t('client.home.spices'), emoji: '🌶️', color: '#FFF5E5' },
    { id: 4, name: t('client.home.dairy'), emoji: '🥛', color: '#E5F5FF' },
    { id: 5, name: t('client.home.bakery'), emoji: '🍞', color: '#FFE5F5' },
    { id: 6, name: t('client.home.seeMore'), emoji: '➕', color: '#F5F5F5' },
  ];

  /**
   * Load home page data on mount
   */
  useEffect(() => {
    loadHomeData();
  }, []);

  /**
   * Load all home data
   */
  const loadHomeData = async () => {
    try {
      setLoading(true);

      // Load trending products
      try {
        const products = await productService.getTrendingProducts(6);
        setTrendingProducts(products || []);
      } catch (error) {
        console.log('Error loading trending products:', error);
        setTrendingProducts([]);
      }

      // Load popular epiceries
      try {
        const epiceries = await epicerieService.getPopularEpiceries(3);
        setPopularEpiceries(epiceries || []);
      } catch (error) {
        console.log('Error loading popular epiceries:', error);
        setPopularEpiceries([]);
      }

      // Load recently viewed products from localStorage
      try {
        const viewed = await productService.getRecentlyViewedProducts(4);
        setRecentlyViewed(viewed || []);
      } catch (error) {
        console.log('Error loading recently viewed:', error);
      }

      // Load promotions based on user location
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const promos = await promotionService.getNearbyPromotions(
          location.coords.latitude,
          location.coords.longitude,
          1 // 1 km radius
        );
        setPromotions(promos || []);
      } catch (error) {
        console.log('Error loading promotions:', error);
        // Try to load without location data
        try {
          const promos = await promotionService.getFavoriteEpiceriesPromotions();
          setPromotions(promos || []);
        } catch (fallbackError) {
          console.log('Error loading favorite epiceries promotions:', fallbackError);
          setPromotions([]);
        }
      }
    } catch (error) {
      console.error('Error loading home data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  /**
   * Handle search
   */
  const handleSearch = () => {
    if (searchText.trim()) {
      router.push({
        pathname: '/(client)/epiceries',
        params: { search: searchText },
      });
    }
  };

  /**
   * Handle category tap
   */
  const handleCategoryTap = (category: any) => {
    if (category.id === 6) {
      router.push('/(client)/epiceries');
    } else {
      router.push({
        pathname: '/(client)/epiceries',
        params: { category: category.name },
      });
    }
  };

  /**
   * Handle product tap
   */
  const handleProductTap = (product: Product) => {
    router.push({
      pathname: '/(client)/(epicerie)/[id]',
      params: { id: product.epicerieId.toString() },
    });
  };

  /**
   * Handle epicerie tap
   */
  const handleEpicerieTap = (epicerie: Epicerie) => {
    router.push({
      pathname: '/(client)/(epicerie)/[id]',
      params: { id: epicerie.id.toString() },
    });
  };

  /**
   * Render promotional banner carousel
   */
  const renderPromoBanner = () => {
    if (promotions.length === 0) {
      return null;
    }

    return (
      <FlatList
        horizontal
        scrollEnabled
        pagingEnabled
        data={promotions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.promoBanner}
            activeOpacity={0.8}
            onPress={() => {
              router.push({
                pathname: '/(client)/(epicerie)/[id]',
                params: { id: item.epicerieId.toString() },
              });
            }}
          >
            <View style={styles.promoContent}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.promoImage}
                />
              ) : (
                <Text style={styles.promoEmoji}>🎉</Text>
              )}
              <View style={styles.promoText}>
                <Text style={styles.promoTitle} numberOfLines={1}>
                  {item.reductionPercentage}% {t('client.home.discount')}
                </Text>
                <Text style={styles.promoDesc} numberOfLines={1}>
                  {item.titre}
                </Text>
                {item.epicerieName && (
                  <Text style={styles.promoStore} numberOfLines={1}>
                    @ {item.epicerieName}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.promoButton}>
              <Text style={styles.promoButtonText}>→</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={width - 30}
        decelerationRate="fast"
      />
    );
  };

  /**
   * Render search bar
   */
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder={t('client.home.searchPlaceholder')}
        placeholderTextColor="#999"
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={handleSearch}
      />
      {searchText.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => setSearchText('')}
        >
          <Text style={styles.clearButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  /**
   * Render categories grid
   */
  const renderCategories = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('client.home.categories')}</Text>
      <View style={styles.categoriesGrid}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, { backgroundColor: category.color }]}
            onPress={() => handleCategoryTap(category)}
          >
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text style={styles.categoryName}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  /**
   * Handle image error for epiceries
   */
  const handleImageError = (epicerieId: number) => {
    console.log(`[Home] Failed to load image for epicerie ${epicerieId}, showing fallback`);
    setFailedImages(prev => ({
      ...prev,
      [epicerieId]: true,
    }));
  };

  /**
   * Render popular epiceries
   */
  const renderPopularEpiceries = () =>
    popularEpiceries.length > 0 ? (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('client.home.popularStores')}</Text>
          <TouchableOpacity onPress={() => router.push('/(client)/epiceries')}>
            <Text style={styles.seeAllLink}>{t('client.home.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          scrollEnabled
          data={popularEpiceries}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            // Vérifier si l'image a échoué
            const imageFailed = failedImages[item.id];

            // URL de l'image à afficher
            const imageUrl = item.presentationPhotoUrl || item.photoUrl;
            const shouldShowImage = imageUrl && imageUrl.trim() && !imageFailed && !imageUrl.includes('placeholder');

            return (
              <TouchableOpacity
                style={styles.epicerieCard}
                onPress={() => handleEpicerieTap(item)}
              >
                {shouldShowImage ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.epicerieImage}
                    resizeMode="cover"
                    onError={() => handleImageError(item.id)}
                  />
                ) : (
                  <View style={[styles.epicerieImage, styles.epicerieImagePlaceholder]}>
                    <Text style={styles.placeholderEmoji}>🏪</Text>
                  </View>
                )}
                <View style={styles.epicerieInfo}>
                  <Text style={styles.epicerieName} numberOfLines={1}>
                    {item.nomEpicerie}
                  </Text>
                  <Text style={styles.epicerieAddress} numberOfLines={1}>
                    {item.adresse}
                  </Text>
                  <View style={styles.epicerieStatus}>
                    <View
                      style={[
                        styles.statusBadge,
                        item.isOpen ? styles.statusOpen : styles.statusClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.isOpen
                            ? styles.statusBadgeTextOpen
                            : styles.statusBadgeTextClosed,
                        ]}
                      >
                        {item.isOpen ? t('client.home.open') : t('client.home.closed')}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
        />
      </View>
    ) : null;

  /**
   * Render trending products
   */
  const renderTrendingProducts = () => (
    trendingProducts.length > 0 && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('client.home.trending')}</Text>
          <TouchableOpacity onPress={() => router.push('/(client)/epiceries')}>
            <Text style={styles.seeAllLink}>{t('client.home.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productsGrid}>
          {trendingProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() => handleProductTap(product)}
            >
              {product.photoUrl && (
                <Image
                  source={{ uri: product.photoUrl }}
                  style={styles.productImage}
                />
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

  /**
   * Render recently viewed
   */
  const renderRecentlyViewed = () => (
    recentlyViewed.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('client.home.recentlyViewed')}</Text>
        <View style={styles.productsGrid}>
          {recentlyViewed.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() => handleProductTap(product)}
            >
              {product.photoUrl && (
                <Image
                  source={{ uri: product.photoUrl }}
                  style={styles.productImage}
                />
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#4CAF50"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {renderPromoBanner()}
      {renderSearchBar()}
      {renderCategories()}
      {renderPopularEpiceries()}
      {renderTrendingProducts()}
      {renderRecentlyViewed()}

      {/* Empty state */}
      {trendingProducts.length === 0 &&
        popularEpiceries.length === 0 &&
        recentlyViewed.length === 0 && (
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

/**
 * Styles
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  promoBanner: {
    backgroundColor: '#FF6B6B',
    marginHorizontal: 15,
    marginVertical: 15,
    borderRadius: 15,
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: width - 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  promoImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  promoEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  promoText: {
    flex: 1,
  },
  promoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  promoDesc: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    marginTop: 2,
  },
  promoStore: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.8,
    marginTop: 4,
  },
  promoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 18,
    color: '#999',
  },
  section: {
    paddingHorizontal: 15,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllLink: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '30%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  epicerieCard: {
    width: width - 50,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  epicerieImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  epicerieImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  epicerieInfo: {
    padding: 12,
  },
  epicerieName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  epicerieAddress: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  epicerieStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: '#E8F5E9',
  },
  statusClosed: {
    backgroundColor: '#FFEBEE',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeTextOpen: {
    color: '#4CAF50',
  },
  statusBadgeTextClosed: {
    color: '#F44336',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productStore: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
    fontWeight: '500',
  },
  emptyStateButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  spacer: {
    height: 20,
  },
});
