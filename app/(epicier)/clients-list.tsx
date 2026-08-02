export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
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
import { clientManagementService, DeletionEligibility } from '../../src/services/clientManagementService';
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
  // Vue courante : clients actifs (par défaut) ou archivés (clôturés, lecture seule).
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  // Les archivés sont chargés À LA DEMANDE (lazy) au 1er passage sur l'onglet.
  const [archivedClients, setArchivedClients] = useState<ClientWithDetails[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
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
   * Map a raw client-with-account payload (même forme pour actifs et archivés)
   * vers le format ClientWithDetails utilisé par la carte. Le status brut est
   * conservé (ACCEPTED / PENDING / ARCHIVED …) pour piloter l'affichage.
   */
  const mapAccountToDetails = (client: any): ClientWithDetails => ({
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
  });

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
      const enrichedClients: ClientWithDetails[] = clientsWithAccounts.map(mapAccountToDetails);

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
   * Load ARCHIVED clients on demand (lazy). Même forme de données que la vue
   * active, mais rendues en lecture seule (aucune action).
   */
  const loadArchivedClients = async () => {
    if (!epicerieId) return;
    try {
      setArchivedLoading(true);
      const list = await clientManagementService.getArchivedClients(epicerieId);
      setArchivedClients(list.map(mapAccountToDetails));
      setArchivedLoaded(true);
    } catch (error) {
      console.error('Error loading archived clients:', error);
      Alert.alert('Erreur', t('clientsArchive.loadError'));
    } finally {
      setArchivedLoading(false);
    }
  };

  /** Bascule Actifs / Archivés ; charge les archivés au 1er affichage. */
  const switchView = (mode: 'active' | 'archived') => {
    setViewMode(mode);
    if (mode === 'archived' && !archivedLoaded && !archivedLoading) {
      loadArchivedClients();
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'archived') {
      await loadArchivedClients();
    } else {
      await loadClients();
    }
    setRefreshing(false);
  };

  /**
   * Handle search — s'applique à la vue courante (actifs ou archivés).
   */
  const isArchivedView = viewMode === 'archived';
  const sourceClients = isArchivedView ? archivedClients : clients;
  const filteredClients = sourceClients.filter(client =>
    (client.clientNom?.toLowerCase() || '').includes(searchText.toLowerCase()) ||
    (client.clientEmail?.toLowerCase() || '').includes(searchText.toLowerCase())
  );

  /**
   * Navigate to carnet digital (remplace l'ancien détail client).
   * En vue archivée, on transmet `archived=1` pour ouvrir le dossier en
   * LECTURE SEULE (toutes les actions masquées côté carnet).
   */
  const handleClientPress = (clientId: number, archived = false) => {
    router.push({
      pathname: '/(epicier)/carnet-client',
      params: archived
        ? { id: clientId.toString(), archived: '1' }
        : { id: clientId.toString() },
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
      'Clôturer la relation',
      `Retirer ${clientName} ? L'historique (carnet, factures) reste conservé.`,
      [
        { text: 'Annuler', onPress: () => {}, style: 'cancel' },
        {
          text: 'Clôturer',
          onPress: () => attemptRemoveClient(clientId, clientName),
          style: 'destructive',
        },
      ]
    );
  };

  /** Tente la clôture ; sur 409 (compte non soldé) propose la régularisation. */
  const attemptRemoveClient = async (clientId: number, clientName: string) => {
    if (!epicerieId) return;
    try {
      await clientManagementService.removeClient(epicerieId, clientId);
      Alert.alert('Client retiré', `${clientName} a été retiré. Historique conservé.`);
      await loadClients();
    } catch (error: any) {
      const elig: DeletionEligibility | undefined = error?.eligibility;
      if (!elig) {
        Alert.alert('Erreur', typeof error === 'string' ? error : 'Impossible de retirer le client');
        return;
      }
      handleBlockedRemoval(clientId, clientName, elig);
    }
  };

  /** Compte non soldé : oriente vers le règlement de dette ou le remboursement. */
  const handleBlockedRemoval = (
    clientId: number,
    clientName: string,
    elig: DeletionEligibility
  ) => {
    if (elig.requiredActions.includes('SETTLE_DEBT')) {
      Alert.alert(
        'Régularisation requise',
        `Compte non soldé : ce client doit ${elig.totalDebtUnpaid.toFixed(2)}. `
          + `Envoyez un rappel, ou ouvrez le carnet pour encaisser.`,
        [
          { text: 'Fermer', style: 'cancel' },
          {
            text: 'Envoyer un rappel',
            onPress: async () => {
              if (!epicerieId) return;
              try {
                await clientManagementService.sendDebtReminder(epicerieId, clientId);
                Alert.alert('Rappel envoyé', `${clientName} a été notifié.`);
              } catch (e: any) {
                Alert.alert('Erreur', typeof e === 'string' ? e : 'Rappel impossible');
              }
            },
          },
          {
            text: 'Ouvrir le carnet',
            onPress: () => router.push({
              pathname: '/(epicier)/carnet-client',
              params: { id: clientId.toString() },
            }),
          },
        ]
      );
      return;
    }

    if (elig.requiredActions.includes('REFUND_ADVANCE')) {
      const amount = elig.refundableAdvance;
      Alert.alert(
        "Rembourser l'avance",
        `Ce client a une avance de ${amount.toFixed(2)}. La rembourser (espèces) et clôturer ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Rembourser et clôturer',
            onPress: async () => {
              if (!epicerieId) return;
              try {
                await clientManagementService.refundAdvance(epicerieId, clientId, {
                  amount, paymentMethod: 'CASH',
                });
                Alert.alert('Avance remboursée', `${amount.toFixed(2)} remboursés.`);
                await attemptRemoveClient(clientId, clientName);
              } catch (e: any) {
                Alert.alert('Erreur', typeof e === 'string' ? e : 'Remboursement impossible');
              }
            },
          },
        ]
      );
    }
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

      {/* Segment Actifs | Archivés — les archivés sont chargés à la demande */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, !isArchivedView && styles.segmentBtnActive]}
          onPress={() => switchView('active')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, !isArchivedView && styles.segmentTextActive]}>
            {t('clientsArchive.tabActive')} ({clients.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, isArchivedView && styles.segmentBtnActive]}
          onPress={() => switchView('archived')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, isArchivedView && styles.segmentTextActive]}>
            {t('clientsArchive.tabArchived')}
            {archivedLoaded ? ` (${archivedClients.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

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
            onPress={() => handleClientPress(item.clientId, isArchivedView)}
            // Vue archivée : LECTURE SEULE — on ne passe AUCUNE action.
            onEditCredit={!isArchivedView && canManageCredit
              ? () => handleEditCredit(item.clientId)
              : undefined}
            onRemove={!isArchivedView && canRemoveClient
              ? () => handleRemoveClient(item.clientId, item.clientNom)
              : undefined}
            showActions={!isArchivedView}
          />
        )}
        ListEmptyComponent={
          isArchivedView && archivedLoading && !archivedLoaded ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>{isArchivedView ? '🗄️' : '👥'}</Text>
              <Text style={styles.emptyStateText}>
                {searchText
                  ? 'Aucun client trouvé'
                  : isArchivedView
                    ? t('clientsArchive.emptyArchived')
                    : 'Vous n\'avez pas encore de clients'}
              </Text>
              {!searchText && !isArchivedView && (
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
          )
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
  // Segment Actifs | Archivés
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginTop: 4,
    marginBottom: 2,
    backgroundColor: '#eceff1',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.primary,
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
