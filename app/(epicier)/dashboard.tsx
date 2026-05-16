// ============================================
// app/(epicier)/dashboard.tsx
// Dashboard complet pour l'épicier
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePermissions } from '../../src/hooks/usePermissions';
import { STORAGE_KEYS } from '../../src/constants/config';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService } from '../../src/services/orderService';
import { offlineService } from '../../src/services/offline';
import { useNetwork } from '../../src/context/NetworkContext';
import { Epicerie, LoginResponse, Order } from '../../src/type';
import { onboardingService } from '../../src/services/onboardingService';
import { formatPrice, getStatusColor, getStatusLabel } from '../../src/utils/helpers';
import { useCurrency } from '../../src/context/CurrencyContext';
import { DashboardPromoWidget } from '../../src/features/promotions/components';
import { DashboardPromoCodesWidget } from '../../src/components/epicier/DashboardPromoCodesWidget';
import { DashboardStockWidget } from '../../src/components/epicier/DashboardStockWidget';

export default function EpicierDashboardScreen() {
  const router = useRouter();
  // Devise propagée par le layout épicier au login
  const { currency } = useCurrency();

  // États
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    productsCount: 0,
  });
  const { can } = usePermissions(loginData);
  const { isOnline } = useNetwork();
  // Modale "Plus d'actions" : regroupe les raccourcis secondaires pour ne
  // pas saturer le dashboard. La grille principale ne montre que les 6
  // actions les plus utilisees.
  const [showMoreActions, setShowMoreActions] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (raw) {
          const user = JSON.parse(raw);
          setLoginData(user);

          // Vérifier si l'onboarding est terminé (seulement si online et première visite)
          if (user.epicerieId) {
            try {
              const status = await onboardingService.getStatus(user.epicerieId);
              if (!status.completed) {
                // Libérer le spinner avant la redirection : si la nav échoue
                // ou prend du temps, on n'est pas bloqué sur "Chargement…".
                setLoading(false);
                router.replace('/(epicier)/onboarding');
                return;
              }
            } catch {
              // Si offline ou erreur, ne pas bloquer l'accès au dashboard
            }
          }
        }
        loadDashboardData();
      } catch (err) {
        console.error('[Dashboard] init failed:', err);
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Charge toutes les données du dashboard (avec cache offline)
   */
  const loadDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);

      // Charger les infos de l'épicerie (cache 30 min, dispo offline)
      const epicerieData = await offlineService.fetchWithCache<Epicerie>({
        namespace: 'epicerie',
        key: 'my-epicerie',
        fetcher: () => epicerieService.getMyEpicerie(),
      });
      if (epicerieData) setEpicerie(epicerieData);

      // Charger les commandes (cache 5 min, dispo offline)
      const ordersData = await offlineService.fetchWithCache<Order[]>({
        namespace: 'orders',
        key: 'epicerie-orders',
        fetcher: () => orderService.getEpicerieOrders(),
      });
      if (ordersData) {
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
          productsCount: epicerieData?.nombreProducts ?? 0,
        });
      }

    } catch (error) {
      // Seulement alerter si on est online (offline = données du cache)
      if (offlineService.isOnline()) {
        Alert.alert('Erreur', 'Impossible de charger les données');
      }
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
          <Text style={styles.statValue}>{formatPrice(stats.todayRevenue, currency)}</Text>
          <Text style={styles.statLabel}>Revenue Aujourd'hui</Text>
        </View>
        <View style={[styles.statCard, styles.statPurple]}>
          <Text style={styles.statValue}>{stats.productsCount}</Text>
          <Text style={styles.statLabel}>Produits</Text>
        </View>
      </View>

      {/* Widget Stock — alertes a reapprovisionner (auto-masque si stock OK).
          Place EN PREMIER car critique pour l'operationnel quotidien. */}
      <DashboardStockWidget />

      {/* Widget Promotions (V70+) — necessite promotions:manage cote backend */}
      {can('promotions:manage') && <DashboardPromoWidget />}

      {/* V95 Phase 6 — Widget Codes promos (économies offertes 30j) */}
      {can('stats:view') && <DashboardPromoCodesWidget />}

      {/* Actions rapides — 6 raccourcis principaux + bouton "Plus" pour le reste.
          Selection basee sur la frequence d'usage quotidienne d'un epicier :
          vente directe (POS) > catalogue > stats > approvisionnement > promotions > caisse.
          Le reste (livreurs, fournisseurs, alertes, imprimante, fidelite...) est
          accessible via la modale "Plus d'actions". */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Actions Rapides</Text>
        <View style={styles.actionsGrid}>
          {/* 1. Vente directe — l'action #1 du quotidien, mise en highlight */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonHighlight]}
            onPress={() => router.push('/(epicier)/vente-directe')}
          >
            <Text style={styles.actionEmoji}>🛒</Text>
            <Text style={styles.actionText}>Vente Directe</Text>
          </TouchableOpacity>

          {/* 2. Produits — catalogue */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(epicier)/produits')}
          >
            <Text style={styles.actionEmoji}>📦</Text>
            <Text style={styles.actionText}>Produits</Text>
          </TouchableOpacity>

          {/* 3. Statistiques — suivi des ventes */}
          {can('stats:view') && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(epicier)/statistiques')}
            >
              <Text style={styles.actionEmoji}>📊</Text>
              <Text style={styles.actionText}>Statistiques</Text>
            </TouchableOpacity>
          )}

          {/* 4. Approvisionner — geste recurrent stock */}
          {can('stock:adjust') && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(epicier)/approvisionnement')}
            >
              <Text style={styles.actionEmoji}>🏷️</Text>
              <Text style={styles.actionText}>Approvisionner</Text>
            </TouchableOpacity>
          )}

          {/* 5. Promotions — levier commercial */}
          {can('promotions:manage') && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(epicier)/promotions')}
            >
              <Text style={styles.actionEmoji}>🎉</Text>
              <Text style={styles.actionText}>Promotions</Text>
            </TouchableOpacity>
          )}

          {/* 6. Caisse — ouverture/cloture du jour */}
          {can('settings:edit') && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(epicier)/cash-session' as any)}
            >
              <Text style={styles.actionEmoji}>💰</Text>
              <Text style={styles.actionText}>Caisse</Text>
            </TouchableOpacity>
          )}

          {/* 7. Bouton "Plus" — ouvre la modale avec le reste des actions */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonMore]}
            onPress={() => setShowMoreActions(true)}
          >
            <Text style={styles.actionEmoji}>⋯</Text>
            <Text style={styles.actionText}>Plus</Text>
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
                  <Text style={styles.orderTotal}>{formatPrice(order.total, order.currency || currency)}</Text>
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
                  {formatPrice(order.total, order.currency || currency)}
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

      {/* Modale "Plus d'actions" : grille secondaire avec les raccourcis
          peu frequents. Chaque entree est conditionnee par sa permission. */}
      <Modal
        visible={showMoreActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMoreActions(false)}
      >
        <Pressable style={moreStyles.overlay} onPress={() => setShowMoreActions(false)}>
          <Pressable style={moreStyles.sheet} onPress={e => e.stopPropagation()}>
            <View style={moreStyles.handle} />
            <Text style={moreStyles.title}>Plus d'actions</Text>
            <View style={moreStyles.grid}>
              {can('livreurs:manage') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/livreurs'); }}
                >
                  <Text style={moreStyles.emoji}>🚚</Text>
                  <Text style={moreStyles.label}>Livreurs</Text>
                </TouchableOpacity>
              )}
              {can('settings:edit') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/parametres' as any); }}
                >
                  <Text style={moreStyles.emoji}>⚙️</Text>
                  <Text style={moreStyles.label}>Paramètres</Text>
                </TouchableOpacity>
              )}
              {can('promoCodes:manage') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/codes-promos' as any); }}
                >
                  <Text style={moreStyles.emoji}>🎟️</Text>
                  <Text style={moreStyles.label}>Codes promos</Text>
                </TouchableOpacity>
              )}
              {can('suppliers:manage') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/fournisseurs' as any); }}
                >
                  <Text style={moreStyles.emoji}>🏪</Text>
                  <Text style={moreStyles.label}>Fournisseurs</Text>
                </TouchableOpacity>
              )}
              {can('stock:view') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/stock-alerts' as any); }}
                >
                  <Text style={moreStyles.emoji}>🚨</Text>
                  <Text style={moreStyles.label}>Alertes stock</Text>
                </TouchableOpacity>
              )}
              {can('stock:adjust') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/inventaire' as any); }}
                >
                  <Text style={moreStyles.emoji}>📋</Text>
                  <Text style={moreStyles.label}>Inventaire</Text>
                </TouchableOpacity>
              )}
              {can('settings:edit') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/printer-settings' as any); }}
                >
                  <Text style={moreStyles.emoji}>🖨️</Text>
                  <Text style={moreStyles.label}>Imprimante</Text>
                </TouchableOpacity>
              )}
              {can('settings:edit') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/fidelite' as any); }}
                >
                  <Text style={moreStyles.emoji}>⭐</Text>
                  <Text style={moreStyles.label}>Fidélité</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={moreStyles.closeBtn} onPress={() => setShowMoreActions(false)}>
              <Text style={moreStyles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const moreStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 14,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  item: {
    width: '30%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  emoji: { fontSize: 26, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  closeBtn: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  closeText: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

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
    fontSize: 13,
    color: '#4b5563',
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
  actionButtonHighlight: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  actionButtonMore: {
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#e0e6ed',
    borderStyle: 'dashed',
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
    fontSize: 13,
    color: '#6b7280',
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
    fontSize: 13,
    color: '#6b7280',
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
