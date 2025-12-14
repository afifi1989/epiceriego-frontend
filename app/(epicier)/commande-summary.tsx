/**
 * Écran de résumé de commande pour épicier
 * Affiche le récapitulatif final après préparation
 */

import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import epicierOrderService from '@/src/services/epicierOrderService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

interface SummaryItem {
  id: number;
  productNom: string;
  quantityCommanded: number;
  quantityActual: number;
  unit: string;
  prix: number;
  status: 'PENDING' | 'SCANNED' | 'UNAVAILABLE' | 'COMPLETED' | 'MODIFIED';
}

interface OrderSummary {
  id: number;
  clientName?: string;
  clientPhone?: string;
  deliveryType?: string;
  deliveryAddress?: string;
  items: SummaryItem[];
  totalAmount?: number;
  total?: number;
  status: string;
  createdAt: string;
  notes?: string;
}

/**
 * Maps OrderDetailDTO from API to OrderSummary for component use
 */
function mapOrderDetailToOrderSummary(apiOrder: any): OrderSummary {
  return {
    id: apiOrder.id,
    clientName: apiOrder.clientName,
    clientPhone: apiOrder.clientPhone,
    deliveryType: apiOrder.deliveryType || 'STANDARD',
    deliveryAddress: apiOrder.deliveryAddress,
    status: apiOrder.status,
    totalAmount: apiOrder.totalAmount,
    total: apiOrder.totalAmount,
    createdAt: apiOrder.createdAt,
    notes: apiOrder.notes,
    items: (apiOrder.items || []).map((item: any) => ({
      id: item.id,
      productNom: item.productNom || item.nom || item.productName || 'Produit',
      quantityCommanded: item.quantityCommanded || item.quantitéCommandée || 0,
      quantityActual: item.quantityActual || item.quantitéActuelle || item.quantityCommanded || 0,
      unit: item.uniteVente || item.unit || item.unitéVente || 'UNIT',
      prix: item.prix || item.price || item.unitPrice || 0, // Handle multiple price field names
      status: item.status || 'PENDING',
    })),
  };
}

