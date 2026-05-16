import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { useToast } from '../../src/components/feedback';
import {
  derivePromoCodeStatus,
  promoCodeEpicierService,
  PromoCodeDTO,
  PromoCodeStatus,
} from '../../src/services/promoCodeService';
import { formatDate } from '../../src/utils/helpers';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';

/**
 * Liste des codes promos de l'epicerie (V95).
 *
 * <p>UI epicier mobile en francais uniquement (cf. EpicierLanguageProvider).
 *
 * <h2>Filtres tabs</h2>
 * Quatre buckets calcules cote client a partir de {@link derivePromoCodeStatus} :
 * <ul>
 *   <li>Actifs : isActive=true ET maintenant ∈ [startAt, endAt]</li>
 *   <li>Planifies : isActive=true ET maintenant &lt; startAt</li>
 *   <li>Expires : isActive=true ET maintenant &gt;= endAt</li>
 *   <li>Desactives : isActive=false</li>
 * </ul>
 *
 * <p>Navigation : tap sur une card -> form en mode edit. FAB "+" -> form en mode create.
 */
type Tab = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';

const TAB_LABELS: Record<Tab, string> = {
  ACTIVE: 'Actifs',
  SCHEDULED: 'Planifiés',
  EXPIRED: 'Expirés',
  INACTIVE: 'Désactivés',
};

const STATUS_COLOR: Record<PromoCodeStatus, { bg: string; fg: string }> = {
  ACTIVE:    { bg: '#e8f5e9', fg: '#2e7d32' },
  SCHEDULED: { bg: '#e3f2fd', fg: '#1565c0' },
  EXPIRED:   { bg: '#fff3e0', fg: '#ef6c00' },
  INACTIVE:  { bg: '#f5f5f5', fg: '#757575' },
};

export default function CodesPromosScreen() {
  const ready = useRequirePermission('promoCodes:manage');
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useState<PromoCodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('ACTIVE');

  const fetchData = useCallback(async () => {
    try {
      const list = await promoCodeEpicierService.list();
      setItems(list);
    } catch (err: any) {
      toast.error('Erreur', String(err));
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        await fetchData();
        if (!cancelled) setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [ready, fetchData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Buckets pre-calcules pour les counters des tabs et le filtrage de la liste.
  const bucketed = useMemo(() => {
    const now = new Date();
    const groups: Record<Tab, PromoCodeDTO[]> = {
      ACTIVE: [], SCHEDULED: [], EXPIRED: [], INACTIVE: [],
    };
    for (const it of items) {
      groups[derivePromoCodeStatus(it, now) as Tab].push(it);
    }
    return groups;
  }, [items]);

  const visible = bucketed[tab];

  const handleToggle = useCallback(
    async (item: PromoCodeDTO) => {
      try {
        const updated = await promoCodeEpicierService.toggle(item.id, !item.isActive);
        setItems(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        toast.success('OK', updated.isActive ? 'Code réactivé' : 'Code désactivé');
      } catch (err: any) {
        toast.error('Erreur', String(err));
      }
    },
    [toast]
  );

  const handleDelete = useCallback(
    (item: PromoCodeDTO) => {
      Alert.alert(
        'Supprimer ce code ?',
        `${item.code} sera supprimé définitivement.\n\nSi ce code a déjà été utilisé, la suppression sera refusée — désactivez-le plutôt pour préserver l'historique.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await promoCodeEpicierService.remove(item.id);
                setItems(prev => prev.filter(p => p.id !== item.id));
                toast.success('Supprimé', item.code);
              } catch (err: any) {
                toast.error('Refusé', String(err));
              }
            },
          },
        ]
      );
    },
    [toast]
  );

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
      {/* Tabs filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {(['ACTIVE', 'SCHEDULED', 'EXPIRED', 'INACTIVE'] as Tab[]).map(t => {
          const count = bucketed[t].length;
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {TAB_LABELS[t]} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2196F3" />
        }
        renderItem={({ item }) => (
          <PromoCodeCard
            item={item}
            onPress={() => router.push({
              pathname: '/(epicier)/code-promo-form' as any,
              params: { id: String(item.id) },
            })}
            onToggle={() => handleToggle(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏷️</Text>
            <Text style={styles.emptyTitle}>Aucun code dans cette catégorie</Text>
            <Text style={styles.emptySub}>
              {tab === 'ACTIVE'
                ? 'Créez un code pour booster vos ventes.'
                : tab === 'SCHEDULED'
                  ? 'Aucun code planifié pour plus tard.'
                  : tab === 'EXPIRED'
                    ? 'Aucun code expiré.'
                    : 'Aucun code désactivé.'}
            </Text>
          </View>
        }
      />

      {/* FAB création */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(epicier)/code-promo-form' as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabPlus}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Card
// ════════════════════════════════════════════════════════════════════════════

interface PromoCodeCardProps {
  item: PromoCodeDTO;
  onPress: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function PromoCodeCard({ item, onPress, onToggle, onDelete }: PromoCodeCardProps) {
  const status = derivePromoCodeStatus(item);
  const colors = STATUS_COLOR[status];

  const discountLabel = item.discountType === 'PERCENT'
    ? `-${item.discountValue}%`
    : `-${item.discountValue.toFixed(2)} DH`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHead}>
        <View style={styles.cardCodeBlock}>
          <Text style={styles.cardCode}>{item.code}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.badgeText, { color: colors.fg }]}>{discountLabel}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.metaItem}>
          📅 {formatDate(item.startAt)} → {formatDate(item.endAt)}
        </Text>
        <Text style={styles.metaItem}>
          🛒 Utilisé {item.usesCount}
          {item.maxUses != null ? ` / ${item.maxUses}` : ''}
        </Text>
        {item.minOrderAmount != null && (
          <Text style={styles.metaItem}>
            💰 Min. {item.minOrderAmount.toFixed(2)} DH
          </Text>
        )}
        {item.firstOrderOnly && (
          <Text style={styles.metaItem}>👋 Nouveaux clients</Text>
        )}
        <Text style={styles.metaItem}>
          🎯 Canal : {item.channel === 'BOTH' ? 'App + Caisse' : item.channel === 'APP' ? 'App seulement' : 'Caisse seulement'}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggle} activeOpacity={0.7}>
          <Text style={[styles.actionText, { color: item.isActive ? '#ef6c00' : '#2e7d32' }]}>
            {item.isActive ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.7}>
          <Text style={[styles.actionText, { color: '#c62828' }]}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },

  tabBar: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0', flexGrow: 0 },
  tabBarContent: { paddingVertical: 12, paddingHorizontal: 12, gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#f5f5f5' },
  tabActive: { backgroundColor: '#2196F3' },
  tabLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabLabelActive: { color: '#fff' },

  list: { padding: 12, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardCodeBlock: { flex: 1 },
  cardCode: { fontSize: 18, fontWeight: '800', color: '#222', letterSpacing: 1 },
  cardDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 14, fontWeight: '700' },

  cardMeta: { gap: 4, marginBottom: 12 },
  metaItem: { fontSize: 12, color: '#555' },

  cardActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee', paddingTop: 10, gap: 8 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  actionText: { fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#444', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },

  fab: {
    position: 'absolute',
    bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: -2 },
});
