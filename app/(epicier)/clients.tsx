import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ClientCard } from '../../src/components/epicier/ClientCard';
import { Colors, FontSizes } from '../../src/constants/colors';
import { useLanguage } from '../../src/context/LanguageContext';
import { clientManagementService } from '../../src/services/clientManagementService';
import { invoiceService } from '../../src/services/invoiceService';
import { ClientEpicerieRelation } from '../../src/type';

interface ClientWithDetails extends ClientEpicerieRelation {
  totalDebt?: number;
  totalAdvances?: number;
  numberOfOrders?: number;
}

export default function ClientsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
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

  /**
   * Get epicerie ID from storage
   */
  useEffect(() => {
    const getEpicerieId = async () => {
      const user = await AsyncStorage.getItem('@epiceriego_user');
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

      // Load clients
      const clientList = await clientManagementService.getEpicerieClients(
        epicerieId,
        0,
        100
      );

      // Load invoice stats
      const invoiceStats = await invoiceService.getInvoiceStats(epicerieId);

      // Enrich clients with financial data
      const enrichedClients: ClientWithDetails[] = clientList.map(client => ({
        ...client,
        totalDebt: 0,
        totalAdvances: 0,
        numberOfOrders: 0,
      }));

      setClients(enrichedClients);
      setStats({
        totalClients: enrichedClients.length,
        totalDebt: invoiceStats.totalUnpaid || 0,
        totalAdvances: 0, // A calculer à partir des paiements
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
    client.clientNom.toLowerCase().includes(searchText.toLowerCase()) ||
    client.clientEmail.toLowerCase().includes(searchText.toLowerCase())
  );

  /**
   * Navigate to client details
   */
  const handleClientPress = (clientId: number) => {
    router.push({
      pathname: '/(epicier)/clients/[id]',
      params: { id: clientId.toString() },
    });
  };

  /**
   * Navigate to edit credit screen
   */
  const handleEditCredit = (clientId: number) => {
    router.push({
      pathname: '/(epicier)/clients/credit/[id]',
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
          <Text style={styles.inviteButtonText}>+ Inviter un client</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => router.push('/(epicier)/factures')}
        >
          <Text style={styles.statsButtonText}>📊 Factures</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
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

      {/* Clients List */}
      <FlatList
        data={filteredClients}
        keyExtractor={item => item.clientId.toString()}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={() => handleClientPress(item.clientId)}
            onEditCredit={() => handleEditCredit(item.clientId)}
            onRemove={() =>
              handleRemoveClient(item.clientId, item.clientNom)
            }
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
