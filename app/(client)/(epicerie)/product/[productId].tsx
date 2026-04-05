import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { FallbackImage } from '../../../../components/client/FallbackImage';
import { ProductUnitDisplay } from '../../../../components/client/ProductUnitDisplay';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { cartService } from '../../../../src/services/cartService';
import { productService } from '../../../../src/services/productService';
import { Product, ProductUnit } from '../../../../src/type';
import { formatPrice } from '../../../../src/utils/helpers';

export default function ProductDetailScreen() {
  const { productId, epicerieId } = useLocalSearchParams<{ productId: string; epicerieId: string }>();
  const router = useRouter();
  const { t, language } = useLanguage();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [epicerieName, setEpicerieName] = useState<string>('');

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
        // Récupérer le nom de l'épicerie depuis le produit
        if (foundProduct.epicerieNom) {
          setEpicerieName(foundProduct.epicerieNom);
        }
      } else {
        Alert.alert(t('common.error'), t('products.productNotFound'));
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
        epicerieId: product.epicerieId,
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
        <Text style={styles.errorText}>{t('products.productNotFound')}</Text>
      </View>
    );
  }

  const isAvailable = product.isAvailable && product.stock > 0;

  return (
    <>
      {/* === HEADER RETOUR === */}
      <View style={styles.backHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle} numberOfLines={1}>
          {epicerieName || product.nom}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      {/* === IMAGE ZOOM MODAL === */}
      {showImageZoom && product.photoUrl && (
        <View style={styles.zoomModal}>
          <TouchableOpacity
            style={styles.zoomModalOverlay}
            onPress={() => setShowImageZoom(false)}
          />
          <View style={styles.zoomModalContent}>
            <FallbackImage
              urls={[product.photoUrl]}
              style={styles.zoomedImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={() => setShowImageZoom(false)}
            >
              <Text style={styles.zoomCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* === PRODUCT IMAGE SECTION === */}
          <TouchableOpacity
            style={styles.imageSection}
            onPress={() => setShowImageZoom(true)}
            activeOpacity={0.9}
          >
            {product.photoUrl ? (
              <FallbackImage
                urls={[product.photoUrl]}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.productImage, styles.imagePlaceholder]}>
                <Text style={styles.placeholderEmoji}>📦</Text>
              </View>
            )}
            {/* Gradient overlay */}
            <View style={styles.imageOverlay} />
            {/* Zoom indicator */}
            <View style={styles.zoomIndicator}>
              <Text style={styles.zoomText}>🔍 Zoom</Text>
            </View>
          </TouchableOpacity>

          {/* === PRODUCT NAME & CATEGORY === */}
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.nom}</Text>
            {product.categoryName && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{product.categoryName}</Text>
              </View>
            )}
            {product.brandName && (
              <View style={styles.brandTag}>
                <Text style={styles.brandTagText}>{product.brandName}</Text>
              </View>
            )}
          </View>

          {/* === QUANTITY & FORMAT SELECTOR === */}
          {isAvailable && (
            <View style={styles.quantitySection}>
              <ProductUnitDisplay
                product={product}
                onAddToCart={handleAddToCart}
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
              <Text style={styles.sectionLabel}>Caractéristiques</Text>
              {product.characteristics.map((char, index) => (
                <View key={char.id ?? index} style={[styles.charRow, index % 2 === 0 && styles.charRowEven]}>
                  <Text style={styles.charKey}>{char.keyName}</Text>
                  <Text style={styles.charValue}>{char.value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.spacer} />
        </ScrollView>

        {/* Out of Stock Message - Only show if not available */}
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
    paddingRight: 8,
    minWidth: 70,
  },
  backArrow: {
    color: '#fff',
    fontSize: 22,
    marginRight: 4,
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
  productImage: {
    width: '100%',
    height: '100%',
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
  brandTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  brandTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
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
    marginLeft: 12,
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
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffb3ba',
  },
  outOfStockText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
  },
});
