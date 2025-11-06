// ============================================
// app/(epicier)/dashboard.tsx
// Dashboard complet pour l'épicier
// ============================================
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService } from '../../src/services/orderService';
import { Epicerie, Order } from '../../src/type';
import { formatPrice, getStatusColor, getStatusLabel } from '../../src/utils/helpers';

export default function EpicierDashboardScreen() {
  const router = useRouter();
  
  // États
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    productsCount: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * Charge toutes les données du dashboard
   */
  const loadDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);

      // Charger les infos de l'épicerie
      const epicerieData = await epicerieService.getMyEpicerie();
      setEpicerie(epicerieData);

      // Charger les commandes
      const ordersData = await orderService.getEpicerieOrders();
      setOrders(ordersData);

      // Calculer les statistiques
      const pendingCount = ordersData.filter(o => o.status === 'PENDING').length;
      const todayOrders = ordersData.filter(o => {
        const orderDate = new Date(o.createdAt);
        const today = new Date();
        return orderDate.toDateString() === today.toDateString();
      });
      const todayRev = todayOrders.reduce((sum, o) => sum + o.total, 0);

      setStats({
        totalOrders: ordersData.length,
        pendingOrders: pendingCount,
        todayRevenue: todayRev,
        productsCount: epicerieData.nombreProducts,
      });

    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les données');
      console.error('Erreur dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Rafraîchir les données
   */
  const onRefresh = (): void => {
    setRefreshing(true);
    loadDashboardData();
  };

  /**
   * Accepter une commande
   */
  const handleAcceptOrder = async (orderId: number): Promise<void> => {
    try {
      await orderService.updateOrderStatus(orderId, 'ACCEPTED');
      Alert.alert('✅', 'Commande acceptée !');
      loadDashboardData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'accepter la commande');
    }
  };

  /**
   * Refuser une commande
   */
  const handleRejectOrder = async (orderId: number): Promise<void> => {
    Alert.alert(
      'Refuser la commande',
      'Êtes-vous sûr de vouloir refuser cette commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await orderService.updateOrderStatus(orderId, 'CANCELLED');
              Alert.alert('✅', 'Commande refusée');
              loadDashboardData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de refuser la commande');
            }
          },
        },
      ]
    );
  };

  /**
   * Écran de chargement
   */
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  /**
   * Rendu principal
   */
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* En-tête avec infos épicerie */}
      {epicerie && (
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🏪</Text>
          <Text style={styles.headerTitle}>{epicerie.nomEpicerie}</Text>
          <Text style={styles.headerSubtitle}>{epicerie.adresse}</Text>
        </View>
      )}

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.statBlue]}>
          <Text style={styles.statValue}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Commandes Total</Text>
        </View>
        <View style={[styles.statCard, styles.statOrange]}>
          <Text style={styles.statValue}>{stats.pendingOrders}</Text>
          <Text style={styles.statLabel}>En Attente</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.statGreen]}>
          <Text style={styles.statValue}>{formatPrice(stats.todayRevenue)}</Text>
          <Text style={styles.statLabel}>Revenue Aujourd'hui</Text>
        </View>
        <View style={[styles.statCard, styles.statPurple]}>
          <Text style={styles.statValue}>{stats.productsCount}</Text>
          <Text style={styles.statLabel}>Produits</Text>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Actions Rapides</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(epicier)/produits')}
          >
            <Text style={styles.actionEmoji}>📦</Text>
            <Text style={styles.actionText}>Produits</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Info', 'Statistiques à venir')}
          >
            <Text style={styles.actionEmoji}>📊</Text>
            <Text style={styles.actionText}>Statistiques</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Info', 'Gestion livreurs à venir')}
          >
            <Text style={styles.actionEmoji}>🚚</Text>
            <Text style={styles.actionText}>Livreurs</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Info', 'Paramètres à venir')}
          >
            <Text style={styles.actionEmoji}>⚙️</Text>
            <Text style={styles.actionText}>Paramètres</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Commandes en attente */}
      <View style={styles.ordersSection}>
        <Text style={styles.sectionTitle}>
          Commandes en Attente ({stats.pendingOrders})
        </Text>

        {orders
          .filter(order => order.status === 'PENDING')
          .map(order => (
            <View key={order.id} style={styles.orderCard}>
              {/* En-tête commande */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderClient}>👤 {order.clientNom}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.orderTotalContainer}>
                  <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
                  <Text style={styles.orderItems}>{order.nombreItems} articles</Text>
                </View>
              </View>

              {/* Adresse */}
              <View style={styles.orderAddress}>
                <Text style={styles.orderAddressIcon}>📍</Text>
                <Text style={styles.orderAddressText}>{order.adresseLivraison}</Text>
              </View>

              {/* Téléphone */}
              {order.telephoneLivraison && (
                <View style={styles.orderPhone}>
                  <Text style={styles.orderPhoneIcon}>📞</Text>
                  <Text style={styles.orderPhoneText}>{order.telephoneLivraison}</Text>
                </View>
              )}

              {/* Boutons d'action */}
              <View style={styles.orderActions}>
                <TouchableOpacity
                  style={[styles.orderButton, styles.acceptButton]}
                  onPress={() => handleAcceptOrder(order.id)}
                >
                  <Text style={styles.orderButtonText}>✅ Accepter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.orderButton, styles.rejectButton]}
                  onPress={() => handleRejectOrder(order.id)}
                >
                  <Text style={styles.orderButtonText}>❌ Refuser</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

        {stats.pendingOrders === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyText}>Aucune commande en attente</Text>
          </View>
        )}
      </View>

      {/* Commandes récentes */}
      <View style={styles.ordersSection}>
        <Text style={styles.sectionTitle}>Commandes Récentes</Text>

        {orders
          .filter(order => order.status !== 'PENDING')
          .slice(0, 5)
          .map(order => (
            <View key={order.id} style={styles.recentOrderCard}>
              <View style={styles.recentOrderHeader}>
                <Text style={styles.recentOrderClient}>{order.clientNom}</Text>
                <View 
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(order.status) }
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(order.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.recentOrderFooter}>
                <Text style={styles.recentOrderTotal}>
                  {formatPrice(order.total)}
                </Text>
                <Text style={styles.recentOrderDate}>
                  {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </View>
          ))}

        {orders.filter(o => o.status !== 'PENDING').length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande récente</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Styles
 */
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBlue: {
    backgroundColor: '#E3F2FD',
  },
  statOrange: {
    backgroundColor: '#FFF3E0',
  },
  statGreen: {
    backgroundColor: '#E8F5E9',
  },
  statPurple: {
    backgroundColor: '#F3E5F5',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  quickActions: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ordersSection: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  orderClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  orderTotalContainer: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  orderItems: {
    fontSize: 12,
    color: '#999',
  },
  orderAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  orderAddressIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  orderAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  orderPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  orderPhoneIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  orderPhoneText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  orderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  orderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  orderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recentOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentOrderClient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  recentOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentOrderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  recentOrderDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
