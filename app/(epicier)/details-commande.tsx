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
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/constants/config';
import { orderService } from '../../src/services/orderService';
import {
  epicierLivreurService,
  AssignedLivreur,
} from '../../src/services/epicierLivreurService';
import { Order } from '../../src/type';
import { formatPrice, getStatusLabel, getStatusColor } from '../../src/utils/helpers';
import { OrderLivreurAssignmentSection } from '../../src/components/epicier/OrderLivreurAssignmentSection';
import { LivreurAssignmentModal } from '../../src/components/epicier/LivreurAssignmentModal';

export default function DetailsCommandeScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [assignedLivreurs, setAssignedLivreurs] = useState<AssignedLivreur[]>([]);
  const [selectedLivreurId, setSelectedLivreurId] = useState<number | null>(null);
  const [showLivreurModal, setShowLivreurModal] = useState(false);
  const [assigningLivreur, setAssigningLivreur] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [orderId]);

  const loadInitialData = async () => {
    try {
      if (!orderId) {
        Alert.alert('Erreur', 'ID de commande manquant');
        router.back();
        return;
      }

      // Charger les détails de la commande
      const data = await orderService.getOrderById(parseInt(orderId as string));
      setOrder(data);

      // Charger les livreurs assignés
      const livreurs = await epicierLivreurService.getAssignedLivreurs();
      setAssignedLivreurs(
        livreurs && Array.isArray(livreurs) ? livreurs : []
      );
    } catch (error: any) {
      console.error('Erreur détails commande:', error);
      setAssignedLivreurs([]);
      Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;

    try {
      setUpdating(true);
      await orderService.updateOrderStatus(order.id, newStatus);
      Alert.alert('✅', 'Statut mis à jour avec succès');
      await loadInitialData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignLivreur = async () => {
    if (!order || !selectedLivreurId) return;

    try {
      setAssigningLivreur(true);
      await epicierLivreurService.assignOrderToLivreur(order.id, selectedLivreurId);
      Alert.alert('✅', 'Livreur assigné avec succès');
      setShowLivreurModal(false);
      setSelectedLivreurId(null);
      await loadInitialData();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'assigner le livreur');
    } finally {
      setAssigningLivreur(false);
    }
  };

  const showStatusOptions = () => {
    if (!order) return;

    const options: { text: string; status: string }[] = [];

    if (order.status === 'PENDING') {
      options.push({ text: 'Accepter', status: 'ACCEPTED' });
      options.push({ text: 'Refuser', status: 'CANCELLED' });
    } else if (order.status === 'ACCEPTED') {
      options.push({ text: 'En préparation', status: 'PREPARING' });
    } else if (order.status === 'PREPARING') {
      options.push({ text: 'Prête', status: 'READY' });
    } else if (order.status === 'READY') {
      // Pour les commandes en retrait (PICKUP), l'épicier peut marquer comme livrée
      if (order.deliveryType === 'PICKUP') {
        options.push({ text: 'Récupérée par le client', status: 'DELIVERED' });
      }
      // Pour les livraisons à domicile, c'est le livreur qui change le statut
    }

    if (options.length === 0) {
      Alert.alert('Info', 'Aucun changement de statut possible pour cette commande');
      return;
    }

    Alert.alert(
      'Changer le statut',
      'Choisissez le nouveau statut',
      [
        ...options.map(opt => ({
          text: opt.text,
          onPress: () => handleUpdateStatus(opt.status),
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails Commande #{order.id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Statut */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>État de la commande</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(order.status) }
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(order.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Infos Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Informations du client</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nom:</Text>
              <Text style={styles.infoValue}>{order.clientNom}</Text>
            </View>
            {order.telephoneLivraison && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Téléphone:</Text>
                <Text style={styles.infoValue}>{order.telephoneLivraison}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Infos Livraison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Adresse de livraison</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>
                {order.deliveryType === 'HOME_DELIVERY' ? 'Livraison à domicile' : 'Retrait en magasin'}
              </Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <Text style={styles.infoLabel}>Adresse:</Text>
              <Text style={styles.infoValue}>{order.adresseLivraison}</Text>
            </View>
            {order.livreurNom && (
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Text style={styles.infoLabel}>Livreur:</Text>
                <Text style={styles.infoValue}>{order.livreurNom}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Assignation Livreur */}
        {order.status === 'READY' && (
          <OrderLivreurAssignmentSection
            currentLivreur={
              assignedLivreurs.find(l => l.nom === order.livreurNom) || null
            }
            availableLivreurs={assignedLivreurs}
            isLoading={assigningLivreur}
            onAssignClick={() => setShowLivreurModal(true)}
            status={order.status}
          />
        )}

        {/* Articles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Articles ({order.nombreItems})</Text>
          <View style={styles.itemsList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>
                    {item.itemType === 'RECHARGE' ? '📱 ' : ''}
                    {item.productNom}
                  </Text>
                  <Text style={styles.itemPrice}>{formatPrice(item.total)}</Text>
                </View>
                <View style={styles.itemDetails}>
                  {item.itemType === 'RECHARGE' ? (
                    <>
                      {item.rechargePhoneNumber && (
                        <Text style={styles.itemDetail}>
                          ☎️ Numéro: {item.rechargePhoneNumber}
                        </Text>
                      )}
                      {item.rechargeOperator && (
                        <Text style={styles.itemDetail}>
                          📡 Opérateur: {item.rechargeOperator}
                        </Text>
                      )}
                      {item.rechargeDescription && (
                        <Text style={styles.itemDetail}>
                          💰 {item.rechargeDescription}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.itemDetail}>
                        Quantité: {item.quantite}
                        {item.unitLabel ? ` ${item.unitLabel}` : ''}
                      </Text>
                      <Text style={styles.itemDetail}>
                        Prix unitaire: {formatPrice(item.prixUnitaire)}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Résumé Prix */}
        <View style={styles.section}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total:</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.total)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Méthode de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Paiement</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoValue}>
              {order.paymentMethod === 'CARD' ? 'Carte bancaire' : 'Espèces'}
            </Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Dates</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Créée:</Text>
              <Text style={styles.infoValue}>
                {new Date(order.createdAt).toLocaleString('fr-FR')}
              </Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <Text style={styles.infoLabel}>Mise à jour:</Text>
              <Text style={styles.infoValue}>
                {new Date(order.updatedAt).toLocaleString('fr-FR')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Boutons d'action */}
      <View style={styles.actionButtonsContainer}>
        {(order.status === 'ACCEPTED' || order.status === 'PREPARING') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.prepareButton]}
            onPress={() => router.push(`/preparer-commande?orderId=${order.id}` as any)}
          >
            <MaterialIcons name="assignment" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>
              {order.status === 'ACCEPTED' ? 'Préparer la commande' : 'Continuer la préparation'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, updating && styles.actionButtonDisabled]}
          onPress={showStatusOptions}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="edit" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Changer le statut</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal de sélection livreur */}
      <LivreurAssignmentModal
        visible={showLivreurModal}
        livreurs={assignedLivreurs}
        selectedLivreurId={selectedLivreurId}
        isLoading={assigningLivreur}
        onSelect={(livreur) => setSelectedLivreurId(livreur.id ?? null)}
        onConfirm={handleAssignLivreur}
        onCancel={() => {
          setShowLivreurModal(false);
          setSelectedLivreurId(null);
        }}
        title="Assigner un Livreur"
        description="Sélectionnez un livreur pour cette commande"
      />
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
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  infoBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  itemDetails: {
    gap: 4,
  },
  itemDetail: {
    fontSize: 12,
    color: '#666',
  },
  summaryBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  actionButtonsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  prepareButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
