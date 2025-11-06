import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { orderService } from '../../../src/services/orderService';
import { useLanguage } from '../../../src/context/LanguageContext';
import { Order } from '../../../src/type';
import { formatPrice, getStatusLabel, getStatusColor } from '../../../src/utils/helpers';

export default function OrdersScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Recharger les commandes CHAQUE FOIS qu'on navigue vers cette page
  useFocusEffect(
    useCallback(() => {
      console.log('[OrdersScreen] 🔄 Commandes reloadées au focus');
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      setLoading(true);
      console.log('[OrdersScreen] Chargement des commandes...');
      const data = await orderService.getMyOrders();
      console.log('[OrdersScreen] ✅ Commandes chargées:', data?.length || 0, 'commandes');
      setOrders(data || []);
    } catch (error) {
      console.error('[OrdersScreen] ❌ Erreur chargement commandes:', error);
      Alert.alert(t('common.error'), t('orders.loadError') || 'Impossible de charger vos commandes');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('[OrdersScreen] 🔄 Rafraîchissement des commandes...');
      const data = await orderService.getMyOrders();
      console.log('[OrdersScreen] ✅ Commandes rafraîchies:', data?.length || 0, 'commandes');
      setOrders(data || []);
    } catch (error) {
      console.error('[OrdersScreen] ❌ Erreur rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  };


  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.push(`/(client)/(commandes)/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>Commande #{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('epiceries.title')}</Text>
          <Text style={styles.value}>{item.epicerieNom}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('orders.total')}</Text>
          <Text style={[styles.value, styles.priceText]}>{formatPrice(item.total)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('orders.items') || 'Articles'}</Text>
          <Text style={styles.value}>{item.nombreItems}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('orders.date')}</Text>
          <Text style={styles.value}>
            {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.moreInfo}>{t('orders.viewDetails')}</Text>
      </View>
    </TouchableOpacity>
  );

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{t('orders.empty')}</Text>
      <Text style={styles.emptyDescription}>
        {t('orders.emptyDescription')}
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.replace('/(client)/epiceries')}
      >
        <Text style={styles.browseButtonText}>{t('epiceries.browse')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={emptyComponent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 15,
    flexGrow: 1,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  cardBody: {
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  priceText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  cardFooter: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  moreInfo: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
