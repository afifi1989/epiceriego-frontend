import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/constants/config';
import { LivreurCard } from '../../src/components/epicier/LivreurCard';
import { LivreurStatsCard } from '../../src/components/epicier/LivreurStatsCard';
import {
  epicierLivreurService,
  Livreur,
  AssignedLivreur,
} from '../../src/services/epicierLivreurService';
import { orderService } from '../../src/services/orderService';
import { Order } from '../../src/type';
import { LivreurAssignmentModal } from '../../src/components/epicier/LivreurAssignmentModal';

type TabType = 'available' | 'assigned' | 'orders';

export default function LivreursScreen() {
  const [unassignedLivreurs, setUnassignedLivreurs] = useState<Livreur[]>([]);
  const [assignedLivreurs, setAssignedLivreurs] = useState<AssignedLivreur[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [assigningLivreurId, setAssigningLivreurId] = useState<number | null>(null);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedLivreur, setSelectedLivreur] = useState<Livreur | AssignedLivreur | null>(null);
  const [showOrderLivreurModal, setShowOrderLivreurModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedLivreurForOrder, setSelectedLivreurForOrder] = useState<number | null>(null);
  const [assigningOrderLivreur, setAssigningOrderLivreur] = useState(false);

  // Charger l'épicerieId depuis le storage
  useEffect(() => {
    const loadEpicerieId = async () => {
      try {
        const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (userData) {
          const user = JSON.parse(userData);
          setEpicerieId(user.epicerieId);
        }
      } catch (error) {
        console.error('Erreur chargement épicerieId:', error);
      }
    };

    loadEpicerieId();
  }, []);

  // Charger les livreurs et commandes
  const loadLivreurs = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[loadLivreurs] 🔄 Chargement des livreurs...');
      const [unassigned, assigned, orders] = await Promise.all([
        epicierLivreurService.getUnassignedLivreurs(),
        epicierLivreurService.getAssignedLivreurs(),
        orderService.getEpicerieOrders(), // Charger les commandes de l'épicerie
      ]);

      console.log('[loadLivreurs] ✅ Données reçues:');
      console.log('  - Livreurs non-assignés:', unassigned);
      console.log('  - Livreurs assignés:', assigned);
      console.log('  - Commandes:', orders);

      const unassignedList = unassigned && Array.isArray(unassigned) ? unassigned : [];
      const assignedList = assigned && Array.isArray(assigned) ? assigned : [];

      setUnassignedLivreurs(unassignedList);
      setAssignedLivreurs(assignedList);

      console.log('[loadLivreurs] 📊 Nombre de livreurs:', {
        unassigned: unassignedList.length,
        assigned: assignedList.length,
      });

      // Filtrer les commandes avec status READY
      if (orders && Array.isArray(orders)) {
        const ready = orders.filter(order => order && order.status === 'READY');
        console.log('[loadLivreurs] 📦 Commandes prêtes:', ready.length);
        setReadyOrders(ready);
      } else {
        setReadyOrders([]);
      }
    } catch (error: any) {
      console.error('[loadLivreurs] ❌ Erreur:', error);
      setUnassignedLivreurs([]);
      setAssignedLivreurs([]);
      setReadyOrders([]);
      Alert.alert('Erreur', error.message || 'Impossible de charger les données');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger au montage
  useEffect(() => {
    loadLivreurs();
  }, [loadLivreurs]);

  // Rafraîchir quand l'écran est activé
  useFocusEffect(
    useCallback(() => {
      loadLivreurs();
    }, [loadLivreurs])
  );

  // Rafraîchissement manuel
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLivreurs();
    setIsRefreshing(false);
  };

  // Assigner un livreur
  const handleAssignLivreur = async (livreur: Livreur) => {
    console.log('[handleAssignLivreur] epicerieId:', epicerieId, 'livreur:', livreur.nom);
    if (!epicerieId) {
      console.error('[handleAssignLivreur] ❌ epicerieId non trouvé');
      Alert.alert('Erreur', 'Épicerie non trouvée');
      return;
    }

    console.log('[handleAssignLivreur] ✅ Ouverture du modal');
    setSelectedLivreur(livreur);
    setShowConfirmModal(true);
  };

  // Confirmer l'assignation
  const confirmAssign = async () => {
    console.log('[confirmAssign] epicerieId:', epicerieId, 'selectedLivreur:', selectedLivreur?.nom);
    if (!epicerieId || !selectedLivreur) {
      console.error('[confirmAssign] ❌ Données manquantes');
      return;
    }

    try {
      console.log('[confirmAssign] ✅ Assignation en cours...');
      setAssigningLivreurId((selectedLivreur as Livreur).id);
      setShowConfirmModal(false);

      const livreur = selectedLivreur as Livreur;

      await epicierLivreurService.assignLivreur(epicerieId, {
        user: {
          id: livreur.userId,
          nom: livreur.nom,
          email: `${livreur.nom.replace(/\s+/g, '').toLowerCase()}@example.com`,
          telephone: livreur.telephone,
          role: 'LIVREUR',
        },
      });

      console.log('[confirmAssign] ✅ Succès');
      Alert.alert('Succès', `${livreur.nom} a été assigné à votre épicerie`);
      await loadLivreurs();
    } catch (error: any) {
      console.error('[confirmAssign] ❌ Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'assigner le livreur');
    } finally {
      setAssigningLivreurId(null);
      setSelectedLivreur(null);
    }
  };

  // Désassigner un livreur
  const handleUnassignLivreur = async (livreur: AssignedLivreur) => {
    if (!epicerieId) {
      Alert.alert('Erreur', 'Épicerie non trouvée');
      return;
    }

    Alert.alert(
      'Confirmation',
      `Êtes-vous sûr de vouloir retirer ${livreur.nom} de votre épicerie ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              setAssigningLivreurId(livreur.id);
              await epicierLivreurService.unassignLivreur(epicerieId, livreur.id);
              Alert.alert('Succès', `${livreur.nom} a été retiré de votre épicerie`);
              await loadLivreurs();
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de retirer le livreur');
            } finally {
              setAssigningLivreurId(null);
            }
          },
        },
      ]
    );
  };

  // Assigner une commande à un livreur
  const handleAssignOrderLivreur = (order: Order) => {
    console.log('[handleAssignOrderLivreur] Ouverture modal pour commande:', order.id);
    setSelectedOrderId(order.id);
    setSelectedLivreurForOrder(null);
    setShowOrderLivreurModal(true);
  };

  // Confirmer l'assignation de commande
  const confirmAssignOrderToLivreur = async () => {
    if (!selectedOrderId || !selectedLivreurForOrder) return;

    try {
      setAssigningOrderLivreur(true);
      await epicierLivreurService.assignOrderToLivreur(
        selectedOrderId,
        selectedLivreurForOrder
      );
      Alert.alert('✅', 'Livreur assigné à la commande');
      setShowOrderLivreurModal(false);
      setSelectedOrderId(null);
      setSelectedLivreurForOrder(null);
      await loadLivreurs();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'assigner le livreur');
    } finally {
      setAssigningOrderLivreur(false);
    }
  };

  const renderUnassignedLivreur = ({ item }: { item: Livreur }) => {
    console.log('[renderUnassignedLivreur] Rendu du livreur:', item.nom, 'ID:', item.id);
    return (
      <LivreurCard
        livreur={item}
        onAssign={() => {
          console.log('[renderUnassignedLivreur] ✅ handleAssignLivreur appelé pour:', item.nom);
          handleAssignLivreur(item);
        }}
        isAssigned={false}
        isLoading={assigningLivreurId === item.id}
      />
    );
  };

  const renderAssignedLivreur = ({ item }: { item: AssignedLivreur }) => (
    <LivreurCard
      livreur={item}
      onUnassign={() => handleUnassignLivreur(item)}
      isAssigned={true}
      isLoading={assigningLivreurId === item.id}
    />
  );

  const renderEmptyUnassigned = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🚚</Text>
      <Text style={styles.emptyTitle}>Aucun livreur disponible</Text>
      <Text style={styles.emptySubtitle}>
        Tous les livreurs sont déjà assignés à une épicerie
      </Text>
    </View>
  );

  const renderEmptyAssigned = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>Aucun livreur assigné</Text>
      <Text style={styles.emptySubtitle}>
        Assignez des livreurs pour gérer vos livraisons
      </Text>
    </View>
  );

  const renderReadyOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Commande #{item.id}</Text>
          <Text style={styles.orderClient}>{item.clientNom}</Text>
        </View>
        <View style={styles.orderStatusBadge}>
          <Text style={styles.orderStatusText}>Prête</Text>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <Text style={styles.orderDetailText}>
          📍 {item.adresseLivraison}
        </Text>
        <Text style={styles.orderDetailText}>
          💰 {item.total}€
        </Text>
      </View>
      <TouchableOpacity
        style={styles.assignOrderBtn}
        onPress={() => handleAssignOrderLivreur(item)}
      >
        <Text style={styles.assignOrderBtnText}>Assigner Livreur</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyOrders = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>✅</Text>
      <Text style={styles.emptyTitle}>Aucune commande prête</Text>
      <Text style={styles.emptySubtitle}>
        Les commandes prêtes s'afficheront ici
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des livreurs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Statistiques */}
      <LivreurStatsCard
        totalUnassigned={unassignedLivreurs.length}
        totalAssigned={assignedLivreurs.length}
        availableCount={assignedLivreurs.filter(l => l.isAvailable).length}
      />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            📋 À Assigner ({unassignedLivreurs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assigned' && styles.tabActive]}
          onPress={() => setActiveTab('assigned')}
        >
          <Text style={[styles.tabText, activeTab === 'assigned' && styles.tabTextActive]}>
            ✅ Assignés ({assignedLivreurs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            📦 Commandes ({readyOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Debug info */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            🔍 Tab: {activeTab} | Unassigned: {unassignedLivreurs.length} | Assigned: {assignedLivreurs.length} | Orders: {readyOrders.length}
          </Text>
        </View>
      )}

      {/* Listes */}
      {activeTab === 'available' ? (
        <FlatList
          data={unassignedLivreurs}
          renderItem={renderUnassignedLivreur}
          keyExtractor={(item, index) => `unassigned-${item?.id || index}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
            />
          }
          ListEmptyComponent={renderEmptyUnassigned}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      ) : activeTab === 'assigned' ? (
        <FlatList
          data={assignedLivreurs}
          renderItem={renderAssignedLivreur}
          keyExtractor={(item, index) => `assigned-${item?.id || index}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
            />
          }
          ListEmptyComponent={renderEmptyAssigned}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={readyOrders}
          renderItem={renderReadyOrder}
          keyExtractor={(item, index) => `order-${item?.id || index}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
            />
          }
          ListEmptyComponent={renderEmptyOrders}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de confirmation livreur */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          console.log('[Modal] ❌ Modal fermée via back button');
          setShowConfirmModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✅ Assigner un Livreur</Text>
            {selectedLivreur && (
              <>
                <Text style={styles.modalSubtitle}>
                  Confirmer l'assignation de {selectedLivreur.nom} à votre épicerie ?
                </Text>
                <ScrollView style={styles.modalInfo}>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Nom:</Text>
                    <Text style={styles.infoValue}>{selectedLivreur.nom}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Téléphone:</Text>
                    <Text style={styles.infoValue}>{selectedLivreur.telephone}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Statut:</Text>
                    <Text style={styles.infoValue}>
                      {selectedLivreur.isAvailable ? '🟢 Disponible' : '🔴 Occupé'}
                    </Text>
                  </View>
                </ScrollView>
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  console.log('[Modal] ❌ Annulation de l\'assignation');
                  setShowConfirmModal(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={() => {
                  console.log('[Modal] ✅ Confirmation de l\'assignation');
                  confirmAssign();
                }}
              >
                <Text style={styles.confirmBtnText}>Assigner</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal d'assignation commande */}
      <LivreurAssignmentModal
        visible={showOrderLivreurModal}
        livreurs={assignedLivreurs}
        selectedLivreurId={selectedLivreurForOrder}
        isLoading={assigningOrderLivreur}
        onSelect={(livreur) => setSelectedLivreurForOrder(livreur.id)}
        onConfirm={confirmAssignOrderToLivreur}
        onCancel={() => {
          setShowOrderLivreurModal(false);
          setSelectedOrderId(null);
          setSelectedLivreurForOrder(null);
        }}
        title="Assigner un Livreur à la Commande"
        description="Sélectionnez un livreur disponible"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  debugInfo: {
    backgroundColor: '#FFF3CD',
    padding: 8,
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  debugText: {
    fontSize: 11,
    color: '#333',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2196F3',
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  modalInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    maxHeight: 200,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#2196F3',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  orderClient: {
    fontSize: 13,
    color: '#666',
  },
  orderStatusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  orderStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    padding: 12,
    gap: 6,
  },
  orderDetailText: {
    fontSize: 13,
    color: '#666',
  },
  assignOrderBtn: {
    backgroundColor: '#2196F3',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  assignOrderBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
