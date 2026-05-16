import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { clientManagementService } from '../../src/services/clientManagementService';
import { invoiceService } from '../../src/services/invoiceService';
import { ClientCard } from '../../src/components/epicier/ClientCard';
import { ClientQrScanButton } from '../../src/components/epicier/ClientQrScanButton';
import { ClientEpicerieRelation, ClientAccount } from '../../src/type';
import { Colors, FontSizes } from '../../src/constants/colors';
import { useLanguage } from '../../src/context/LanguageContext';
import { tFmt } from '../../src/services/chatbotService';
import { walkInConversionService } from '../../src/services/walkInConversionService';
import { useCurrentUser } from '../../src/hooks/useCurrentUser';
import { usePermissions } from '../../src/hooks/usePermissions';

interface ClientWithDetails extends ClientEpicerieRelation {
  totalDebt?: number;
  totalAdvances?: number;
  numberOfOrders?: number;
}

export default function ClientsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const currentUser = useCurrentUser();
  const { can } = usePermissions(currentUser);
  const canManageCredit = can('clients:credit');
  // Remove client est equivalent a un retrait de la liste : reserve aux roles qui
  // peuvent gerer le credit (les caissiers n'ont pas a faire ce menage).
  const canRemoveClient = can('clients:credit');
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalDebt: 0,
    totalAdvances: 0,
    unpaidInvoices: 0,
  });
  /** Walk-in customers eligible for promotion to a virtual client.
   *  Loaded silently on mount; surfaces as a badge on the dedicated button. */
  const [walkInCandidatesCount, setWalkInCandidatesCount] = useState(0);

  /**
   * Get epicerie ID from storage
   */
  useEffect(() => {
    const getEpicerieId = async () => {
      const user = await AsyncStorage.getItem('@abridgo_user');
      if (user) {
        const userData = JSON.parse(user);
        if (userData.epicerieId) {
          setEpicerieId(userData.epicerieId);
        }
      }
    };
    getEpicerieId();
  }, []);

  /**
   * Load clients when epicerie ID is available
   */
  useFocusEffect(
    useCallback(() => {
      if (epicerieId) {
        loadClients();
        // Refresh the walk-in conversion suggestion count silently. Failures
        // here don't block the page — the badge just stays at its previous
        // value, and the dedicated screen will surface the real error if the
        // épicier opens it.
        walkInConversionService.getSuggestions(epicerieId)
          .then(list => setWalkInCandidatesCount(list.length))
          .catch(() => { /* non-blocking, ignore */ });
      }
    }, [epicerieId])
  );

  /**
   * Load all clients and statistics
   */
  const loadClients = async () => {
    if (!epicerieId) return;

    try {
      setLoading(true);

      // Load clients with their account information (includes balanceDue, totalAdvances, etc.)
      const clientsWithAccounts = await clientManagementService.getClientsWithAccounts(epicerieId);

      // Stats factures : reserve aux roles avec invoices:view (caissier exclu)
      const canViewInvoices = can('invoices:view');
      const invoiceStats = canViewInvoices
        ? await invoiceService.getInvoiceStats(epicerieId).catch(() => ({ totalUnpaid: 0 }))
        : { totalUnpaid: 0 };

      // Map to ClientWithDetails format
      const enrichedClients: ClientWithDetails[] = clientsWithAccounts.map(client => ({
        id: 0, // Not used in current implementation
        clientId: client.clientId,
        epicerieId: client.epicerieId,
        status: client.status || 'ACCEPTED',
        createdAt: '', // Not needed for list view
        clientNom: client.clientName || '', // Map clientName to clientNom
        clientEmail: client.clientEmail || '',
        allowCredit: client.allowCredit || false,
        creditLimit: client.creditLimit || 0,
        totalDebt: client.balanceDue || 0,
        totalAdvances: client.totalAdvances || 0,
        numberOfOrders: 0, // TODO: add this to backend response
      }));

      // Calculate total advances from all clients
      const totalAdvances = enrichedClients.reduce(
        (sum, client) => sum + (client.totalAdvances || 0),
        0
      );

      setClients(enrichedClients);
      setStats({
        totalClients: enrichedClients.length,
        totalDebt: invoiceStats.totalUnpaid || 0,
        totalAdvances: totalAdvances,
        unpaidInvoices: 0, // A calculer
      });
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Erreur', 'Impossible de charger les clients');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  };

  /**
   * Handle search
   */
  const filteredClients = clients.filter(client =>
    (client.clientNom?.toLowerCase() || '').includes(searchText.toLowerCase()) ||
    (client.clientEmail?.toLowerCase() || '').includes(searchText.toLowerCase())
  );

  /**
   * Navigate to carnet digital (remplace l'ancien détail client)
   */
  const handleClientPress = (clientId: number) => {
    router.push({
      pathname: '/(epicier)/carnet-client',
      params: { id: clientId.toString() },
    });
  };

  /**
   * Navigate to carnet digital (crédit accessible via le carnet)
   */
  const handleEditCredit = (clientId: number) => {
    router.push({
      pathname: '/(epicier)/carnet-client',
      params: { id: clientId.toString() },
    });
  };

  /**
   * Remove client
   */
  const handleRemoveClient = (clientId: number, clientName: string) => {
    Alert.alert(
      'Retirer le client',
      `Êtes-vous sûr de vouloir retirer ${clientName} de vos clients?`,
      [
        { text: 'Annuler', onPress: () => {}, style: 'cancel' },
        {
          text: 'Retirer',
          onPress: async () => {
            try {
              if (epicerieId) {
                await clientManagementService.removeClient(epicerieId, clientId);
                Alert.alert('Succès', 'Client retiré avec succès');
                await loadClients();
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de retirer le client');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalClients}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F44336' }]}>
            {stats.totalDebt.toFixed(2)} DH
          </Text>
          <Text style={styles.statLabel}>Montant dû</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {stats.totalAdvances.toFixed(2)} DH
          </Text>
          <Text style={styles.statLabel}>Avances</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => router.push('/(epicier)/inviter-clients')}
        >
          <Text style={styles.inviteButtonText}>+ Inviter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.virtualButton}
          onPress={() => router.push('/(epicier)/clients/nouveau-virtuel' as any)}
        >
          <Text style={styles.virtualButtonText}>📝 Carnet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => router.push('/(epicier)/factures')}
        >
          <Text style={styles.statsButtonText}>📊 Factures</Text>
        </TouchableOpacity>
      </View>

      {/* Walk-in conversion banner — only shown when the backend reports
           recurring anonymous customers worth promoting. The badge wraps under
           the action row so it doesn't compete with the always-visible buttons
           when there's no candidate. */}
      {walkInCandidatesCount > 0 && (
        <TouchableOpacity
          style={styles.walkInBanner}
          onPress={() => router.push('/(epicier)/passants-a-convertir' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.walkInBannerEmoji}>🚶</Text>
          <Text style={styles.walkInBannerText}>
            {tFmt(t, 'walkInConversion.badgeShort', { count: walkInCandidatesCount })}
          </Text>
          <Text style={styles.walkInBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Search Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
        <View style={[styles.searchSection, { flex: 1, marginHorizontal: 0 }]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchText('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {epicerieId && (
          <ClientQrScanButton
            epicerieId={epicerieId}
            iconOnly
            onResolved={(result) => handleClientPress(result.clientId)}
          />
        )}
      </View>

      {/* Clients List */}
      <FlatList
        data={filteredClients}
        keyExtractor={item => item.clientId.toString()}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={() => handleClientPress(item.clientId)}
            onEditCredit={canManageCredit
              ? () => handleEditCredit(item.clientId)
              : undefined}
            onRemove={canRemoveClient
              ? () => handleRemoveClient(item.clientId, item.clientNom)
              : undefined}
            showActions={true}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>👥</Text>
            <Text style={styles.emptyStateText}>
              {searchText
                ? 'Aucun client trouvé'
                : 'Vous n\'avez pas encore de clients'}
            </Text>
            {!searchText && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push('/(epicier)/inviter-clients')}
              >
                <Text style={styles.emptyStateButtonText}>
                  Inviter un client
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 10,
  },
  inviteButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  virtualButton: {
    flex: 1,
    backgroundColor: '#fff3e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  virtualButtonText: {
    color: '#e65100',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  statsButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  statsButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Walk-in conversion banner — amber tint to match the dashboard bucket.
  walkInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFB300',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  walkInBannerEmoji: { fontSize: 18 },
  walkInBannerText: {
    flex: 1, fontSize: 14, fontWeight: '700', color: '#5D4037',
  },
  walkInBannerArrow: { fontSize: 18, color: '#5D4037' },
  searchSection: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSizes.sm,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 18,
    color: '#999',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    marginBottom: 20,
    fontWeight: '500',
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
