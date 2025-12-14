/**
 * Écran de liste des commandes pour épicier
 * Affiche les commandes à traiter avec filtrage par statut
 */

import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import epicierOrderService from '@/src/services/epicierOrderService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

interface OrderItemForList {
  id: number;
  clientName: string;
  itemCount: number;
  totalAmount: number;
  status: 'NEW' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'CANCELLED';
  createdAt: string;
  deliveryType: 'PICKUP' | 'DELIVERY';
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En préparation',
  READY: 'Prête',
  PICKED_UP: 'Récupérée',
  CANCELLED: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: Colors.danger,
  PREPARING: Colors.warning,
  READY: Colors.success,
  PICKED_UP: Colors.primary,
  CANCELLED: Colors.textSecondary,
};

const STATUS_ICONS: Record<string, string> = {
  NEW: 'clock-outline',
  PREPARING: 'progress-clock',
  READY: 'check-circle',
  PICKED_UP: 'package-check',
  CANCELLED: 'cancel',
};

export default function OrderListScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItemForList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [stats, setStats] = useState({
    newOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      // Fetch new orders
      const newOrders = await epicierOrderService.getNewOrders(0, 50);

      // Fetch orders by status
      const preparingOrders = await epicierOrderService.getOrders('PREPARING', 0, 50);
      const readyOrders = await epicierOrderService.getOrders('READY', 0, 50);

      const allOrders = [
        ...(newOrders?.content || []),
        ...(preparingOrders?.content || []),
        ...(readyOrders?.content || []),
      ];

      // Transform to OrderItemForList format
      const transformedOrders: OrderItemForList[] = allOrders.map((order: any) => ({
        id: order.id,
        clientName: order.clientName || 'Client',
        itemCount: order.items?.length || 0,
        totalAmount: order.totalAmount || 0,
        status: order.status || 'NEW',
        createdAt: order.createdAt || new Date().toISOString(),
        deliveryType: order.deliveryType || 'PICKUP',
      }));

      setOrders(transformedOrders);

      // Update stats
      setStats({
        newOrders: transformedOrders.filter((o) => o.status === 'NEW').length,
        preparingOrders: transformedOrders.filter((o) => o.status === 'PREPARING').length,
        readyOrders: transformedOrders.filter((o) => o.status === 'READY').length,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger les commandes',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  };

  const filteredOrders = selectedStatus
    ? orders.filter((o) => o.status === selectedStatus)
    : orders.sort((a, b) => {
        // Sort by priority: NEW > PREPARING > READY > others
        const priorityMap = { NEW: 0, PREPARING: 1, READY: 2 };
        const priorityA = priorityMap[a.status as keyof typeof priorityMap] ?? 3;
        const priorityB = priorityMap[b.status as keyof typeof priorityMap] ?? 3;
        return priorityA - priorityB;
      });

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return 'À l\'instant';
      if (diffMinutes < 60) return `Il y a ${diffMinutes}m`;
      if (diffMinutes < 1440) return `Il y a ${Math.floor(diffMinutes / 60)}h`;
      return date.toLocaleDateString('fr-FR');
    } catch {
      return 'N/A';
    }
  };

  const handleOrderPress = (orderId: number) => {
    router.push({
      pathname: '/commande-prep',
      params: { orderId: orderId.toString() },
    });
  };

  const renderOrderCard = ({ item }: { item: OrderItemForList }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleOrderPress(item.id)}
      activeOpacity={0.7}
    >
      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: STATUS_COLORS[item.status] },
        ]}
      >
        <MaterialCommunityIcons
          name={STATUS_ICONS[item.status] as any}
          size={16}
          color={Colors.textInverse}
          style={{ marginRight: Spacing.xs }}
        />
        <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</Text>
      </View>

      {/* Order Info */}
      <View style={styles.orderInfo}>
        <View style={styles.orderHeader}>
          <Text style={styles.clientName}>{item.clientName}</Text>
          <Text style={styles.orderTime}>{formatTime(item.createdAt)}</Text>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons
              name="package"
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.detailText}>{item.itemCount} article(s)</Text>
          </View>

          <View style={styles.detailItem}>
            <MaterialCommunityIcons
              name="currency-eur"
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.detailText}>{item.totalAmount.toFixed(2)} DH</Text>
          </View>

          <View style={styles.detailItem}>
            <MaterialCommunityIcons
              name={item.deliveryType === 'DELIVERY' ? 'truck' : 'store'}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.detailText}>
              {item.deliveryType === 'DELIVERY' ? 'Livraison' : 'Retrait'}
            </Text>
          </View>
        </View>
      </View>

      {/* Arrow */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={Colors.textSecondary}
      />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={[
            styles.statCard,
            selectedStatus === 'NEW' && styles.statCardActive,
          ]}
          onPress={() => setSelectedStatus(selectedStatus === 'NEW' ? null : 'NEW')}
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={24}
            color={selectedStatus === 'NEW' ? Colors.primary : Colors.danger}
          />
          <Text
            style={[
              styles.statValue,
              selectedStatus === 'NEW' && styles.statValueActive,
            ]}
          >
            {stats.newOrders}
          </Text>
          <Text
            style={[
              styles.statLabel,
              selectedStatus === 'NEW' && styles.statLabelActive,
            ]}
          >
            Nouvelles
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statCard,
            selectedStatus === 'PREPARING' && styles.statCardActive,
          ]}
          onPress={() =>
            setSelectedStatus(selectedStatus === 'PREPARING' ? null : 'PREPARING')
          }
        >
          <MaterialCommunityIcons
            name="progress-clock"
            size={24}
            color={selectedStatus === 'PREPARING' ? Colors.primary : Colors.warning}
          />
          <Text
            style={[
              styles.statValue,
              selectedStatus === 'PREPARING' && styles.statValueActive,
            ]}
          >
            {stats.preparingOrders}
          </Text>
          <Text
            style={[
              styles.statLabel,
              selectedStatus === 'PREPARING' && styles.statLabelActive,
            ]}
          >
            En cours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statCard,
            selectedStatus === 'READY' && styles.statCardActive,
          ]}
          onPress={() => setSelectedStatus(selectedStatus === 'READY' ? null : 'READY')}
        >
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color={selectedStatus === 'READY' ? Colors.primary : Colors.success}
          />
          <Text
            style={[
              styles.statValue,
              selectedStatus === 'READY' && styles.statValueActive,
            ]}
          >
            {stats.readyOrders}
          </Text>
          <Text
            style={[
              styles.statLabel,
              selectedStatus === 'READY' && styles.statLabelActive,
            ]}
          >
            Prêtes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="inbox"
            size={48}
            color={Colors.textSecondary}
          />
          <Text style={styles.emptyStateText}>
            {selectedStatus
              ? 'Aucune commande avec ce statut'
              : 'Aucune commande'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  statValueActive: {
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  statLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  statusBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  orderInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  orderTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  orderDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyStateText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
