import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { InvoiceCard } from '../../src/components/epicier/InvoiceCard';
import { Colors, FontSizes } from '../../src/constants/colors';
import { useLanguage } from '../../src/context/LanguageContext';
import { creditPaymentService } from '../../src/services/creditPaymentService';
import { invoiceService } from '../../src/services/invoiceService';
import { Invoice, Payment } from '../../src/type';

type Tab = 'unpaid' | 'history' | 'advances';

export default function FacturesPaiementsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('unpaid');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [advances, setAdvances] = useState({
    totalAdvances: 0,
    availableBalance: 0,
    usedBalance: 0,
    byStore: [] as Array<{
      epicerieId: number;
      epicerieName: string;
      totalAdvances: number;
      availableBalance: number;
      usedBalance: number;
    }>,
  });

  /**
   * Load data when screen is focused
   */
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  /**
   * Load all data
   */
  const loadData = async () => {
    try {
      setLoading(true);

      // Load unpaid invoices
      const unpaid = await invoiceService.getMyUnpaidInvoices();
      setUnpaidInvoices(unpaid);

      // Load all invoices
      const allInv = await invoiceService.getMyInvoiceHistory();
      setAllInvoices(allInv);

      // Load payment history
      const paymentHistory = await creditPaymentService.getMyPaymentHistory();
      setPayments(paymentHistory);

      // Load advances
      const advancesData = await creditPaymentService.getMyAdvances();
      setAdvances(advancesData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  /**
   * Calculate total unpaid
   */
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  /**
   * Calculate total paid
   */
  const totalPaid = allInvoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>À payer</Text>
          <Text style={[styles.summaryValue, { color: '#F44336' }]}>
            {totalUnpaid.toFixed(2)} DH
          </Text>
          <Text style={styles.summaryCount}>
            {unpaidInvoices.length} facture{unpaidInvoices.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Payé</Text>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            {totalPaid.toFixed(2)} DH
          </Text>
          <Text style={styles.summaryCount}>
            {allInvoices.filter(i => i.status === 'PAID').length} facture
            {allInvoices.filter(i => i.status === 'PAID').length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Avances</Text>
          <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
            {(advances.availableBalance ?? 0).toFixed(2)} DH
          </Text>
          <Text style={styles.summaryCount}>disponibles</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsSection}>
        {(['unpaid', 'history', 'advances'] as Tab[]).map(tab => (
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
              {tab === 'unpaid'
                ? 'À payer'
                : tab === 'history'
                  ? 'Historique'
                  : 'Avances'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <FlatList
        data={
          activeTab === 'unpaid'
            ? unpaidInvoices
            : activeTab === 'history'
              ? allInvoices
              : []
        }
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) =>
          activeTab === 'unpaid' || activeTab === 'history' ? (
            <View style={styles.listItem}>
              <InvoiceCard
                invoice={item as Invoice}
                onPress={() => {
                  // Could navigate to invoice details
                }}
                showActions={activeTab === 'unpaid'}
                isClientView={true}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          activeTab === 'advances' ? (
            <View style={styles.advancesContent}>
              {!advances.byStore || advances.byStore.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateEmoji}>💰</Text>
                  <Text style={styles.emptyStateText}>
                    Aucune avance enregistrée
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={advances.byStore}
                  keyExtractor={item => item.epicerieId.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.advanceCard}>
                      <View style={styles.advanceHeader}>
                        <Text style={styles.advanceStoreName}>
                          {item.epicerieName}
                        </Text>
                        <Text style={styles.advanceTotal}>
                          {(item.totalAdvances ?? 0).toFixed(2)} DH
                        </Text>
                      </View>

                      <View style={styles.advanceRow}>
                        <Text style={styles.advanceLabel}>Disponible</Text>
                        <Text
                          style={[
                            styles.advanceValue,
                            { color: '#4CAF50' },
                          ]}
                        >
                          {(item.availableBalance ?? 0).toFixed(2)} DH
                        </Text>
                      </View>

                      <View style={styles.advanceRow}>
                        <Text style={styles.advanceLabel}>Utilisé</Text>
                        <Text
                          style={[
                            styles.advanceValue,
                            { color: '#FF9800' },
                          ]}
                        >
                          {(item.usedBalance ?? 0).toFixed(2)} DH
                        </Text>
                      </View>
                    </View>
                  )}
                  scrollEnabled={false}
                  contentContainerStyle={styles.advancesList}
                />
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>📄</Text>
              <Text style={styles.emptyStateText}>
                {activeTab === 'unpaid'
                  ? 'Aucune facture à payer'
                  : 'Aucune facture'}
              </Text>
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
  summarySection: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
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
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  listItem: {
    marginBottom: 12,
  },
  advancesContent: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  advancesList: {
    paddingVertical: 0,
  },
  advanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  advanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  advanceStoreName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
  },
  advanceTotal: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  advanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  advanceLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  advanceValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
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
    fontWeight: '500',
  },
});
