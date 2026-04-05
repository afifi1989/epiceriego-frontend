import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { orderService } from '../../src/services/orderService';
import { Order } from '../../src/type';
import { formatPrice, getStatusLabel, getStatusColor } from '../../src/utils/helpers';

type FilterStatus = 'ALL' | 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export default function CommandesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  useEffect(() => {
    loadOrders();
  }, []);

  // Recharger les commandes à chaque fois que l'écran reçoit le focus
  useFocusEffect(
    useCallback(() => {
      console.log('[Commandes] Screen focused - Reloading orders');
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      const data = await orderService.getEpicerieOrders();
      setOrders(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      Alert.alert('✅', 'Statut mis à jour');
      loadOrders();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const showStatusOptions = (order: Order) => {
    const options: { text: string; status: string }[] = [];
    
    if (order.status === 'PENDING') {
      options.push({ text: 'Accepter', status: 'ACCEPTED' });
      options.push({ text: 'Refuser', status: 'CANCELLED' });
    } else if (order.status === 'ACCEPTED') {
      options.push({ text: 'En préparation', status: 'PREPARING' });
    } else if (order.status === 'PREPARING') {
      options.push({ text: 'Prête', status: 'READY' });
    }

    if (options.length === 0) return;

    Alert.alert(
      'Changer le statut',
      'Choisissez le nouveau statut',
      [
        ...options.map(opt => ({
          text: opt.text,
          onPress: () => handleUpdateStatus(order.id, opt.status),
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const filteredOrders = filter === 'ALL' 
    ? orders 
    : orders.filter(order => order.status === filter);

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <TouchableOpacity
        onPress={() => router.push(`/details-commande?orderId=${item.id}` as any)}
        style={styles.orderContent}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderClient}>👤 {item.clientNom}</Text>
            <Text style={styles.orderDate}>
              {new Date(item.createdAt).toLocaleString('fr-FR')}
            </Text>
          </View>
          <View style={styles.orderRight}>
            <Text style={styles.orderTotal}>{formatPrice(item.total)}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) }
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.detailRow}>📦 {item.nombreItems} article(s)</Text>
          <Text style={styles.detailRow}>📍 {item.adresseLivraison}</Text>
          {item.telephoneLivraison && (
            <Text style={styles.detailRow}>📞 {item.telephoneLivraison}</Text>
          )}
          {item.livreurNom && (
            <Text style={styles.detailRow}>🚚 {item.livreurNom}</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.cardFooter}>
        {item.status === 'PENDING' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickBtn, styles.acceptBtn]}
              onPress={() => handleUpdateStatus(item.id, 'ACCEPTED')}
            >
              <Text style={styles.quickBtnText}>✅ Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, styles.rejectBtn]}
              onPress={() => handleUpdateStatus(item.id, 'CANCELLED')}
            >
              <Text style={styles.quickBtnText}>❌ Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'ACCEPTED' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickBtn, styles.prepareBtn]}
              onPress={() => router.push(`/preparer-commande?orderId=${item.id}` as any)}
            >
              <Text style={styles.quickBtnText}>👨‍🍳 Préparer</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'PREPARING' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickBtn, styles.prepareBtn]}
              onPress={() => router.push(`/preparer-commande?orderId=${item.id}` as any)}
            >
              <Text style={styles.quickBtnText}>👨‍🍳 Continuer</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'READY' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickBtn, styles.infoBtn]}
              disabled={true}
            >
              <Text style={styles.quickBtnText}>✅ Commande Prête</Text>
            </TouchableOpacity>
            {item.deliveryType === 'PICKUP' ? (
              <TouchableOpacity
                style={[styles.quickBtn, styles.scanBtn]}
                onPress={() => router.push('/(epicier)/scan-qr')}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.quickBtnText}>Scanner QR</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.readyText}>En attente de livreur</Text>
            )}
          </View>
        )}
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => router.push(`/details-commande?orderId=${item.id}` as any)}
        >
          <MaterialIcons name="arrow-forward" size={18} color="#2196F3" />
          <Text style={styles.detailsBtnText}>Détails</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bouton scanner QR flottant — valider les retraits PICKUP */}
      <TouchableOpacity
        style={styles.scanFab}
        onPress={() => router.push('/(epicier)/scan-qr')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="qrcode-scan" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Bouton vente directe flottant */}
      <TouchableOpacity
        style={styles.posFab}
        onPress={() => router.push('/(epicier)/vente-directe')}
        activeOpacity={0.85}
      >
        <Text style={styles.posFabText}>🛒</Text>
      </TouchableOpacity>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'ALL' && styles.filterBtnActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>
            Toutes ({orders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'PENDING' && styles.filterBtnActive]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.filterText, filter === 'PENDING' && styles.filterTextActive]}>
            En attente ({orders.filter(o => o.status === 'PENDING').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'ACCEPTED' && styles.filterBtnActive]}
          onPress={() => setFilter('ACCEPTED')}
        >
          <Text style={[styles.filterText, filter === 'ACCEPTED' && styles.filterTextActive]}>
            Acceptées ({orders.filter(o => o.status === 'ACCEPTED').length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'ALL' 
                ? 'Aucune commande pour le moment'
                : `Aucune commande ${getStatusLabel(filter).toLowerCase()}`
              }
            </Text>
          </View>
        }
      />
    </View>
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
  scanFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  posFab: {
    position: 'absolute',
    bottom: 94,
    right: 20,
    zIndex: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  posFabText: {
    fontSize: 26,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderContent: {
    padding: 15,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  orderDetails: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  quickBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#4CAF50',
  },
  prepareBtn: {
    backgroundColor: '#2196F3',
  },
  rejectBtn: {
    backgroundColor: '#f44336',
  },
  infoBtn: {
    backgroundColor: '#2196F3',
    opacity: 0.7,
  },
  scanBtn: {
    backgroundColor: '#7B1FA2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  readyText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  detailsBtnText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
