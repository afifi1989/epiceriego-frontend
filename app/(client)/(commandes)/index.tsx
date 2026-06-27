export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Skeleton, useToast } from '../../../src/components/feedback';
import { useLanguage } from '../../../src/context/LanguageContext';
import { orderService } from '../../../src/services/orderService';
import { reorderService } from '../../../src/services/reorderService';
import { Order } from '../../../src/type';
import { formatDate } from '../../../src/utils/dateFormat';
import { formatPrice, getStatusColor, getStatusLabel } from '../../../src/utils/helpers';

/** Statuts pour lesquels la commande est terminée et "recommandable". */
const REORDER_ALLOWED_STATUSES = new Set(['DELIVERED', 'CANCELLED']);

export default function OrdersScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  /** Skeleton uniquement au 1er chargement. Les pull-to-refresh suivants
   *  laissent la liste affichée. */
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Source unique de chargement des commandes. Le flag `silent` désactive le
   * toast d'erreur lors d'un refresh manuel (où le RefreshControl arrête de
   * tourner — moins agressif visuellement).
   */
  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const data = await orderService.getMyOrders();
      setOrders(data || []);
    } catch (error) {
      console.error('[OrdersScreen] fetchOrders failed:', error);
      if (!silent) {
        toast.error(t('common.error'), t('orders.loadError') || 'Impossible de charger vos commandes');
      }
    }
  }, [toast, t]);

  // Recharger les commandes CHAQUE FOIS qu'on navigue vers cette page
  useFocusEffect(
    useCallback(() => {
      fetchOrders().finally(() => setInitialLoading(false));
    }, [fetchOrders])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders(true);
    setRefreshing(false);
  }, [fetchOrders]);

  /**
   * Quick reorder: pousse les items de la commande passée vers le panier
   * et redirige immédiatement. Si certains items ne sont pas réinjectables
   * (data manquante), on l'indique dans le toast pour la transparence.
   */
  const handleReorder = useCallback(async (order: Order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const result = await reorderService.reorderFromOrder(order);
      if (result.added === 0) {
        toast.warning(
          t('common.error'),
          t('orders.reorderEmpty') || 'Aucun article n\'a pu être réajouté'
        );
        return;
      }
      const detail = result.skipped > 0
        ? `${result.added} article(s) • ${result.skipped} indisponible(s)`
        : `${result.added} article(s)`;
      toast.success(t('orders.reorderSuccess') || 'Panier rempli', detail);
      if (result.cartReset) {
        // Info supplémentaire si on a écrasé un panier cross-épicerie.
        // Délai léger pour ne pas se cumuler avec le success ci-dessus.
        setTimeout(() => {
          toast.info(
            t('orders.cartReplaced') || 'Panier remplacé',
            order.epicerieNom
          );
        }, 350);
      }
      router.push('/(client)/cart');
    } catch (error) {
      console.error('[OrdersScreen] reorder failed:', error);
      toast.error(t('common.error'), String(error));
    }
  }, [router, toast, t]);


  const renderOrderItem = ({ item }: { item: Order }) => {
    const canReorder = REORDER_ALLOWED_STATUSES.has(item.status) && item.items?.length > 0;

    return (
      <View style={styles.orderCard}>
        {/* Tap zone principale -> détail. Le footer est en dehors pour éviter
            que le tap "Recommander" ne déclenche aussi le tap parent. */}
        <TouchableOpacity
          onPress={() => router.push(`/(client)/(commandes)/${item.id}`)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${t('orders.commandePrefix')}${item.id}, ${getStatusLabel(item.status)}, ${item.epicerieNom}, ${formatPrice(item.total, item.currency)}`}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.orderNumber}>{t('orders.commandePrefix')}{item.id}</Text>
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
              <Text style={[styles.value, styles.priceText]}>{formatPrice(item.total, item.currency)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t('orders.items') || 'Articles'}</Text>
              <Text style={styles.value}>{item.nombreItems}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t('orders.date')}</Text>
              <Text style={styles.value}>
                {formatDate(item.createdAt, language)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.detailLink}
            onPress={() => router.push(`/(client)/(commandes)/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${t('orders.viewDetails')} — ${t('orders.commandePrefix')}${item.id}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.moreInfo}>{t('orders.viewDetails')}</Text>
          </TouchableOpacity>

          {canReorder && (
            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={() => handleReorder(item)}
              accessibilityRole="button"
              accessibilityLabel={`${t('orders.reorder') || 'Recommander'} — ${t('orders.commandePrefix')}${item.id}`}
            >
              <Ionicons name="repeat" size={14} color="#fff" />
              <Text style={styles.reorderBtnText}>
                {t('orders.reorder') || 'Recommander'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <Skeleton variant="text" width="40%" height={16} />
                <Skeleton variant="rect" width={80} height={22} style={{ borderRadius: 12 }} />
              </View>
              <View style={styles.cardBody}>
                {[0, 1, 2, 3].map(j => (
                  <View key={j} style={styles.infoRow}>
                    <Skeleton variant="text" width="35%" />
                    <Skeleton variant="text" width="40%" />
                  </View>
                ))}
              </View>
              <View style={styles.cardFooter}>
                <Skeleton variant="text" width="30%" />
              </View>
            </View>
          ))}
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  moreInfo: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  reorderBtnText: {
    color: '#fff',
    fontWeight: '700',
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
