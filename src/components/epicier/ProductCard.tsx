/**
 * ProductCard component for displaying product in lists
 * Shows product info, stock status, and quick actions
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';

interface ProductCardProps {
  id: number;
  nom: string;
  prix: number;
  stock: number;
  stockThreshold: number;
  uniteVente: string;
  imageUrl?: string;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  nom,
  prix,
  stock,
  stockThreshold,
  uniteVente,
  imageUrl,
  onPress,
  onEdit,
  onDelete,
}) => {
  // Determine stock status color
  const getStockColor = () => {
    if (stock === 0) return Colors.outOfStock;
    if (stock <= stockThreshold) return Colors.lowStock;
    return Colors.inStock;
  };

  const stockStatusColor = getStockColor();
  const stockStatusLabel =
    stock === 0 ? 'Rupture' : stock <= stockThreshold ? 'Stock bas' : 'En stock';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <MaterialCommunityIcons
            name="package-variant"
            size={40}
            color={Colors.textSecondary}
          />
        </View>
      )}

      {/* Stock Badge */}
      <View
        style={[
          styles.stockBadge,
          { backgroundColor: stockStatusColor },
        ]}
      >
        <Text style={styles.stockBadgeText}>{stockStatusLabel}</Text>
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={2}>
          {nom}
        </Text>

        <View style={styles.details}>
          <Text style={styles.price}>{prix.toFixed(2)} €</Text>
          <Text style={styles.unit}>/ {uniteVente}</Text>
        </View>

        <View style={styles.stockInfo}>
          <MaterialCommunityIcons
            name="warehouse"
            size={16}
            color={Colors.textSecondary}
          />
          <Text style={styles.stockText}>
            Stock: {stock} {uniteVente}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={18}
              color={Colors.primary}
            />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                'Confirmer',
                'Êtes-vous sûr de vouloir supprimer ce produit?',
                [
                  { text: 'Annuler', onPress: () => {}, style: 'cancel' },
                  {
                    text: 'Supprimer',
                    onPress: onDelete,
                    style: 'destructive',
                  },
                ]
              );
            }}
          >
            <MaterialCommunityIcons
              name="delete"
              size={18}
              color={Colors.danger}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  image: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  stockBadgeText: {
    color: Colors.textInverse,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.md,
    justifyContent: 'space-between',
    paddingRight: Spacing.sm,
  },
  productName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  unit: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  stockText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  actions: {
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
});
