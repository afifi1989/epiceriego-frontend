import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ProductUnitDisplay } from '../../../../components/client/ProductUnitDisplay';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { cartService } from '../../../../src/services/cartService';
import { productService } from '../../../../src/services/productService';
import { Product, ProductUnit } from '../../../../src/type';
import { formatPrice } from '../../../../src/utils/helpers';

export default function ProductDetailScreen() {
  const { productId, epicerieId } = useLocalSearchParams<{ productId: string; epicerieId: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const parsedProductId = typeof productId === 'string' ? parseInt(productId, 10) : parseInt(productId[0], 10);
      const parsedEpicerieId = typeof epicerieId === 'string' ? parseInt(epicerieId, 10) : parseInt(epicerieId[0], 10);
      
      // Charger tous les produits de l'épicerie et trouver celui qui correspond
      const products = await productService.getProductsByEpicerie(parsedEpicerieId);
      const foundProduct = products.find(p => p.id === parsedProductId);
      
      if (foundProduct) {
        setProduct(foundProduct);
      } else {
        Alert.alert(t('common.error'), 'Produit non trouvé');
        router.back();
      }
    } catch (error) {
      console.error('Erreur lors du chargement du produit:', error);
      Alert.alert(t('common.error'), String(error));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (unitId: number, quantity: number, totalPrice: number, unit: ProductUnit) => {
    if (!product) return;

    try {
      setAddingToCart(true);

      // Créer l'item du panier avec les informations d'unité
      const cartItem = {
        productId: product.id,
        productNom: product.nom,
        unitId: unitId,
        unitLabel: unit.label,
        quantity: quantity,
        requestedQuantity: quantity,
        pricePerUnit: unit.prix,
        totalPrice: totalPrice,
        photoUrl: product.photoUrl,
      };

      await cartService.addToCart(cartItem);

      Alert.alert('✅', `${product.nom} (${unit.label}) ${t('products.addedToCart')}`);
      // Retourner à la page précédente
      router.back();
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
      Alert.alert(t('common.error'), t('products.errorAdding'));
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Produit non trouvé</Text>
      </View>
    );
  }

  const isAvailable = product.isAvailable && product.stock > 0;

  return (
    <>
      <Stack.Screen 
        options={{
          title: t('products.productDetails'),
          headerShown: true,
          headerBackTitle: t('common.back'),
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Product Header */}
          <View style={styles.header}>
            <View style={styles.productIcon}>
              <Text style={styles.productEmoji}>📦</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.productName}>{product.nom}</Text>
              <Text style={styles.epicerieName}>🏪 {product.epicerieNom}</Text>
            </View>
          </View>

          {/* Price Section */}
          <View style={styles.section}>
            <View style={styles.priceContainer}>
              <View>
                <Text style={styles.priceLabel}>{t('products.unitPrice')}</Text>
                <Text style={styles.price}>{formatPrice(product.prix)}</Text>
              </View>
              <View style={[styles.availabilityBadge, isAvailable ? styles.availableBadge : styles.unavailableBadge]}>
                <Text style={styles.availabilityText}>
                  {isAvailable ? `✓ ${t('products.available')}` : `✕ ${t('products.unavailable')}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Stock Section */}
          {isAvailable && (
            <View style={styles.section}>
              <View style={styles.stockContainer}>
                <Text style={styles.sectionTitle}>📊 {t('products.stock')}</Text>
                <View style={styles.stockBadge}>
                  <Text style={styles.stockText}>{product.stock} {t('products.inStock')}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏷️ {t('products.category')}</Text>
            <View style={styles.categoryContainer}>
              {product.categoryName && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{product.categoryName}</Text>
                </View>
              )}
              {product.subCategoryName && (
                <View style={styles.subCategoryBadge}>
                  <Text style={styles.subCategoryText}>{product.subCategoryName}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Description Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 {t('products.description')}</Text>
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>
                {product.description || t('products.noDescription')}
              </Text>
            </View>
          </View>

          {/* Unit Selector and Add to Cart */}
          {isAvailable && (
            <View style={styles.section}>
              <ProductUnitDisplay
                product={product}
                onAddToCart={handleAddToCart}
              />
            </View>
          )}

          <View style={styles.spacer} />
        </ScrollView>

        {/* Out of Stock Message */}
        {!isAvailable && (
          <View style={styles.footer}>
            <View style={styles.outOfStockButton}>
              <Text style={styles.outOfStockText}>❌ {t('products.outOfStock')}</Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  productIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  productEmoji: {
    fontSize: 50,
  },
  headerInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  epicerieName: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  availabilityBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  availableBadge: {
    backgroundColor: '#E8F5E9',
  },
  unavailableBadge: {
    backgroundColor: '#FFEBEE',
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  stockContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryBadge: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B1FA2',
  },
  subCategoryBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  subCategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  descriptionContainer: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  descriptionText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  spacer: {
    height: 100,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButtonPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  outOfStockButton: {
    backgroundColor: '#f44336',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  outOfStockText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
