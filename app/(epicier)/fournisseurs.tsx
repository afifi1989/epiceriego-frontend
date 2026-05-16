import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../src/components/feedback';
import {
  Supplier,
  SupplierStats,
  SupplierStatus,
  SUPPLIER_TYPE_EMOJI,
  SUPPLIER_TYPE_LABELS_FR,
  SupplierType,
  supplierService,
} from '../../src/services/supplierService';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';

/**
 * Liste des fournisseurs de l'epicerie (V96).
 *
 * <p>UI epicier mobile en francais uniquement.</p>
 *
 * <h2>Layout</h2>
 * <ol>
 *   <li>Tuiles stats en haut (4 cards : actifs / archives / batches 30j / dépense 30j)</li>
 *   <li>Tabs filtrants ACTIVE / ARCHIVED (compteurs synchronises avec stats)</li>
 *   <li>Recherche temps reel + bouton FAB "+"</li>
 *   <li>Card par fournisseur : nom + type badge + tel + dernier batch</li>
 * </ol>
 *
 * <p>Tap sur une card → fournisseur-detail. FAB → fournisseur-form en
 * mode creation.</p>
 */
type Tab = SupplierStatus;

export default function FournisseursScreen() {
  const ready = useRequirePermission('suppliers:manage');
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('ACTIVE');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      // Charger tous les fournisseurs (filtre cote client pour switch tabs
      // instantane sans re-fetch). Stats en parallele, best-effort.
      const [all, statsResp] = await Promise.allSettled([
        supplierService.list(),
        supplierService.stats(),
      ]);
      if (all.status === 'fulfilled') setItems(all.value);
      if (statsResp.status === 'fulfilled') setStats(statsResp.value);
      else setStats(null);
    } catch (err: any) {
      toast.error('Erreur', String(err));
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      // Garde-fou : evite les fetches mort-nes si l'utilisateur n'a pas la permission
      // (useRequirePermission va rediriger, mais l'effect tire au 1er render).
      if (!ready) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        await fetchData();
        if (!cancelled) setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [ready, fetchData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Filtrage cote client : status + recherche par nom/contact/tel.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(s => s.status === tab)
      .filter(s => !q
        || s.name.toLowerCase().includes(q)
        || (s.contactName ?? '').toLowerCase().includes(q)
        || (s.phone ?? '').includes(q));
  }, [items, tab, search]);

  const counts = useMemo(() => {
    const active = items.filter(s => s.status === 'ACTIVE').length;
    const archived = items.filter(s => s.status === 'ARCHIVED').length;
    return { active, archived };
  }, [items]);

  if (!ready) return null;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2196F3" />
        }
        ListHeaderComponent={
          <View>
            {/* ── Stats tiles ──────────────────────────────────────── */}
            {stats && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statsRow}
              >
                <StatTile icon="🏪" label="Actifs" value={String(stats.activeSuppliersCount)} accent="#2196F3" />
                <StatTile icon="📦" label="Archivés" value={String(stats.archivedSuppliersCount)} accent="#9E9E9E" />
                <StatTile icon="🚚" label="Réceptions 30j" value={String(stats.batchesReceived)} accent="#FF9800" />
                <StatTile icon="💰" label="Dépense 30j" value={`${(stats.totalSpend ?? 0).toFixed(2)} DH`} accent="#4CAF50" />
              </ScrollView>
            )}

            {/* ── Tabs + recherche ─────────────────────────────────── */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, tab === 'ACTIVE' && styles.tabActive]}
                onPress={() => setTab('ACTIVE')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, tab === 'ACTIVE' && styles.tabLabelActive]}>
                  Actifs ({counts.active})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'ARCHIVED' && styles.tabActive]}
                onPress={() => setTab('ARCHIVED')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, tab === 'ARCHIVED' && styles.tabLabelActive]}>
                  Archivés ({counts.archived})
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher (nom, contact, téléphone)..."
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        }
        renderItem={({ item }) => (
          <SupplierCard
            supplier={item}
            onPress={() => router.push({
              pathname: '/(epicier)/fournisseur-detail' as any,
              params: { id: String(item.id) },
            })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>Aucun fournisseur</Text>
            <Text style={styles.emptySub}>
              {tab === 'ACTIVE'
                ? 'Ajoutez vos fournisseurs habituels pour les retrouver à chaque réception.'
                : 'Aucun fournisseur archivé.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(epicier)/fournisseur-form' as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabPlus}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function StatTile({ icon, label, value, accent }: {
  icon: string; label: string; value: string; accent: string;
}) {
  return (
    <View style={[styles.statTile, { borderLeftColor: accent }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function SupplierCard({ supplier, onPress }: { supplier: Supplier; onPress: () => void }) {
  const emoji = supplier.supplierType
    ? SUPPLIER_TYPE_EMOJI[supplier.supplierType as SupplierType]
    : '🏪';
  const typeLabel = supplier.supplierType
    ? SUPPLIER_TYPE_LABELS_FR[supplier.supplierType as SupplierType]
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardEmojiBox}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName} numberOfLines={1}>{supplier.name}</Text>
        <View style={styles.cardMetaRow}>
          {typeLabel && <Text style={styles.cardMeta}>{typeLabel}</Text>}
          {supplier.contactName && (
            <Text style={styles.cardMeta} numberOfLines={1}>👤 {supplier.contactName}</Text>
          )}
        </View>
        {supplier.phone && (
          <Text style={styles.cardPhone}>📞 {supplier.phone}</Text>
        )}
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  list: { paddingBottom: 100 },

  statsRow: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  statTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 150,
    borderLeftWidth: 4,
    gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#222' },
  statLabel: { fontSize: 11, color: '#777', fontWeight: '600', textTransform: 'uppercase' },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  tabLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabLabelActive: { color: '#fff' },

  searchInput: {
    margin: 12,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 14,
    color: '#222',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardEmojiBox: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmoji: { fontSize: 22 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#222' },
  cardMetaRow: { flexDirection: 'row', gap: 10, marginTop: 2, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11, color: '#666' },
  cardPhone: { fontSize: 12, color: '#1976d2', marginTop: 3, fontWeight: '600' },
  cardChevron: { fontSize: 28, color: '#bbb' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#444', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },

  fab: {
    position: 'absolute',
    bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '700', marginTop: -2 },
});