export default function OrderSummaryScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setIsLoading(true);
      const apiData = await epicierOrderService.getOrderDetails(Number(orderId));
      const mappedOrder = mapOrderDetailToOrderSummary(apiData);
      setOrder(mappedOrder);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger la commande',
      });
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      // Integration with print service would go here
      Toast.show({
        type: 'success',
        text1: 'Impression',
        text2: 'Commande envoyée à l\'imprimante',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible d\'imprimer la commande',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    try {
      // Share order details
      Toast.show({
        type: 'success',
        text1: 'Partage',
        text2: 'Commande partagée',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
      });
    }
  };

  const handleMarkAsReady = async () => {
    Alert.alert(
      'Marquer comme prête?',
      'La commande sera marquée comme prête pour retrait/livraison',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await epicierOrderService.updateOrderStatus(Number(orderId), 'READY');
              Toast.show({
                type: 'success',
                text1: 'Commande marquée comme prête',
              });
              router.back();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Erreur',
              });
            }
          },
        },
      ]
    );
  };

  if (isLoading || !order) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const unavailableItems = order.items.filter((i) => i.status === 'UNAVAILABLE');
  const totalItems = order.items.length;
  const completedItems = order.items.filter((i) => i.status === 'COMPLETED');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.clientName}>{order.clientName}</Text>
              <Text style={styles.orderId}>Commande #{order.id}</Text>
            </View>
            <View style={styles.readyBadge}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={Colors.textInverse}
                style={{ marginRight: Spacing.xs }}
              />
              <Text style={styles.readyBadgeText}>Prête</Text>
            </View>
          </View>

          {/* Order Info */}
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons
                name={order.deliveryType === 'DELIVERY' ? 'truck' : 'store'}
                size={20}
                color={Colors.primary}
              />
              <View style={{ marginLeft: Spacing.md }}>
                <Text style={styles.infoLabel}>Mode</Text>
                <Text style={styles.infoValue}>
                  {order.deliveryType === 'DELIVERY' ? 'Livraison' : 'Retrait'}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <MaterialCommunityIcons
                name="phone"
                size={20}
                color={Colors.primary}
              />
              <View style={{ marginLeft: Spacing.md }}>
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={styles.infoValue}>{order.clientPhone}</Text>
              </View>
            </View>
          </View>

          {order.deliveryType === 'DELIVERY' && order.deliveryAddress && (
            <View style={styles.addressBox}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color={Colors.primary}
                style={{ marginRight: Spacing.sm }}
              />
              <Text style={styles.addressText}>{order.deliveryAddress}</Text>
            </View>
          )}
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryStats}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Articles</Text>
            <Text style={styles.statNumber}>{totalItems}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Complétés</Text>
            <Text style={styles.statNumber}>{completedItems.length}</Text>
          </View>

          {unavailableItems.length > 0 && (
            <View style={[styles.statBox, styles.statBoxWarning]}>
              <Text style={styles.statLabel}>Indisponibles</Text>
              <Text style={styles.statNumberWarning}>{unavailableItems.length}</Text>
            </View>
          )}

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statNumberPrice}>{(order.totalAmount || order.total || 0).toFixed(2)} DH</Text>
          </View>
        </View>

        {/* Items Summary */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Articles commandés</Text>

          <FlatList
            data={order.items}
            scrollEnabled={false}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.itemRow,
                  item.status === 'UNAVAILABLE' && styles.itemRowUnavailable,
                ]}
              >
                {/* Status Icon */}
                <View
                  style={[
                    styles.itemStatusIcon,
                    item.status === 'COMPLETED' && styles.itemStatusCompleted,
                    item.status === 'UNAVAILABLE' && styles.itemStatusUnavailable,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      item.status === 'UNAVAILABLE'
                        ? 'close'
                        : 'check'
                    }
                    size={16}
                    color={Colors.textInverse}
                  />
                </View>

                {/* Item Info */}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.productNom}</Text>
                  <View style={styles.itemQuantities}>
                    <Text style={styles.itemQuantityLabel}>
                      Commandé: <Text style={styles.itemQuantityValue}>{item.quantityCommanded}</Text>
                    </Text>
                    {item.quantityActual !== item.quantityCommanded && (
                      <Text style={styles.itemQuantityLabel}>
                        Réel: <Text style={styles.itemQuantityValue}>{item.quantityActual}</Text>
                      </Text>
                    )}
                    <Text style={styles.itemUnit}>{item.unit}</Text>
                  </View>
                </View>

                {/* Price */}
                <View style={styles.itemPrice}>
                  <Text style={styles.itemPriceValue}>
                    {(item.prix * item.quantityActual).toFixed(2)} DH
                  </Text>
                </View>
              </View>
            )}
          />
        </View>

        {/* Warnings */}
        {unavailableItems.length > 0 && (
          <View style={styles.warningBox}>
            <MaterialCommunityIcons
              name="alert"
              size={20}
              color={Colors.danger}
              style={{ marginRight: Spacing.md }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>
                {unavailableItems.length} article(s) indisponible(s)
              </Text>
              <Text style={styles.warningText}>
                Le client doit être informé des articles manquants
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {order.notes && (
          <View style={styles.notesBox}>
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons
                name="note-text"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.notesTitle}>Notes de préparation</Text>
            </View>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="printer"
                  size={20}
                  color={Colors.primary}
                  style={{ marginRight: Spacing.sm }}
                />
                <Text style={styles.secondaryButtonText}>Imprimer</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShare}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color={Colors.primary}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={styles.secondaryButtonText}>Partager</Text>
          </TouchableOpacity>
        </View>

        {/* Mark as Ready Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleMarkAsReady}
        >
          <MaterialCommunityIcons
            name="check-all"
            size={20}
            color={Colors.textInverse}
            style={{ marginRight: Spacing.sm }}
          />
          <Text style={styles.primaryButtonText}>Confirmer prêt pour retrait/livraison</Text>
        </TouchableOpacity>
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
  headerCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientName: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  orderId: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  readyBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  infoGrid: {
    gap: Spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  addressText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    flex: 1,
  },
  summaryStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statBoxWarning: {
    borderColor: Colors.danger,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  statNumber: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  statNumberWarning: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.danger,
  },
  statNumberPrice: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  itemsSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  itemRowUnavailable: {
    opacity: 0.6,
    borderColor: Colors.danger,
  },
  itemStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemStatusCompleted: {
    backgroundColor: Colors.success,
  },
  itemStatusUnavailable: {
    backgroundColor: Colors.danger,
  },
  itemInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
  },
  itemQuantities: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemQuantityLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  itemQuantityValue: {
    fontWeight: '700',
    color: Colors.text,
  },
  itemUnit: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  itemPrice: {
    alignItems: 'flex-end',
  },
  itemPriceValue: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: Colors.primary,
  },
  warningBox: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  warningTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  warningText: {
    fontSize: FontSizes.xs,
    color: Colors.text,
  },
  notesBox: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  notesText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.primary,
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.success,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textInverse,
  },
});
