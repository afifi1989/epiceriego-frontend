import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { InvoiceCard } from '../../../src/components/epicier/InvoiceCard';
import { Colors, FontSizes } from '../../../src/constants/colors';
import { useLanguage } from '../../../src/context/LanguageContext';
import { clientManagementService } from '../../../src/services/clientManagementService';
import { invoiceService } from '../../../src/services/invoiceService';
import { ClientAccount, ClientEpicerieRelation, Invoice } from '../../../src/type';

type Tab = 'general' | 'invoices' | 'payments' | 'credit';

export default function ClientDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams();
  const clientId = parseInt(id as string);

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientEpicerieRelation | null>(null);
  const [accountInfo, setAccountInfo] = useState<ClientAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

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
   * Load client details when data is available
   */
  useFocusEffect(
    useCallback(() => {
      if (epicerieId && clientId) {
        loadClientDetails();
      }
    }, [epicerieId, clientId])
  );

  /**
   * Load all client data
   */
  const loadClientDetails = async () => {
    if (!epicerieId) return;

    try {
      setLoading(true);

      // Load client relationship details
      const clientData = await clientManagementService.getClientDetails(
        epicerieId,
        clientId
      );
      setClientDetails(clientData);

      // Load account information
      const account = await clientManagementService.getClientAccount(
        epicerieId,
        clientId
      );
      setAccountInfo(account);

      // Load invoices
      const invoiceList = await invoiceService.getClientInvoices(
        epicerieId,
        clientId
      );
      setInvoices(invoiceList);
    } catch (error) {
      console.error('Error loading client details:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du client');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClientDetails();
    setRefreshing(false);
  };

  /**
   * Mark invoice as paid
   */
  const handleMarkInvoiceAsPaid = (invoiceId: number) => {
    Alert.prompt(
      'Marquer comme payée',
      'Entrez une référence de paiement (optionnel)',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Marquer comme payée',
          onPress: async (reference: any) => {
            try {
              await invoiceService.markInvoiceAsPaid(
                invoiceId,
                reference || 'Paiement en espèces'
              );
              Alert.alert('Succès', 'Facture marquée comme payée');
              await loadClientDetails();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de marquer la facture');
            }
          },
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

  if (!clientDetails || !accountInfo) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erreur: Client non trouvé</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with client info */}
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.clientName}>{clientDetails.clientNom}</Text>
          <Text style={styles.clientEmail}>{clientDetails.clientEmail}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            clientDetails.status === 'ACCEPTED'
              ? styles.statusAccepted
              : styles.statusPending,
          ]}
        >
          <Text style={styles.statusText}>
            {clientDetails.status === 'ACCEPTED' ? '✓ Accepté' : '⏳ En attente'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsSection}>
        {(['general', 'invoices', 'payments', 'credit'] as Tab[]).map(
          (tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === 'general'
                  ? 'Général'
                  : tab === 'invoices'
                    ? 'Factures'
                    : tab === 'payments'
                      ? 'Paiements'
                      : 'Crédit'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentSection}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {activeTab === 'general' && (
          <View style={styles.tabContent}>
            {/* Financial Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Résumé financier</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Montant dû</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    accountInfo.balanceDue > 0 &&
                      styles.summaryValueWarning,
                  ]}
                >
                  {accountInfo.balanceDue.toFixed(2)} DH
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Avances disponibles</Text>
                <Text style={[styles.summaryValue, styles.summaryValuePositive]}>
                  {accountInfo.totalAdvances.toFixed(2)} DH
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Solde net</Text>
                <Text style={styles.summaryValue}>
                  {(accountInfo.balanceDue - accountInfo.totalAdvances).toFixed(2)} DH
                </Text>
              </View>
            </View>

            {/* Credit Status */}
            <View style={styles.creditCard}>
              <Text style={styles.cardTitle}>Statut du crédit</Text>

              <View style={styles.creditStatus}>
                <Text style={styles.creditLabel}>Crédit autorisé</Text>
                <View
                  style={[
                    styles.creditToggle,
                    clientDetails.allowCredit &&
                      styles.creditToggleActive,
                  ]}
                >
                  <Text style={styles.creditToggleText}>
                    {clientDetails.allowCredit ? '✓ OUI' : '✗ NON'}
                  </Text>
                </View>
              </View>

              {clientDetails.allowCredit && clientDetails.creditLimit && (
                <View style={styles.creditStatus}>
                  <Text style={styles.creditLabel}>Limite de crédit</Text>
                  <Text style={styles.creditValue}>
                    {clientDetails.creditLimit.toFixed(2)} DH
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: '/(epicier)/clients/credit/[id]',
                    params: { id: clientId.toString() },
                  })
                }
              >
                <Text style={styles.editButtonText}>⚙️ Gérer crédit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'invoices' && (
          <View style={styles.tabContent}>
            {invoices.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>📄</Text>
                <Text style={styles.emptyStateText}>Aucune facture</Text>
              </View>
            ) : (
              <FlatList
                data={invoices}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <InvoiceCard
                    invoice={item}
                    onMarkPaid={() => handleMarkInvoiceAsPaid(item.id)}
                    showActions={true}
                  />
                )}
                scrollEnabled={false}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        )}

        {activeTab === 'payments' && (
          <View style={styles.tabContent}>
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>
                💰 L'historique des paiements s'affichera ici
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'credit' && (
          <View style={styles.tabContent}>
            <View style={styles.creditInfoCard}>
              <Text style={styles.cardTitle}>Paramètres de crédit</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>État actuel:</Text>
                <Text style={styles.infoValue}>
                  {clientDetails.allowCredit ? '🟢 Actif' : '🔴 Inactif'}
                </Text>
              </View>

              {clientDetails.creditLimit && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Limite:</Text>
                  <Text style={styles.infoValue}>
                    {clientDetails.creditLimit.toFixed(2)} DH
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Utilisé:</Text>
                <Text style={styles.infoValue}>
                  {accountInfo.balanceDue.toFixed(2)} DH
                </Text>
              </View>

              {clientDetails.creditLimit && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          (accountInfo.balanceDue / clientDetails.creditLimit) *
                            100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: '/(epicier)/clients/credit/[id]',
                    params: { id: clientId.toString() },
                  })
                }
              >
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    fontSize: FontSizes.base,
    color: Colors.text,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  clientName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  clientEmail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusAccepted: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  tabsSection: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  contentSection: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: Colors.text,
  },
  summaryValueWarning: {
    color: '#F44336',
  },
  summaryValuePositive: {
    color: '#4CAF50',
  },
  creditCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  creditStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  creditLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  creditToggle: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  creditToggleActive: {
    backgroundColor: '#E8F5E9',
  },
  creditToggleText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: '#F44336',
  },
  creditValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  editButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  editButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  creditInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: Colors.text,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginVertical: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  placeholderText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 0,
  },
});
