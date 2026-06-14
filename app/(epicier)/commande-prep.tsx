export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Écran de préparation de commande pour épicier
 * Gère le scanner de code-barre et la préparation complète de la commande
 */

import { BarcodeScanner } from '@/src/components/epicier/BarcodeScanner';
import { OrderItemCard } from '@/src/components/epicier/OrderItemCard';
import { QuantityInput } from '@/src/components/epicier/QuantityInput';
import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import barcodeService from '@/src/services/barcodeService';
import epicierOrderService from '@/src/services/epicierOrderService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

interface OrderItem {
  id: number;
  productNom: string;
  quantityCommanded: number;
  quantityActual: number;
  unit: string;
  prix: number;
  status: 'PENDING' | 'SCANNED' | 'UNAVAILABLE' | 'COMPLETED' | 'MODIFIED';
  barcode?: string;
}

interface OrderData {
  id: number;
  clientName?: string;
  clientNom?: string;
  status: string;
  items: OrderItem[];
  totalAmount?: number;
  total?: number;
  deliveryType?: string;
  createdAt: string;
}

/**
 * Maps OrderDetailDTO from API to OrderData for component use
 */
function mapOrderDetailToOrderData(
  apiOrder: any
): OrderData {
  return {
    id: apiOrder.id,
    clientName: apiOrder.clientName,
    clientNom: apiOrder.clientName, // API uses clientName
    status: apiOrder.status,
    totalAmount: apiOrder.totalAmount || apiOrder.total,
    total: apiOrder.totalAmount || apiOrder.total,
    createdAt: apiOrder.createdAt,
    deliveryType: apiOrder.deliveryType,
    items: (apiOrder.items || []).map((item: any) => {
      // Get unit - check multiple field names and variations
      let unit = 'UNIT';
      if (item.unitLabel && item.unitLabel.trim()) {
        unit = item.unitLabel.trim();
      } else if (item.uniteVente && item.uniteVente.trim()) {
        unit = item.uniteVente.trim();
      } else if (item.unit && item.unit.trim()) {
        unit = item.unit.trim();
      } else if (item.unitéVente && item.unitéVente.trim()) {
        unit = item.unitéVente.trim();
      } else if (item.unitType && item.unitType.trim()) {
        unit = item.unitType.trim();
      }

      // Get price - explicit null/undefined checks
      let prix = 0;
      if (item.prixUnitaire !== undefined && item.prixUnitaire !== null) {
        prix = item.prixUnitaire;
      } else if (item.prix !== undefined && item.prix !== null) {
        prix = item.prix;
      } else if (item.price !== undefined && item.price !== null) {
        prix = item.price;
      } else if (item.unitPrice !== undefined && item.unitPrice !== null) {
        prix = item.unitPrice;
      }

      // Get quantities - backend uses 'quantite', frontend expects both
      const quantityCommanded = item.quantite ?? item.quantityCommanded ?? item.quantitéCommandée ?? 0;
      const quantityActual = item.quantityActual ?? item.quantitéActuelle ?? quantityCommanded;

      return {
        id: item.id,
        productNom: item.productNom || item.nom || item.productName || 'Produit',
        quantityCommanded,
        quantityActual,
        unit,
        prix,
        status: item.status || 'PENDING',
        barcode: item.barcode || item.codeBarres,
      };
    }),
  };
}

