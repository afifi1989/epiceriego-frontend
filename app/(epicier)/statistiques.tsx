// ============================================
// app/(epicier)/statistiques.tsx
// Écran des statistiques complètes pour l'épicier
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
  Image,
} from 'react-native';
import { statsService } from '../../src/services/statsService';
import { EpicierStats, TopProductDTO, LowStockProductDTO, DailyRevenueDTO, TopClientDTO } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';

export default function StatistiquesScreen() {
  const router = useRouter();

  // États
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState<EpicierStats | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadStats();
  }, []);

  /**
   * Charge les statistiques depuis l'API
   */
  const loadStats = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await statsService.getMyEpicerieStats();
      setStats(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les statistiques');
      console.error('Erreur stats:', error);
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
    loadStats();
  };

  /**
   * Obtenir les stats selon la période sélectionnée
   */
  const getPeriodStats = () => {
    if (!stats) return { orders: 0, revenue: 0, newClients: 0 };

    switch (selectedPeriod) {
      case 'today':
        return {
          orders: stats.todayOrders,
          revenue: stats.todayRevenue,
          newClients: stats.todayNewClients,
        };
      case 'week':
        return {
          orders: stats.weekOrders,
          revenue: stats.weekRevenue,
          newClients: stats.weekNewClients,
        };
      case 'month':
        return {
          orders: stats.monthOrders,
          revenue: stats.monthRevenue,
          newClients: stats.monthNewClients,
        };
      case 'all':
        return {
          orders: stats.totalOrders,
          revenue: stats.totalRevenue,
          newClients: stats.totalClients,
        };
    }
  };

  /**
   * Écran de chargement
   */
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Aucune donnée disponible</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const periodStats = getPeriodStats();

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
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistiques</Text>
        <Text style={styles.headerSubtitle}>Vue d'ensemble de votre activité</Text>
      </View>

      {/* Sélecteur de période */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'today' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('today')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'today' && styles.periodTextActive]}>
            Aujourd'hui
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'week' && styles.periodTextActive]}>
            7 jours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'month' && styles.periodTextActive]}>
            Ce mois
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'all' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('all')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'all' && styles.periodTextActive]}>
            Total
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cartes principales */}
      <View style={styles.section}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statBlue]}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statValue}>{periodStats.orders}</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{formatPrice(periodStats.revenue)}</Text>
            <Text style={styles.statLabel}>Chiffre d'affaires</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statPurple]}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{periodStats.newClients}</Text>
            <Text style={styles.statLabel}>
              {selectedPeriod === 'all' ? 'Total clients' : 'Nouveaux clients'}
            </Text>
          </View>
          <View style={[styles.statCard, styles.statOrange]}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statValue}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Produits</Text>
          </View>
        </View>
      </View>

      {/* Moyennes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Moyennes</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCyan]}>
            <Text style={styles.statValue}>{formatPrice(stats.averageOrderValue)}</Text>
            <Text style={styles.statLabel}>Panier moyen</Text>
          </View>
          <View style={[styles.statCard, styles.statPink]}>
            <Text style={styles.statValue}>{stats.averageItemsPerOrder.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Articles / commande</Text>
          </View>
        </View>
      </View>

      {/* Taux de performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Taux de performance</Text>
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Taux d'acceptation</Text>
            <Text style={styles.progressValue}>{stats.acceptanceRate.toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, styles.progressGreen, { width: `${stats.acceptanceRate}%` }]}
            />
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Taux de complétion</Text>
            <Text style={styles.progressValue}>{stats.completionRate.toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, styles.progressBlue, { width: `${stats.completionRate}%` }]}
            />
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Taux d'annulation</Text>
            <Text style={styles.progressValue}>{stats.cancellationRate.toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, styles.progressRed, { width: `${stats.cancellationRate}%` }]}
            />
          </View>
        </View>
      </View>

      {/* Statuts des commandes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>État des commandes</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusCard}>
            <Text style={styles.statusValue}>{stats.pendingOrders}</Text>
            <Text style={styles.statusLabel}>En attente</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusValue}>{stats.acceptedOrders}</Text>
            <Text style={styles.statusLabel}>Acceptées</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusValue}>{stats.preparingOrders}</Text>
            <Text style={styles.statusLabel}>En préparation</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusValue}>{stats.readyOrders}</Text>
            <Text style={styles.statusLabel}>Prêtes</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusValue}>{stats.inDeliveryOrders}</Text>
            <Text style={styles.statusLabel}>En livraison</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusValue}>{stats.deliveredOrders}</Text>
            <Text style={styles.statusLabel}>Livrées</Text>
          </View>
        </View>
      </View>

      {/* Évolution du CA (7 derniers jours) */}
      {stats.revenueEvolution && stats.revenueEvolution.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Évolution du CA (7 derniers jours)</Text>
          <View style={styles.chartContainer}>
            {stats.revenueEvolution.map((day: DailyRevenueDTO, index: number) => {
              const maxRevenue = Math.max(...stats.revenueEvolution.map(d => d.revenue), 1);
              const heightPercent = (day.revenue / maxRevenue) * 100;

              return (
                <View key={index} style={styles.chartBar}>
                  <Text style={styles.chartValue}>{formatPrice(day.revenue)}</Text>
                  <View style={styles.chartBarContainer}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: `${heightPercent}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>
                    {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Top produits */}
      {stats.topProducts && stats.topProducts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top produits vendus</Text>
          {stats.topProducts.slice(0, 5).map((product: TopProductDTO, index: number) => (
            <View key={product.productId} style={styles.productCard}>
              <View style={styles.productRank}>
                <Text style={styles.productRankText}>{index + 1}</Text>
              </View>
              {product.photoUrl && (
                <Image source={{ uri: product.photoUrl }} style={styles.productImage} />
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.productName}</Text>
                <Text style={styles.productStats}>
                  {product.totalQuantitySold} vendus · {formatPrice(product.totalRevenue)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Produits en stock faible */}
      {stats.lowStockProducts && stats.lowStockProducts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Stock faible</Text>
          {stats.lowStockProducts.slice(0, 5).map((product: LowStockProductDTO) => (
            <View key={product.productId} style={styles.lowStockCard}>
              {product.photoUrl && (
                <Image source={{ uri: product.photoUrl }} style={styles.productImage} />
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.productName}</Text>
                <Text style={styles.stockText}>
                  Stock: {product.currentStock} / Seuil: {product.stockThreshold}
                </Text>
              </View>
              <View
                style={[
                  styles.stockBadge,
                  product.status === 'OUT_OF_STOCK' ? styles.stockBadgeRed : styles.stockBadgeOrange
                ]}
              >
                <Text style={styles.stockBadgeText}>
                  {product.status === 'OUT_OF_STOCK' ? 'Rupture' : 'Faible'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top clients */}
      {stats.topClients && stats.topClients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meilleurs clients</Text>
          {stats.topClients.map((client: TopClientDTO, index: number) => (
            <View key={client.clientId} style={styles.clientCard}>
              <View style={styles.clientRank}>
                <Text style={styles.clientRankText}>{index + 1}</Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.clientName}</Text>
                {client.clientPhone && (
                  <Text style={styles.clientPhone}>{client.clientPhone}</Text>
                )}
              </View>
              <View style={styles.clientStats}>
                <Text style={styles.clientOrdersText}>{client.totalOrders} commandes</Text>
                <Text style={styles.clientSpentText}>{formatPrice(client.totalSpent)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Méthodes de paiement */}
      {stats.paymentMethodsDistribution && Object.keys(stats.paymentMethodsDistribution).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Méthodes de paiement</Text>
          {Object.entries(stats.paymentMethodsDistribution).map(([method, count]) => (
            <View key={method} style={styles.distributionRow}>
              <Text style={styles.distributionLabel}>
                {method === 'CASH' ? '💵 Espèces' :
                 method === 'CARD' ? '💳 Carte' :
                 method === 'MOBILE' ? '📱 Mobile' :
                 method === 'CLIENT_ACCOUNT' ? '📒 Compte client' : method}
              </Text>
              <Text style={styles.distributionValue}>{count} commandes</Text>
            </View>
          ))}
        </View>
      )}

      {/* Types de livraison */}
      {stats.deliveryTypesDistribution && Object.keys(stats.deliveryTypesDistribution).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Types de livraison</Text>
          {Object.entries(stats.deliveryTypesDistribution).map(([type, count]) => (
            <View key={type} style={styles.distributionRow}>
              <Text style={styles.distributionLabel}>
                {type === 'PICKUP' ? '🏪 Retrait' : '🚚 Livraison'}
              </Text>
              <Text style={styles.distributionValue}>{count} commandes</Text>
            </View>
          ))}
        </View>
      )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 10,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 15,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2196F3',
  },
  periodText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#fff',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
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
  statGreen: {
    backgroundColor: '#E8F5E9',
  },
  statPurple: {
    backgroundColor: '#F3E5F5',
  },
  statOrange: {
    backgroundColor: '#FFF3E0',
  },
  statCyan: {
    backgroundColor: '#E0F7FA',
  },
  statPink: {
    backgroundColor: '#FCE4EC',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGreen: {
    backgroundColor: '#4CAF50',
  },
  progressBlue: {
    backgroundColor: '#2196F3',
  },
  progressRed: {
    backgroundColor: '#f44336',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusCard: {
    width: '31%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  statusLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 200,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartValue: {
    fontSize: 10,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  chartBarContainer: {
    width: '80%',
    height: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  productRankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  productStats: {
    fontSize: 12,
    color: '#999',
  },
  lowStockCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stockText: {
    fontSize: 12,
    color: '#ff9800',
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  stockBadgeRed: {
    backgroundColor: '#ffebee',
  },
  stockBadgeOrange: {
    backgroundColor: '#fff3e0',
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f44336',
  },
  clientCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  clientRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  clientRankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: 12,
    color: '#999',
  },
  clientStats: {
    alignItems: 'flex-end',
  },
  clientOrdersText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  clientSpentText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  distributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  distributionLabel: {
    fontSize: 14,
    color: '#333',
  },
  distributionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
});
