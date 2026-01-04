import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { orderService } from '../../src/services/orderService';
import { orderPreparationService } from '../../src/services/orderPreparationService';
import { rechargeService } from '../../src/services/rechargeService';
import { Order, OrderItemDetail, OrderItemStatus, RechargeTransaction } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';

export default function PreparerCommandeScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingItemId, setProcessingItemId] = useState<number | null>(null);
  const [rechargeStatuses, setRechargeStatuses] = useState<Record<number, {
    hasTransaction: boolean;
    status: string;
    transaction?: RechargeTransaction;
  }>>({});

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      if (!orderId) {
        Alert.alert('Erreur', 'ID de commande manquant');
        router.back();
        return;
      }

      const data = await orderService.getOrderById(parseInt(orderId as string));
      setOrder(data);

      // Charger les statuts des recharges
      await loadRechargeStatuses(data);
    } catch (error: any) {
      console.error('Erreur chargement commande:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  };

  const loadRechargeStatuses = async (orderData: Order) => {
    const rechargeItems = orderData.items.filter(item => item.itemType === 'RECHARGE');
    console.log('[loadRechargeStatuses] Found recharge items:', rechargeItems.length);

    const statuses: Record<number, any> = {};

    for (const item of rechargeItems) {
      try {
        console.log(`[loadRechargeStatuses] Loading status for item ${item.id}`);
        const status = await rechargeService.getRechargeStatus(item.id);
        console.log(`[loadRechargeStatuses] Status for item ${item.id}:`, status);
        statuses[item.id] = status;
      } catch (error) {
        console.error(`[loadRechargeStatuses] Erreur chargement statut recharge ${item.id}:`, error);
        statuses[item.id] = { hasTransaction: false, status: 'NONE' };
      }
    }

    console.log('[loadRechargeStatuses] Final statuses:', statuses);
    setRechargeStatuses(statuses);
  };

  const handleExecuteRecharge = async (itemId: number) => {
    if (!order) return;

    Alert.alert(
      'Exécuter la recharge',
      'Confirmer l\'exécution de cette recharge téléphonique ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Exécuter',
          onPress: async () => {
            try {
              setProcessingItemId(itemId);
              const transaction = await rechargeService.executeRecharge(itemId);

              // Mettre à jour le statut de la recharge
              setRechargeStatuses(prev => ({
                ...prev,
                [itemId]: {
                  hasTransaction: true,
                  status: transaction.status,
                  transaction: transaction,
                },
              }));

              if (transaction.status === 'SUCCESS') {
                Alert.alert('✅ Succès', 'La recharge a été effectuée avec succès');
                // Marquer automatiquement l'item comme complété
                await handleMarkComplete(itemId);
              } else if (transaction.status === 'FAILED') {
                Alert.alert('❌ Échec', transaction.errorMessage || 'La recharge a échoué');
              } else {
                Alert.alert('⏳ En cours', 'La recharge est en cours de traitement');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible d\'exécuter la recharge');
            } finally {
              setProcessingItemId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkComplete = async (itemId: number) => {
    if (!order) return;

    try {
      setProcessingItemId(itemId);
      const updatedOrder = await orderPreparationService.markItemComplete(order.id, itemId);
      setOrder(updatedOrder);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de marquer l\'article');
    } finally {
      setProcessingItemId(null);
    }
  };

  const handleMarkUnavailable = async (itemId: number) => {
    if (!order) return;

    Alert.alert(
      'Article indisponible',
      'Confirmer que cet article n\'est pas disponible ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingItemId(itemId);
              const updatedOrder = await orderPreparationService.markItemUnavailable(order.id, itemId);
              setOrder(updatedOrder);
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de marquer l\'article');
            } finally {
              setProcessingItemId(null);
            }
          },
        },
      ]
    );
  };

  const handleCompletePreparation = async () => {
    if (!order) return;

    const stats = getStats();

    if (stats.pending > 0) {
      Alert.alert(
        'Préparation incomplète',
        `Il reste ${stats.pending} article(s) non traité(s). Voulez-vous vraiment terminer ?`,
        [
          { text: 'Non', style: 'cancel' },
          { text: 'Oui, terminer', onPress: completePreparation },
        ]
      );
    } else {
      completePreparation();
    }
  };

  const completePreparation = async () => {
    if (!order) return;

    try {
      setLoading(true);
      await orderPreparationService.completeOrderPreparation(order.id);
      Alert.alert(
        '✅ Préparation terminée',
        'La commande est maintenant prête pour livraison',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de terminer la préparation');
      setLoading(false);
    }
  };

  const getStats = () => {
    if (!order) return { total: 0, completed: 0, unavailable: 0, pending: 0 };

    const items = order.items;
    const completed = items.filter((item) => item.isComplete || item.status === 'COMPLETED').length;
    const unavailable = items.filter((item) => item.status === 'UNAVAILABLE' || item.quantite === 0).length;
    const pending = items.length - completed - unavailable;

    return {
      total: items.length,
      completed,
      unavailable,
      pending,
    };
  };

  const getProgressPercentage = () => {
    const stats = getStats();
    if (stats.total === 0) return 0;
    return Math.round(((stats.completed + stats.unavailable) / stats.total) * 100);
  };

  const getItemStatus = (item: OrderItemDetail): OrderItemStatus => {
    if (item.status) return item.status;
    if (item.isComplete) return 'COMPLETED';
    if (item.quantite === 0) return 'UNAVAILABLE';
    return 'PENDING';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Commande non trouvée</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stats = getStats();
  const progress = getProgressPercentage();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Préparation Commande</Text>
          <Text style={styles.headerSubtitle}>#{order.id} - {order.clientNom}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <MaterialCommunityIcons name="clipboard-check" size={24} color="#2196F3" />
            <Text style={styles.progressTitle}>Progression</Text>
            <Text style={styles.progressPercentage}>{progress}%</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#2196F3" />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
              </View>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Prêts</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FFEBEE' }]}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#f44336" />
              </View>
              <Text style={[styles.statValue, { color: '#f44336' }]}>{stats.unavailable}</Text>
              <Text style={styles.statLabel}>Indispo</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF3E0' }]}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#FF9800" />
              </View>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <View style={styles.instructionRow}>
            <MaterialCommunityIcons name="information" size={20} color="#2196F3" />
            <Text style={styles.instructionText}>
              Cochez chaque article disponible ou marquez-le comme indisponible
            </Text>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Articles à préparer ({stats.total})</Text>

          {order.items.map((item) => {
            const itemStatus = getItemStatus(item);
            const isProcessing = processingItemId === item.id;
            const isRecharge = item.itemType === 'RECHARGE';

            // Debug logs
            console.log(`[Item ${item.id}] Type: ${item.itemType}, IsRecharge: ${isRecharge}, Status: ${itemStatus}`);
            if (isRecharge) {
              console.log(`[Recharge ${item.id}] RechargeStatus:`, rechargeStatuses[item.id]);
            }

            return (
              <View key={item.id} style={styles.itemCard}>
                {/* Item Header */}
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {item.itemType === 'RECHARGE' ? '📱 ' : ''}
                      {item.productNom}
                    </Text>
                    {item.itemType === 'RECHARGE' ? (
                      <Text style={styles.itemDetail}>
                        {item.rechargePhoneNumber} • {item.rechargeOperator}
                      </Text>
                    ) : (
                      <Text style={styles.itemDetail}>
                        Quantité: {item.quantite}
                        {item.unitLabel ? ` ${item.unitLabel}` : ''}
                      </Text>
                    )}
                    <Text style={styles.itemPrice}>{formatPrice(item.total)}</Text>
                  </View>

                  {/* Status Badge - seulement pour les produits normaux */}
                  {!isRecharge && (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            itemStatus === 'COMPLETED'
                              ? '#4CAF50'
                              : itemStatus === 'UNAVAILABLE'
                              ? '#f44336'
                              : '#FF9800',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          itemStatus === 'COMPLETED'
                            ? 'check-circle'
                            : itemStatus === 'UNAVAILABLE'
                            ? 'close-circle'
                            : 'clock-outline'
                        }
                        size={16}
                        color="#fff"
                      />
                      <Text style={styles.statusText}>
                        {itemStatus === 'COMPLETED'
                          ? 'Prêt'
                          : itemStatus === 'UNAVAILABLE'
                          ? 'Indispo'
                          : 'En attente'}
                      </Text>
                    </View>
                  )}

                  {/* Status Badge pour RECHARGES - basé sur la transaction */}
                  {isRecharge && (() => {
                    const rechargeStatus = rechargeStatuses[item.id];
                    const txStatus = rechargeStatus?.status;

                    if (txStatus === 'SUCCESS') {
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                          <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
                          <Text style={styles.statusText}>Effectuée</Text>
                        </View>
                      );
                    }

                    if (txStatus === 'FAILED') {
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: '#f44336' }]}>
                          <MaterialCommunityIcons name="alert-circle" size={16} color="#fff" />
                          <Text style={styles.statusText}>Échouée</Text>
                        </View>
                      );
                    }

                    if (txStatus === 'PROCESSING' || txStatus === 'PENDING') {
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
                          <MaterialCommunityIcons name="clock-outline" size={16} color="#fff" />
                          <Text style={styles.statusText}>En cours</Text>
                        </View>
                      );
                    }

                    // Pas encore exécutée
                    return (
                      <View style={[styles.statusBadge, { backgroundColor: '#9C27B0' }]}>
                        <MaterialCommunityIcons name="cellphone" size={16} color="#fff" />
                        <Text style={styles.statusText}>À exécuter</Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Actions pour RECHARGES */}
                {isRecharge && (
                  <View style={styles.itemActions}>
                    {(() => {
                      const rechargeStatus = rechargeStatuses[item.id];
                      console.log(`[Recharge ${item.id}] Rendering actions, status:`, rechargeStatus);

                      if (!rechargeStatus || !rechargeStatus.hasTransaction) {
                        // Pas encore de transaction - afficher bouton d'exécution
                        console.log(`[Recharge ${item.id}] Showing execute button`);
                        return (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.rechargeBtn, { flex: 1 }]}
                            onPress={() => handleExecuteRecharge(item.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <MaterialCommunityIcons name="cellphone-arrow-down" size={18} color="#fff" />
                                <Text style={styles.actionBtnText}>Exécuter la recharge</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        );
                      }

                      const txStatus = rechargeStatus.status;

                      if (txStatus === 'SUCCESS') {
                        // Recharge réussie
                        return (
                          <View style={[styles.rechargeStatusCard, styles.rechargeSuccess]}>
                            <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                            <Text style={styles.rechargeStatusText}>Recharge effectuée avec succès</Text>
                          </View>
                        );
                      }

                      if (txStatus === 'FAILED') {
                        // Recharge échouée - possibilité de réessayer
                        return (
                          <View style={{ flex: 1 }}>
                            <View style={[styles.rechargeStatusCard, styles.rechargeFailed]}>
                              <MaterialCommunityIcons name="alert-circle" size={20} color="#f44336" />
                              <Text style={styles.rechargeStatusText}>
                                {rechargeStatus.transaction?.errorMessage || 'Échec de la recharge'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.retryBtn, { marginTop: 8 }]}
                              onPress={() => handleExecuteRecharge(item.id)}
                              disabled={isProcessing}
                            >
                              <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                              <Text style={styles.actionBtnText}>Réessayer</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      if (txStatus === 'PROCESSING' || txStatus === 'PENDING') {
                        // En cours
                        return (
                          <View style={[styles.rechargeStatusCard, styles.rechargeProcessing]}>
                            <ActivityIndicator size="small" color="#FF9800" />
                            <Text style={styles.rechargeStatusText}>Recharge en cours...</Text>
                          </View>
                        );
                      }

                      // Par défaut, afficher le bouton d'exécution
                      console.log(`[Recharge ${item.id}] Unknown status: ${txStatus}, showing execute button`);
                      return (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rechargeBtn, { flex: 1 }]}
                          onPress={() => handleExecuteRecharge(item.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <MaterialCommunityIcons name="cellphone-arrow-down" size={18} color="#fff" />
                              <Text style={styles.actionBtnText}>Exécuter la recharge</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                )}

                {/* Actions pour PRODUITS normaux */}
                {!isRecharge && itemStatus === 'PENDING' && (
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.completeBtn]}
                      onPress={() => handleMarkComplete(item.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="check-bold" size={18} color="#fff" />
                          <Text style={styles.actionBtnText}>Disponible</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.unavailableBtn]}
                      onPress={() => handleMarkUnavailable(item.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="close-thick" size={18} color="#fff" />
                          <Text style={styles.actionBtnText}>Indisponible</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Complete Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            (loading || stats.total === 0) && styles.completeButtonDisabled,
          ]}
          onPress={handleCompletePreparation}
          disabled={loading || stats.total === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-all" size={24} color="#fff" />
              <Text style={styles.completeButtonText}>
                Terminer la préparation ({stats.completed}/{stats.total})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  progressCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  progressPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  instructionsCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 13,
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  itemsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  completeBtn: {
    backgroundColor: '#4CAF50',
  },
  unavailableBtn: {
    backgroundColor: '#f44336',
  },
  rechargeBtn: {
    backgroundColor: '#9C27B0',
  },
  retryBtn: {
    backgroundColor: '#FF9800',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rechargeStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  rechargeSuccess: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  rechargeFailed: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  rechargeProcessing: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  rechargeStatusText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  completeButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
});
