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
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { DeliveryCard } from '../../src/components/livreur/DeliveryCard';
import { livreurService } from '../../src/services/livreurService';
import { Delivery } from '../../src/type';

type FilterStatus = 'all' | 'completed' | 'pending' | 'cancelled';

export default function LivreurHistoryScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Charger l'historique
  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await livreurService.getMyDeliveries();
      // Trier par date décroissante
      const sorted = (data || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setDeliveries(sorted);
    } catch (error: any) {
      console.error('Erreur chargement historique:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger l\'historique');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Appliquer le filtre
  useEffect(() => {
    let filtered = deliveries;

    if (filterStatus !== 'all') {
      filtered = deliveries.filter(d => {
        const status = d.status.toLowerCase();
        switch (filterStatus) {
          case 'completed':
            return status === 'completed' || status === 'complétée';
          case 'pending':
            return status === 'pending' || status === 'en attente';
          case 'cancelled':
            return status === 'cancelled' || status === 'annulée';
          default:
            return true;
        }
      });
    }

    setFilteredDeliveries(filtered);
  }, [deliveries, filterStatus]);

  // Charger au montage
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Rafraîchir quand l'écran est activé
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Rafraîchissement manuel
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  };

  // Calculer les statistiques
  const stats = {
    completed: deliveries.filter(d => d.status.toLowerCase() === 'completed' || d.status.toLowerCase() === 'complétée').length,
    pending: deliveries.filter(d => d.status.toLowerCase() === 'pending' || d.status.toLowerCase() === 'en attente').length,
    cancelled: deliveries.filter(d => d.status.toLowerCase() === 'cancelled' || d.status.toLowerCase() === 'annulée').length,
    totalAmount: deliveries.reduce((sum, d) => sum + d.total, 0),
  };

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <DeliveryCard
      delivery={item}
      onPress={() => {
        /* Naviguer vers détail si besoin */
      }}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>Aucune livraison</Text>
      <Text style={styles.emptySubtitle}>
        {filterStatus === 'all'
          ? 'Vous n\'avez pas encore de livraisons'
          : `Aucune livraison ${filterStatus}`}
      </Text>
    </View>
  );

  const FilterButton = ({ label, value, isActive }: { label: string; value: FilterStatus; isActive: boolean }) => (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={() => {
        setFilterStatus(value);
        setShowFilterModal(false);
      }}
    >
      <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Chargement de l'historique...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barre de filtre */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilterModal(!showFilterModal)}
        >
          <Text style={styles.filterIcon}>🔽</Text>
          <Text style={styles.filterLabel}>
            {filterStatus === 'all'
              ? 'Tous les statuts'
              : filterStatus === 'completed'
              ? 'Complétées'
              : filterStatus === 'pending'
              ? 'En attente'
              : 'Annulées'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de filtre */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterMenu}>
            <FilterButton label="📦 Tous les statuts" value="all" isActive={filterStatus === 'all'} />
            <FilterButton label="✅ Complétées" value="completed" isActive={filterStatus === 'completed'} />
            <FilterButton label="⏳ En attente" value="pending" isActive={filterStatus === 'pending'} />
            <FilterButton label="❌ Annulées" value="cancelled" isActive={filterStatus === 'cancelled'} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Complétées</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.cancelled}</Text>
          <Text style={styles.statLabel}>Annulées</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{deliveries.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Total montant */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Montant total livré</Text>
        <Text style={styles.totalAmount}>{stats.totalAmount.toFixed(2)} DH</Text>
      </View>

      {/* Liste des livraisons */}
      <FlatList
        data={filteredDeliveries}
        renderItem={renderDelivery}
        keyExtractor={item => item.orderId.toString()}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#9C27B0']}
          />
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9C27B0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  totalCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 0,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  filterButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#f5f5f5',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#9C27B0',
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 20,
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
});