export default function OrderPreparationScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);

  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  /** Verrou synchrone anti double-soumission (cf. completeOrder). */
  const isSavingRef = useRef(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<{
    itemId: number;
    quantity: number;
    unit: string;
  } | null>(null);
  /** Article en cours de marquage « indisponible » + message épicier. */
  const [unavailableItem, setUnavailableItem] = useState<{ itemId: number; name: string } | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const [markingUnavailable, setMarkingUnavailable] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setIsLoading(true);
      let apiData = await epicierOrderService.getOrderDetails(Number(orderId));
      // Parité avec le web : à l'ouverture de la préparation, faire passer la
      // commande ACCEPTED → PREPARING. Sans ça, si l'épicier coche les articles
      // sans scanner, le statut PREPARING était sauté (la commande passait
      // directement à READY au "Marquer comme prête"). Best-effort : on
      // n'empêche pas la préparation si la transition échoue.
      if (apiData?.status === 'ACCEPTED') {
        try {
          await epicierOrderService.updateOrderStatus(Number(orderId), 'PREPARING');
          apiData = await epicierOrderService.getOrderDetails(Number(orderId));
        } catch {
          /* on garde apiData chargé ; le backend basculera au 1er scan */
        }
      }
      const mappedOrder = mapOrderDetailToOrderData(apiData);
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

  const handleBarcodeScanned = async (barcode: string) => {
    if (!order) return;

    Vibration.vibrate(50);

    if (!barcodeService.isValidBarcode(barcode)) {
      Toast.show({
        type: 'error',
        text1: 'Code-barre invalide',
      });
      return;
    }

    // Find matching item in order
    const matchingItem = order.items.find(
      (item) =>
        item.barcode?.toLowerCase() === barcode.toLowerCase() ||
        item.status !== 'COMPLETED'
    );

    if (!matchingItem) {
      Toast.show({
        type: 'error',
        text1: 'Produit non trouvé',
        text2: 'Ce produit ne figure pas dans cette commande',
      });
      return;
    }

    setShowScanner(false);

    try {
      // Record the scan
      const updated = await epicierOrderService.recordProductScan(
        Number(orderId),
        barcode
      );
      setOrder(mapOrderDetailToOrderData(updated));

      Toast.show({
        type: 'success',
        text1: 'Produit scanné',
        text2: matchingItem.productNom,
      });

      // Scroll to the scanned item
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd();
      }, 100);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible d\'enregistrer le scan',
      });
    }
  };

  const handleMarkUnavailable = (itemId: number) => {
    const item = order?.items.find((i) => i.id === itemId);
    setUnavailableMessage('');
    setUnavailableItem({ itemId, name: item?.productNom ?? 'cet article' });
  };

  const confirmMarkUnavailable = async () => {
    if (!unavailableItem || markingUnavailable) return;
    const { itemId } = unavailableItem;
    try {
      setMarkingUnavailable(true);
      const updated = await epicierOrderService.markItemUnavailable(
        Number(orderId),
        itemId,
        unavailableMessage.trim() || undefined
      );
      setUnavailableItem(null);
      // Si tous les articles sont indisponibles, le backend annule la commande.
      if (updated?.status === 'CANCELLED') {
        Alert.alert(
          'Commande annulée',
          'Tous les articles étant indisponibles, la commande a été annulée et le client a été notifié.'
        );
        router.back();
        return;
      }
      setOrder(mapOrderDetailToOrderData(updated));
      Toast.show({ type: 'success', text1: 'Article marqué indisponible', text2: 'Le client a été notifié.' });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: typeof error === 'string' ? error : error?.message || 'Action impossible',
      });
    } finally {
      setMarkingUnavailable(false);
    }
  };

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (!order) return;

    try {
      const updated = await epicierOrderService.updateScannedQuantity(
        Number(orderId),
        itemId,
        newQuantity
      );
      setOrder(mapOrderDetailToOrderData(updated));
      setEditingQuantity(null);
      Toast.show({
        type: 'success',
        text1: 'Quantité mise à jour',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour la quantité',
      });
    }
  };

  const handleToggleItemComplete = async (itemId: number) => {
    if (!order) return;

    try {
      // Find the item
      const item = order.items.find(i => i.id === itemId);
      if (!item) return;

      // If item is PENDING, SCANNED or MODIFIED, mark as COMPLETED
      if (item.status === 'PENDING' || item.status === 'SCANNED' || item.status === 'MODIFIED') {
        try {
          const updated = await epicierOrderService.markItemComplete(
            Number(orderId),
            itemId
          );
          setOrder(mapOrderDetailToOrderData(updated));
          Toast.show({
            type: 'success',
            text1: 'Article marqué comme complet',
          });
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Erreur',
            text2: 'Impossible de marquer l\'article comme complet',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling item complete:', error);
    }
  };

  const handleCompleteOrder = () => {
    const incompleteItems = order?.items.filter(
      (item) => item.status !== 'COMPLETED' && item.status !== 'UNAVAILABLE'
    );

    if (incompleteItems && incompleteItems.length > 0) {
      Alert.alert(
        'Commande incomplète',
        `${incompleteItems.length} produit(s) n'ont pas été scannés. Continuer?`,
        [
          { text: 'Continuer la préparation', style: 'cancel' },
          {
            text: 'Marquer comme prête',
            onPress: completeOrder,
            style: 'default',
          },
        ]
      );
    } else {
      completeOrder();
    }
  };

  const completeOrder = async () => {
    // Verrou synchrone anti double-tap : `disabled={isSaving}` arrive après le
    // re-render — un 2e tap très rapide passerait avant. Le ref est immédiat.
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      setIsSaving(true);
      await epicierOrderService.completeOrder(Number(orderId), notes);
      Toast.show({
        type: 'success',
        text1: 'Commande complète',
        text2: 'La commande a été marquée comme prête',
      });
      router.back();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: error.message || 'Impossible de compléter la commande',
      });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isLoading || !order) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const completedItems = order.items.filter(
    (i) => i.status === 'COMPLETED' || i.status === 'UNAVAILABLE'
  );
  const pendingItems = order.items.filter(
    (i) => i.status === 'PENDING' || i.status === 'SCANNED'
  );
  const progressPercentage = Math.round(
    (completedItems.length / order.items.length) * 100
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {/* Order Header */}
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.clientName}>{order.clientName || order.clientNom || 'Client'}</Text>
            <Text style={styles.orderId}>Commande #{order.id}</Text>
          </View>
          <View style={styles.statusBadge}>
            <MaterialCommunityIcons
              name="progress-clock"
              size={16}
              color={Colors.textInverse}
              style={{ marginRight: Spacing.xs }}
            />
            <Text style={styles.statusBadgeText}>En préparation</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Progression</Text>
            <Text style={styles.progressValue}>
              {completedItems.length}/{order.items.length}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPercent}>{progressPercentage}%</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={Colors.success}
            />
            <View>
              <Text style={styles.statValue}>{completedItems.length}</Text>
              <Text style={styles.statLabel}>Complétés</Text>
            </View>
          </View>

          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color={Colors.warning}
            />
            <View>
              <Text style={styles.statValue}>{pendingItems.length}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
          </View>

          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="currency-eur"
              size={20}
              color={Colors.primary}
            />
            <View>
              <Text style={styles.statValue}>{(order.totalAmount || order.total || 0).toFixed(2)} DH</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Articles ({order.items.length})</Text>

          <FlatList
            data={order.items}
            scrollEnabled={false}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <OrderItemCard
                id={item.id}
                productName={item.productNom}
                quantityCommanded={item.quantityCommanded}
                quantityActual={item.quantityActual}
                unit={item.unit}
                price={item.prix}
                status={item.status}
                onPress={() => {
                  if (item.status === 'PENDING' || item.status === 'SCANNED') {
                    setSelectedItemId(item.id);
                  }
                }}
                onMarkUnavailable={() => handleMarkUnavailable(item.id)}
                onToggleComplete={() => handleToggleItemComplete(item.id)}
                isWeightVolume={['KILOGRAM', 'GRAM', 'LITER', 'MILLILITER'].includes(
                  item.unit
                )}
              />
            )}
          />
        </View>

        {/* Scanner Button (Floating) */}
        <View style={styles.scannerSection}>
          <TouchableOpacity
            style={styles.scannerButton}
            onPress={() => setShowScanner(true)}
          >
            <MaterialCommunityIcons
              name="barcode"
              size={24}
              color={Colors.textInverse}
              style={{ marginRight: Spacing.md }}
            />
            <Text style={styles.scannerButtonText}>Scanner un produit</Text>
          </TouchableOpacity>
        </View>

        {/* Completion Section */}
        <View style={styles.completionSection}>
          <TouchableOpacity
            style={styles.notesButton}
            onPress={() => setShowNotes(true)}
          >
            <MaterialCommunityIcons
              name="note-text"
              size={20}
              color={Colors.primary}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={styles.notesButtonText}>
              {notes ? `Notes: ${notes.substring(0, 30)}...` : 'Ajouter des notes'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.completeButton, isSaving && styles.completeButtonDisabled]}
            onPress={handleCompleteOrder}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="check-all"
                  size={20}
                  color={Colors.textInverse}
                  style={{ marginRight: Spacing.sm }}
                />
                <Text style={styles.completeButtonText}>Marquer comme prête</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onCancel={() => setShowScanner(false)}
          title="Scanner code-barre"
          subtitle="Pointez sur les codes-barres des produits"
          showManualInput
        />
      )}

      {/* Quantity Editing Modal */}
      {editingQuantity && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingQuantity(null)}
        >
          <View style={styles.quantityModal}>
            <View style={styles.quantityContent}>
              <View style={styles.quantityHeader}>
                <Text style={styles.quantityTitle}>Quantité réelle</Text>
                <TouchableOpacity onPress={() => setEditingQuantity(null)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={Colors.text}
                  />
                </TouchableOpacity>
              </View>

              <QuantityInput
                initialValue={editingQuantity.quantity}
                minValue={0}
                maxValue={1000}
                unit={editingQuantity.unit}
                onValueChange={(newQty) =>
                  setEditingQuantity({ ...editingQuantity, quantity: newQty })
                }
              />

              <TouchableOpacity
                style={styles.quantityConfirmButton}
                onPress={() =>
                  handleQuantityChange(editingQuantity.itemId, editingQuantity.quantity)
                }
              >
                <Text style={styles.quantityConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modale : marquer un article indisponible + message au client */}
      <Modal
        visible={!!unavailableItem}
        transparent
        animationType="slide"
        onRequestClose={() => setUnavailableItem(null)}
      >
        <View style={styles.uaOverlay}>
          <View style={styles.uaSheet}>
            {/* En-tête */}
            <View style={styles.uaHeader}>
              <View style={styles.uaIcon}>
                <MaterialCommunityIcons name="cancel" size={22} color="#C62828" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uaTitle}>Marquer l'article indisponible</Text>
                <Text style={styles.uaSubtitle}>Il sera retiré de la commande</Text>
              </View>
              <TouchableOpacity onPress={() => setUnavailableItem(null)} disabled={markingUnavailable} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Produit concerné */}
            <View style={styles.uaProduct}>
              <MaterialCommunityIcons name="package-variant" size={18} color="#64748b" />
              <Text style={styles.uaProductName} numberOfLines={2}>{unavailableItem?.name}</Text>
            </View>

            {/* Conséquences */}
            <View style={styles.uaNote}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#F59E0B" />
              <Text style={styles.uaNoteText}>
                Le client sera notifié et remboursé si la commande est déjà payée.
              </Text>
            </View>

            {/* Message */}
            <Text style={styles.uaLabel}>Message pour le client <Text style={styles.uaOpt}>(optionnel)</Text></Text>
            <View style={styles.uaChips}>
              {['Rupture de stock', 'Produit abîmé', 'Indisponible ce jour'].map(s => (
                <TouchableOpacity key={s} style={styles.uaChip} onPress={() => setUnavailableMessage(s)} disabled={markingUnavailable}>
                  <Text style={styles.uaChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.uaTextarea}
              placeholder="Expliquez au client pourquoi cet article est indisponible…"
              placeholderTextColor={Colors.textTertiary}
              value={unavailableMessage}
              onChangeText={setUnavailableMessage}
              multiline
              textAlignVertical="top"
              editable={!markingUnavailable}
              maxLength={500}
            />
            <Text style={styles.uaCount}>{unavailableMessage.length}/500</Text>

            {/* Actions */}
            <View style={styles.uaActions}>
              <TouchableOpacity style={styles.uaCancelBtn} onPress={() => setUnavailableItem(null)} disabled={markingUnavailable}>
                <Text style={styles.uaCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uaConfirmBtn, markingUnavailable && { opacity: 0.6 }]}
                onPress={confirmMarkUnavailable}
                disabled={markingUnavailable}
              >
                {markingUnavailable ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.uaConfirmText}>Marquer indisponible</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notes Modal */}
      <Modal
        visible={showNotes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotes(false)}
      >
        <View style={styles.notesModal}>
          <View style={styles.notesContent}>
            <View style={styles.notesHeader}>
              <Text style={styles.notesTitle}>Notes de préparation</Text>
              <TouchableOpacity onPress={() => setShowNotes(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.notesInputContainer}>
              <Text style={styles.notesInput}>{notes || 'Aucune note'}</Text>
            </View>

            <TouchableOpacity
              style={styles.notesConfirmButton}
              onPress={() => setShowNotes(false)}
            >
              <Text style={styles.notesConfirmText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clientName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  orderId: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  statusBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  progressSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  progressValue: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
  },
  progressPercent: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  statValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  itemsSection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  scannerSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  scannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  scannerButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  completionSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  notesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  notesButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    flex: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  quantityModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  quantityContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  quantityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  quantityTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  quantityConfirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  quantityConfirmText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  notesModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  notesContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  notesTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  notesInputContainer: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 100,
  },
  notesInput: {
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  notesConfirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  notesConfirmText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  // Modale « Article indisponible » (refonte UI)
  uaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  uaSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
  },
  uaHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  uaIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FDECEA',
  },
  uaTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  uaSubtitle: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  uaProduct: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12, marginBottom: 12,
  },
  uaProductName: { flex: 1, fontWeight: '600', color: Colors.text, fontSize: 14.5 },
  uaNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
    borderRadius: 8, padding: 10, marginBottom: 16,
  },
  uaNoteText: { flex: 1, fontSize: 12.5, color: '#7c5e10', lineHeight: 17 },
  uaLabel: { fontSize: 13.5, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  uaOpt: { fontWeight: '400', color: Colors.textTertiary },
  uaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  uaChip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surface,
  },
  uaChipText: { fontSize: 12.5, color: Colors.textSecondary, fontWeight: '500' },
  uaTextarea: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, minHeight: 100, color: Colors.text,
    fontSize: 15, lineHeight: 20, backgroundColor: Colors.surface,
  },
  uaCount: { textAlign: 'right', fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  uaActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  uaCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#EEEEEE',
  },
  uaCancelText: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  uaConfirmBtn: {
    flex: 1.4, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: Colors.danger,
  },
  uaConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
