/**
 * Écran de détail produit pour épicier
 * Affiche toutes les informations du produit avec actions
 */

import { StockBadge } from '@/src/components/epicier/StockBadge';
import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import epicierProductService, {
  ProductDetailDTO,
} from '@/src/services/epicierProductService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function ProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;
    try {
      setIsLoading(true);
      const data = await epicierProductService.getProductById(Number(productId));
      setProduct(data);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger le produit',
      });
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Toast.show({
      type: 'success',
      text1: 'Copié!',
    });
  };

  const shareProduct = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `${product.nom} - ${product.prix.toFixed(2)} DH - Code: ${
          product.barcodes[0]?.barcode || 'N/A'
        }`,
        title: product.nom,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteProduct = () => {
    Alert.alert(
      'Supprimer le produit?',
      'Cette action est irréversible',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              if (product) {
                await epicierProductService.deleteProduct(product.id);
                Toast.show({
                  type: 'success',
                  text1: 'Produit supprimé',
                });
                router.back();
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Erreur',
              });
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (isLoading || !product) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const primaryBarcode = product.barcodes.find((b) => b.isPrimary);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons
              name="package-variant"
              size={80}
              color={Colors.textTertiary}
            />
          </View>
        )}

        {/* Header Info */}
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{product.nom}</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
            <TouchableOpacity
              onPress={shareProduct}
              style={styles.shareButton}
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={20}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Price */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Prix unitaire</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{product.prix.toFixed(2)}</Text>
              <Text style={styles.currency}>DH / {product.uniteVente}</Text>
            </View>
          </View>
        </View>

        {/* Stock Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock</Text>
          <View style={styles.stockContainer}>
            <StockBadge
              stock={product.stock}
              threshold={product.stockThreshold}
              size="large"
            />
            <Text style={styles.stockValue}>
              {product.stock} {product.uniteVente}
            </Text>
          </View>

          <Text style={styles.thresholdLabel}>
            Seuil d'alerte: {product.stockThreshold} {product.uniteVente}
          </Text>

          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() =>
              router.push({
                pathname: '/ajuster-stock',
                params: { productId: product.id.toString() },
              })
            }
          >
            <MaterialCommunityIcons
              name="pencil"
              size={18}
              color={Colors.textInverse}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={styles.adjustButtonText}>Ajuster le Stock</Text>
          </TouchableOpacity>
        </View>

        {/* Barcodes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Codes-barres</Text>
            {product.barcodes.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{product.barcodes.length}</Text>
              </View>
            )}
          </View>

          {product.barcodes.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun code-barre disponible
            </Text>
          ) : (
            <FlatList
              data={product.barcodes}
              scrollEnabled={false}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.barcodeCard,
                    item.isPrimary && styles.barcodeCardPrimary,
                  ]}
                >
                  <View style={styles.barcodeInfo}>
                    <View style={styles.barcodeBadge}>
                      <Text style={styles.barcodeBadgeText}>
                        {item.barcodeType === 'EXTERNAL' ? 'EXT' : 'INT'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.barcodeValue}>{item.barcode}</Text>
                      <Text style={styles.barcodeType}>
                        {item.barcodeType === 'EXTERNAL'
                          ? 'Code-barre externe'
                          : 'Code-barre interne'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(item.barcode)}
                    style={styles.copyButton}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={18}
                      color={Colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/modifier-produit',
                params: { productId: product.id.toString() },
              })
            }
          >
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={Colors.textInverse}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={styles.actionButtonText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleDeleteProduct}
          >
            <MaterialCommunityIcons
              name="delete"
              size={20}
              color={Colors.textInverse}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={styles.actionButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  productName: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  shareButton: {
    padding: Spacing.sm,
  },
  priceContainer: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  priceLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  currency: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.surface,
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  badgeCount: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  badgeCountText: {
    color: Colors.textInverse,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  stockContainer: {
    marginBottom: Spacing.md,
  },
  stockValue: {
    fontSize: FontSizes.base,
    color: Colors.text,
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  thresholdLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  adjustButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  adjustButtonText: {
    color: Colors.textInverse,
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
  barcodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.textTertiary,
  },
  barcodeCardPrimary: {
    borderLeftColor: Colors.primary,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  barcodeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.md,
  },
  barcodeBadgeText: {
    color: Colors.textInverse,
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  barcodeValue: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  barcodeType: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  copyButton: {
    padding: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.base,
    textAlign: 'center',
    marginVertical: Spacing.lg,
  },
  actionSection: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: Colors.danger,
  },
  actionButtonText: {
    color: Colors.textInverse,
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
});
