import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { InvoiceCard } from '../../src/components/epicier/InvoiceCard';
import { Colors, FontSizes } from '../../src/constants/colors';
import { useLanguage } from '../../src/context/LanguageContext';
import { invoiceService } from '../../src/services/invoiceService';
import { Invoice } from '../../src/type';

const { width } = Dimensions.get('window');

type InvoiceFilter = 'all' | 'unpaid' | 'paid';

export default function FacturesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<InvoiceFilter>('all');
  const [stats, setStats] = useState({
    totalUnpaid: 0,
    totalPaid: 0,
    overdue: 0,
    averageDaysOverdue: 0,
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
   * Load invoices when epicerie ID is available
   */
  useFocusEffect(
    useCallback(() => {
      if (epicerieId) {
        loadInvoices();
      }
    }, [epicerieId])
  );

  /**
   * Load all invoices and statistics
   */
  const loadInvoices = async () => {
    if (!epicerieId) return;

    try {
      setLoading(true);

      // Load invoices
      const invoiceList = await invoiceService.getEpicerieInvoices(epicerieId);
      setInvoices(invoiceList);

      // Load statistics
      const invoiceStats = await invoiceService.getInvoiceStats(epicerieId);
      setStats(invoiceStats);
    } catch (error) {
      console.error('Error loading invoices:', error);
      Alert.alert('Erreur', 'Impossible de charger les factures');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  /**
   * Filter invoices based on selected filter
   */
  const filteredInvoices = invoices.filter(invoice => {
    if (filterType === 'unpaid') return invoice.status === 'UNPAID';
    if (filterType === 'paid') return invoice.status === 'PAID';
    return true;
  });

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
                reference || 'Paiement enregistré'
              );
              Alert.alert('Succès', 'Facture marquée comme payée');
              await loadInvoices();
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

  return (
    <View style={styles.container}>
      {/* Statistics Section */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {stats.totalUnpaid.toFixed(2)} DH
          </Text>
          <Text style={styles.statLabel}>Non payées</Text>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>
              {invoices.filter(i => i.status === 'UNPAID').length}
            </Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {stats.totalPaid.toFixed(2)} DH
          </Text>
          <Text style={styles.statLabel}>Payées</Text>
          <View style={[styles.statBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.statBadgeText, { color: '#4CAF50' }]}>
              {invoices.filter(i => i.status === 'PAID').length}
            </Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#FF9800' }]}>
            {stats.overdue}
          </Text>
          <Text style={styles.statLabel}>En retard</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterSection}>
        {(['all', 'unpaid', 'paid'] as InvoiceFilter[]).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              filterType === filter && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType(filter)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === filter && styles.filterButtonTextActive,
              ]}
            >
              {filter === 'all'
                ? 'Toutes'
                : filter === 'unpaid'
                  ? 'Non payées'
                  : 'Payées'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Invoices List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.invoiceListItem}>
            <InvoiceCard
              invoice={item}
              onMarkPaid={() => handleMarkInvoiceAsPaid(item.id)}
              showActions={true}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📄</Text>
            <Text style={styles.emptyStateText}>
              {filterType === 'all'
                ? 'Aucune facture'
                : filterType === 'unpaid'
                  ? 'Aucune facture non payée'
                  : 'Aucune facture payée'}
            </Text>
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 10,
  },
  statValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  statBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statBadgeText: {
    color: '#F44336',
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  invoiceListItem: {
    marginBottom: 12,
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
