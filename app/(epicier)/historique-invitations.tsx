import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { clientManagementService } from '../../src/services/clientManagementService';
import { ClientInvitation } from '../../src/type';

type FilterStatus = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

export default function HistoriqueInvitationsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const epicerieId = Number(params.epicerieId);

  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [filteredInvitations, setFilteredInvitations] = useState<ClientInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadInvitations();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [invitations, filterStatus]);

  const loadInvitations = async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
        setPage(0);
      }

      const currentPage = loadMore ? page + 1 : 0;
      const allInvitations = await clientManagementService.getClientInvitations(epicerieId);

      // Simuler la pagination côté client
      const startIndex = currentPage * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const paginatedData = allInvitations.slice(startIndex, endIndex);

      if (loadMore) {
        setInvitations([...invitations, ...paginatedData]);
        setPage(currentPage);
      } else {
        setInvitations(paginatedData);
        setPage(0);
      }

      setHasMore(endIndex < allInvitations.length);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger les invitations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = () => {
    if (filterStatus === 'ALL') {
      setFilteredInvitations(invitations);
    } else {
      setFilteredInvitations(invitations.filter(inv => inv.status === filterStatus));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInvitations();
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadInvitations(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '#FF9800';
      case 'ACCEPTED':
        return '#4CAF50';
      case 'REJECTED':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'En attente';
      case 'ACCEPTED':
        return 'Acceptée';
      case 'REJECTED':
        return 'Refusée';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '⏳';
      case 'ACCEPTED':
        return '✅';
      case 'REJECTED':
        return '❌';
      default:
        return '📧';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderFilterButton = (status: FilterStatus, label: string, count: number) => {
    const isActive = filterStatus === status;
    return (
      <TouchableOpacity
        style={[styles.filterButton, isActive && styles.filterButtonActive]}
        onPress={() => setFilterStatus(status)}
      >
        <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
          {label}
        </Text>
        <View
          style={[
            styles.filterBadge,
            isActive && styles.filterBadgeActive,
          ]}
        >
          <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderInvitationCard = ({ item }: { item: ClientInvitation }) => (
    <View style={styles.invitationCard}>
      <View style={styles.cardHeader}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientIcon}>👤</Text>
          <View style={styles.clientDetails}>
            <Text style={styles.clientName}>{item.clientName || item.clientEmail}</Text>
            <Text style={styles.clientEmail}>{item.clientEmail}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Envoyée le:</Text>
          <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
        </View>

        {item.respondedAt && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {item.status === 'ACCEPTED' ? 'Acceptée le:' : 'Refusée le:'}
            </Text>
            <Text style={styles.infoValue}>{formatDate(item.respondedAt)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyText}>Aucune invitation</Text>
      <Text style={styles.emptySubtext}>
        {filterStatus === 'ALL'
          ? "Vous n'avez pas encore envoyé d'invitations"
          : `Aucune invitation ${getStatusText(filterStatus).toLowerCase()}`}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2196F3" />
      </View>
    );
  };

  if (loading && page === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const pendingCount = invitations.filter(i => i.status === 'PENDING').length;
  const acceptedCount = invitations.filter(i => i.status === 'ACCEPTED').length;
  const rejectedCount = invitations.filter(i => i.status === 'REJECTED').length;

  return (
    <View style={styles.container}>
      {/* Header avec statistiques */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📨 Historique des invitations</Text>
        <Text style={styles.headerSubtitle}>
          {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} au total
        </Text>
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        {renderFilterButton('ALL', 'Toutes', invitations.length)}
        {renderFilterButton('PENDING', 'En attente', pendingCount)}
        {renderFilterButton('ACCEPTED', 'Acceptées', acceptedCount)}
        {renderFilterButton('REJECTED', 'Refusées', rejectedCount)}
      </View>

      {/* Liste des invitations */}
      <FlatList
        data={filteredInvitations}
        keyExtractor={(item, index) => `${item.clientId}-${item.epicerieId}-${index}`}
        renderItem={renderInvitationCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
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
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 20,
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
  filtersContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginRight: 6,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#666',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 15,
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  clientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardBody: {
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
