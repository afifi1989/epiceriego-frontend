export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Écran "Alertes stock" (S4) — vue consolidée pour l'épicier :
 * ruptures / stock bas / DLC proche / ruptures prévisionnelles.
 *
 * Navigation : stack (pas un tab) — accessible depuis le dashboard.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  StockAlertsResponse,
  getExpiryLevel,
  stockService
} from '../../src/services/stockService';

type Tab = 'ruptures' | 'low' | 'expiring' | 'predicted';

const TAB_META: Record<Tab, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ruptures:  { label: 'Ruptures',      icon: 'close-circle',        color: '#e53935' },
  low:       { label: 'Stock bas',     icon: 'warning',             color: '#fb8c00' },
  expiring:  { label: 'DLC proche',    icon: 'time',                color: '#8e24aa' },
  predicted: { label: 'Rupture prévue', icon: 'trending-down',      color: '#1e88e5' }
};

export default function StockAlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<StockAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('ruptures');

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await stockService.getAlerts();
      setAlerts(data);
    } catch {
      // Silent — UI shows loading end
    } finally {
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = {
    ruptures:  alerts?.ruptures.length ?? 0,
    low:       alerts?.lowStock.length ?? 0,
    expiring:  alerts?.expiringSoon.length ?? 0,
    predicted: alerts?.predictedRuptures.length ?? 0
  };
  const total = counts.ruptures + counts.low + counts.expiring + counts.predicted;

  const openProduct = (productId: number) => {
    router.push(`/(epicier)/fiche-produit?productId=${productId}` as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alertes stock</Text>
        {total > 0 && (
          <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{total}</Text></View>
        )}
      </View>

      {loading && !alerts
        ? <View style={styles.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>
        : (
          <>
            {/* Onglets */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
              {(Object.keys(TAB_META) as Tab[]).map(k => {
                const meta = TAB_META[k];
                const count = counts[k];
                const active = tab === k;
                return (
                  <TouchableOpacity key={k}
                    style={[styles.tabBtn, active && { borderColor: meta.color, backgroundColor: meta.color + '15' }]}
                    onPress={() => setTab(k)}>
                    <Ionicons name={meta.icon} size={16} color={active ? meta.color : '#777'} />
                    <Text style={[styles.tabText, active && { color: meta.color, fontWeight: '700' }]}>
                      {meta.label}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.tabCount, { backgroundColor: meta.color }]}>
                        <Text style={styles.tabCountText}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Contenu */}
            <ScrollView
              style={styles.content}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            >
              {tab === 'ruptures' && (
                <>
                  {counts.ruptures === 0
                    ? <EmptyBlock icon="checkmark-circle" color="#2e7d32" text="Aucune rupture — tout est en stock !" />
                    : alerts!.ruptures.map(r => (
                      <TouchableOpacity key={r.productUnitId} style={styles.card} onPress={() => openProduct(r.productId)}>
                        <View style={[styles.cardDot, { backgroundColor: '#e53935' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{r.productNom}</Text>
                          <Text style={styles.cardSub}>{r.unitLabel} • seuil : {r.effectiveThreshold}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#bbb" />
                      </TouchableOpacity>
                    ))
                  }
                </>
              )}

              {tab === 'low' && (
                <>
                  {counts.low === 0
                    ? <EmptyBlock icon="checkmark-circle" color="#2e7d32" text="Aucun produit sous le seuil d'alerte." />
                    : alerts!.lowStock.map(l => (
                      <TouchableOpacity key={l.productUnitId} style={styles.card} onPress={() => openProduct(l.productId)}>
                        <View style={[styles.cardDot, { backgroundColor: '#fb8c00' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{l.productNom}</Text>
                          <Text style={styles.cardSub}>{l.unitLabel} • stock {l.stock} / seuil {l.effectiveThreshold}</Text>
                        </View>
                        <Text style={[styles.cardRight, { color: '#fb8c00' }]}>{l.stock}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#bbb" style={{ marginLeft: 6 }}/>
                      </TouchableOpacity>
                    ))
                  }
                </>
              )}

              {tab === 'expiring' && (
                <>
                  {counts.expiring === 0
                    ? <EmptyBlock icon="checkmark-circle" color="#2e7d32" text="Aucun lot proche de la péremption." />
                    : alerts!.expiringSoon.map(b => {
                      const level = getExpiryLevel(b.daysUntilExpiry);
                      const color = level === 'expired' ? '#b71c1c'
                        : level === 'urgent' ? '#e53935'
                        : level === 'soon' ? '#fb8c00'
                        : '#8e24aa';
                      const dlcLabel = b.daysUntilExpiry == null
                        ? 'Sans DLC'
                        : b.daysUntilExpiry < 0
                          ? `Périmé depuis ${-b.daysUntilExpiry}j`
                          : `J-${b.daysUntilExpiry}`;
                      return (
                        <View key={b.id} style={styles.card}>
                          <View style={[styles.cardDot, { backgroundColor: color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>Lot #{b.id} — {b.quantityRemaining} unités</Text>
                            <Text style={styles.cardSub}>
                              {b.expiryDate ?? 'Sans DLC'}
                              {b.supplierName ? ` • ${b.supplierName}` : ''}
                            </Text>
                          </View>
                          <Text style={[styles.cardRight, { color }]}>{dlcLabel}</Text>
                        </View>
                      );
                    })
                  }
                </>
              )}

              {tab === 'predicted' && (
                <>
                  {counts.predicted === 0
                    ? <EmptyBlock icon="checkmark-circle" color="#2e7d32"
                        text={`Aucune rupture prévue dans les ${alerts?.predictionHorizonDays ?? 5} prochains jours.`} />
                    : alerts!.predictedRuptures.map(p => (
                      <TouchableOpacity key={p.productUnitId} style={styles.card} onPress={() => openProduct(p.productId)}>
                        <View style={[styles.cardDot, { backgroundColor: '#1e88e5' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{p.productNom}</Text>
                          <Text style={styles.cardSub}>
                            {p.unitLabel} • stock {p.currentStock} • {p.velocityPerDay.toFixed(1)}/j
                          </Text>
                          <Text style={styles.cardSuggest}>
                            → Commander ≈ {p.suggestedReorderQuantity} unités
                          </Text>
                        </View>
                        <Text style={[styles.cardRight, { color: '#1e88e5' }]}>
                          {p.estimatedDaysLeft < 1 ? '< 1j' : `${Math.round(p.estimatedDaysLeft)}j`}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color="#bbb" style={{ marginLeft: 6 }}/>
                      </TouchableOpacity>
                    ))
                  }
                </>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </>
        )
      }
    </SafeAreaView>
  );
}

const EmptyBlock: React.FC<{ icon: keyof typeof Ionicons.glyphMap; color: string; text: string }> =
  ({ icon, color, text }) => (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={color} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },
  headerBadge: {
    backgroundColor: '#e53935', borderRadius: 11, minWidth: 22, height: 22,
    paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center'
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabsScroll: {
    flexGrow: 0, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 10, paddingVertical: 8
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0',
    marginRight: 8, backgroundColor: '#fff'
  },
  tabText: { fontSize: 13, color: '#777' },
  tabCount: {
    borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', marginLeft: 2
  },
  tabCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  content: { flex: 1, padding: 14 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#ececec'
  },
  cardDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  cardSub: { fontSize: 12, color: '#888', marginTop: 2 },
  cardSuggest: { fontSize: 12, color: '#1e88e5', fontWeight: '700', marginTop: 3 },
  cardRight: { fontSize: 14, fontWeight: '800' },

  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#777', textAlign: 'center', maxWidth: 260 }
});
