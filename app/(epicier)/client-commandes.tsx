export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Toutes les commandes d'un client (épicerie courante).
 *
 * Liste paginée avec scroll infini + filtre « En cours / Toutes ».
 * Poussé depuis la section Commandes du carnet (« Voir tout »).
 *
 * Params :
 *  - clientId  (requis)
 *  - clientName (optionnel, pour le titre)
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { useLanguage } from '../../src/context/LanguageContext';
import { orderService } from '../../src/services/orderService';
import { Order } from '../../src/type';
import { formatPrice, getStatusColor } from '../../src/utils/helpers';

const BLUE = Colors.primary;
const PAGE_SIZE = 20;

type OrderFilter = 'ALL' | 'ACTIVE';

export default function ClientCommandesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { clientId: clientIdParam, clientName } = useLocalSearchParams<{
    clientId: string;
    clientName?: string;
  }>();
  const clientId = parseInt(clientIdParam ?? '0', 10);

  const [filter, setFilter] = useState<OrderFilter>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = clientName
    ? t('clientOrders.title', { name: clientName })
    : t('clientOrders.titleGeneric');

  // Libellé de statut traduit (fallback : code brut si clé absente).
  const statusLabel = useCallback((status: string) => {
    const key = `carnetOrders.status.${status}`;
    const label = t(key);
    return label === key ? status : label;
  }, [t]);

  // Charge la 1ʳᵉ page (ou la liste « en cours ») selon le filtre courant.
  const load = useCallback(async (nextFilter: OrderFilter, isRefresh = false) => {
    if (clientId <= 0) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (nextFilter === 'ACTIVE') {
        const active = await orderService.getEpicerieClientActiveOrders(clientId);
        setOrders(active);
        setHasMore(false);
        setPage(0);
      } else {
        const res = await orderService.getEpicerieClientOrders(clientId, { page: 0, size: PAGE_SIZE });
        setOrders(res.content ?? []);
        setHasMore(!res.last);
        setPage(0);
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : t('clientOrders.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, t]);

  useEffect(() => { load(filter); }, [filter, load]);

  // Scroll infini — uniquement en mode « Toutes » (liste paginée).
  const loadMore = useCallback(async () => {
    if (filter !== 'ALL' || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await orderService.getEpicerieClientOrders(clientId, { page: nextPage, size: PAGE_SIZE });
      setOrders(prev => [...prev, ...(res.content ?? [])]);
      setHasMore(!res.last);
      setPage(nextPage);
    } catch {
      // Silencieux : on garde la liste déjà chargée. L'utilisateur peut
      // retenter en scrollant à nouveau.
    } finally {
      setLoadingMore(false);
    }
  }, [filter, loadingMore, hasMore, loading, page, clientId]);

  const openOrder = useCallback((orderId: number) => {
    router.push(`/details-commande?orderId=${orderId}` as any);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => openOrder(item.id)}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.orderRef}>{t('carnetOrders.orderRef', { id: item.id })}</Text>
        <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.orderAmount}>{formatPrice(item.total, item.currency)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [openOrder, statusLabel, t]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Barre de navigation ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {/* ── Filtre : En cours / Toutes ── */}
      <View style={styles.filterRow}>
        {(['ACTIVE', 'ALL'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'ACTIVE' ? t('clientOrders.filterActive') : t('clientOrders.filterAll')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── États : chargement / erreur / vide / liste ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(filter)} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('screenState.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t('clientOrders.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={() => load(filter, true)}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={BLUE} size="small" />
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BLUE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa', gap: 10 },

  headerBar: {
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f5f7fa',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4b5563' },
  chipTextActive: { color: '#fff' },

  listContent: {
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 14,
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eceff1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  orderRef: { fontSize: 14, fontWeight: '800', color: '#374151' },
  orderDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  orderAmount: { fontSize: 14, fontWeight: '900', color: '#1f2937' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  footer: { paddingVertical: 16 },
  emptyText: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  errorText: { fontSize: 14, color: '#e53935', textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: BLUE, fontWeight: '800', fontSize: 14 },
});
