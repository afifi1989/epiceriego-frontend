/**
 * OrderItemCard component - displays individual order item
 * Shows product info, quantity, and scan status
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';

interface OrderItemCardProps {
  id: number;
  productName: string;
  quantityCommanded: number;
  quantityActual?: number;
  unit: string;
  price: number;
  status: 'PENDING' | 'SCANNED' | 'UNAVAILABLE' | 'MODIFIED' | 'COMPLETED';
  onPress: () => void;
  onMarkUnavailable?: () => void;
  onToggleComplete?: () => void;
  isWeightVolume?: boolean;
}

export const OrderItemCard: React.FC<OrderItemCardProps> = ({
  id,
  productName,
  quantityCommanded,
  quantityActual,
  unit,
  price,
  status,
  onPress,
  onMarkUnavailable,
  onToggleComplete,
  isWeightVolume = false,
}) => {
  const getStatusIcon = (): { icon: string; color: string } => {
    switch (status) {
      case 'SCANNED':
      case 'COMPLETED':
        return { icon: 'check-circle', color: Colors.success };
      case 'UNAVAILABLE':
        return { icon: 'alert-circle', color: Colors.danger };
      case 'MODIFIED':
        return { icon: 'pencil-circle', color: Colors.warning };
      default:
        return { icon: 'checkbox-blank-circle-outline', color: Colors.textTertiary };
    }
  };

  const statusIcon = getStatusIcon();
  const displayQuantity =
    quantityActual !== undefined && quantityActual !== quantityCommanded
      ? `${quantityActual}/${quantityCommanded}`
      : quantityCommanded;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Status Indicator */}
      <TouchableOpacity
        style={styles.statusIcon}
        onPress={(e) => {
          e.stopPropagation();
          if ((status === 'PENDING' || status === 'SCANNED' || status === 'MODIFIED') && onToggleComplete) {
            onToggleComplete();
          }
        }}
        disabled={status === 'UNAVAILABLE' || status === 'COMPLETED'}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={statusIcon.icon}
          size={24}
          color={statusIcon.color}
        />
      </TouchableOpacity>

      {/* Product Info */}
      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={2}>
          {productName}
        </Text>

        <View style={styles.quantityRow}>
          <View style={styles.quantityContainer}>
            <MaterialCommunityIcons
              name="basket"
              size={14}
              color={Colors.textSecondary}
              style={{ marginRight: Spacing.xs }}
            />
            <Text style={styles.quantity}>
              {displayQuantity} {unit}
            </Text>
          </View>

          {isWeightVolume && status !== 'SCANNED' && (
            <Text style={styles.weightNote}>À peser</Text>
          )}
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {typeof price === 'number' ? `${(price * quantityCommanded).toFixed(2)} DH` : 'N/A'}
          </Text>
          {quantityActual !== undefined && quantityActual !== quantityCommanded && typeof price === 'number' && (
            <Text style={styles.actualPrice}>
              → {(price * quantityActual).toFixed(2)} DH
            </Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {status === 'PENDING' && onMarkUnavailable && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                'Non disponible?',
                'Marquer cet article comme non disponible?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Confirmer',
                    onPress: onMarkUnavailable,
                    style: 'destructive',
                  },
                ]
              );
            }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <MaterialCommunityIcons
              name="close-circle-outline"
              size={20}
              color={Colors.danger}
            />
          </TouchableOpacity>
        )}

        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={Colors.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  statusIcon: {
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  productName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantity: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  weightNote: {
    fontSize: FontSizes.xs,
    color: Colors.warning,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  actualPrice: {
    fontSize: FontSizes.xs,
    color: Colors.warning,
    marginLeft: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.md,
  },
  actionButton: {
    padding: Spacing.sm,
  },
});
