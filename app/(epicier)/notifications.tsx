/**
 * Notifications épicier — centre de notifications moderne.
 *
 * <p>Pendant épicier de l'écran client {@code (client)/notifications.tsx}.
 * Réutilise {@link notificationService} avec un design ciblé : filtres par
 * type (Toutes / Non lues / Commandes / Système), groupage par date,
 * swipe-to-delete, "Tout marquer lu", deep-linking vers la cible.</p>
 *
 * <p>UI épicier mobile en français uniquement.</p>
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  notificationService,
  Notification,
} from '../../src/services/notificationService';

type Filter = 'ALL' | 'UNREAD' | 'ORDERS' | 'SYSTEM';

/** Détermine la pastille couleur + emoji selon le type de notif. */
function notifVisuals(type: string): { emoji: string; color: string; bg: string } {
  const t = type.toUpperCase();
  if (t.includes('ORDER') || t.includes('COMMANDE')) {
    return { emoji: '🛒', color: '#1976D2', bg: '#E3F2FD' };
  }
  if (t.includes('INVITATION') || t.includes('CLIENT')) {
    return { emoji: '👥', color: '#7B1FA2', bg: '#F3E5F5' };
  }
  if (t.includes('PAYMENT') || t.includes('PAIEMENT') || t.includes('INVOICE')) {
    return { emoji: '💰', color: '#388E3C', bg: '#E8F5E9' };
  }
  if (t.includes('STOCK') || t.includes('RUPTURE')) {
    return { emoji: '📦', color: '#F57C00', bg: '#FFF3E0' };
  }
  if (t.includes('DELIVERY') || t.includes('LIVR')) {
    return { emoji: '🚚', color: '#00838F', bg: '#E0F7FA' };
  }
  return { emoji: '🔔', color: '#455A64', bg: '#ECEFF1' };
}

/** Format relatif "il y a Xmin / il y a Xh / Xj" — plus compact qu'une date. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'à l\'instant';
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `il y a ${Math.floor(sec / 3600)} h`;
  const d = Math.floor(sec / 86400);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Détermine la route cible à partir des data de la notif. */
function routeFor(notif: Notification): string | null {
  const data = typeof notif.data === 'string'
    ? (() => { try { return JSON.parse(notif.data); } catch { return null; } })()
    : notif.data;
  if (!data) return null;
  if (data.orderId) return `/(epicier)/details-commande?orderId=${data.orderId}`;
  if (data.clientId) return `/(epicier)/carnet-client?id=${data.clientId}`;
  return null;
}

export default function NotificationsEpicierScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('ALL');
  const [markingAll, setMarkingAll] = useState(false);

  const load = async () => {
    try {
      const list = await notificationService.getAllNotifications(0, 200);
      setNotifications(list);
    } catch (e) {
      console.warn('[Notifications] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Comptages pour les chips
  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter(n => !n.isRead).length,
    orders: notifications.filter(n =>
      n.type.toUpperCase().includes('ORDER') || n.type.toUpperCase().includes('COMMANDE')
    ).length,
    system: notifications.filter(n => {
      const t = n.type.toUpperCase();
      return !t.includes('ORDER') && !t.includes('COMMANDE')
          && !t.includes('INVITATION') && !t.includes('CLIENT');
    }).length,
  }), [notifications]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'UNREAD':
        return notifications.filter(n => !n.isRead);
      case 'ORDERS':
        return notifications.filter(n =>
          n.type.toUpperCase().includes('ORDER') || n.type.toUpperCase().includes('COMMANDE')
        );
      case 'SYSTEM':
        return notifications.filter(n => {
          const t = n.type.toUpperCase();
          return !t.includes('ORDER') && !t.includes('COMMANDE')
              && !t.includes('INVITATION') && !t.includes('CLIENT');
        });
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // Groupage par date pour le rendu en sections (Aujourd'hui / Hier / etc.)
  type Group = { label: string; items: Notification[] };
  const grouped: Group[] = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    for (const n of filtered) {
      const d = new Date(n.dateCreated);
      let key: string;
      if (d >= today) key = "Aujourd'hui";
      else if (d >= yesterday) key = 'Hier';
      else if (d >= weekAgo) key = 'Cette semaine';
      else key = 'Plus ancien';
      (groups[key] ||= []).push(n);
    }
    const order = ["Aujourd'hui", 'Hier', 'Cette semaine', 'Plus ancien'];
    return order
      .filter(k => groups[k]?.length)
      .map(label => ({ label, items: groups[label] }));
  }, [filtered]);

  const handleNotifPress = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await notificationService.markAsRead(n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      } catch { /* non-blocking */ }
    }
    const route = routeFor(n);
    if (route) router.push(route as any);
  };

  const handleDelete = (n: Notification) => {
    Alert.alert(
      'Supprimer la notification',
      'Voulez-vous supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.deleteNotification(n.id);
              setNotifications(prev => prev.filter(x => x.id !== n.id));
            } catch {
              Alert.alert('Erreur', 'Suppression impossible.');
            }
          },
        },
      ]
    );
  };

  const handleMarkAllRead = async () => {
    if (counts.unread === 0) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      Alert.alert('Erreur', 'Action impossible.');
    } finally {
      setMarkingAll(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  const renderNotif = ({ item }: { item: Notification }) => {
    const v = notifVisuals(item.type);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleNotifPress(item)}
        onLongPress={() => handleDelete(item)}
        style={[styles.card, !item.isRead && styles.cardUnread]}
      >
        <View style={[styles.iconBox, { backgroundColor: v.bg }]}>
          <Text style={styles.emoji}>{v.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={1}>
              {item.titre}
            </Text>
            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: v.color }]} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.time}>{relativeTime(item.dateCreated)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={counts.unread === 0 || markingAll}
          style={[
            styles.markAllBtn,
            (counts.unread === 0 || markingAll) && styles.markAllBtnDisabled,
          ]}
        >
          {markingAll
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.markAllText}>✓ Tout lu</Text>}
        </TouchableOpacity>
      </View>

      {/* Filtres chips */}
      <View style={styles.filterRow}>
        <FilterChip
          label="Toutes" count={counts.all}
          active={activeFilter === 'ALL'} onPress={() => setActiveFilter('ALL')}
        />
        <FilterChip
          label="Non lues" count={counts.unread}
          active={activeFilter === 'UNREAD'} onPress={() => setActiveFilter('UNREAD')}
          highlight
        />
        <FilterChip
          label="Commandes" count={counts.orders}
          active={activeFilter === 'ORDERS'} onPress={() => setActiveFilter('ORDERS')}
        />
        <FilterChip
          label="Système" count={counts.system}
          active={activeFilter === 'SYSTEM'} onPress={() => setActiveFilter('SYSTEM')}
        />
      </View>

      {/* Liste */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'UNREAD'
              ? 'Tu es à jour, bravo !'
              : 'Les nouvelles notifications apparaîtront ici.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={g => g.label}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
          }
          renderItem={({ item: group }) => (
            <View>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.items.map(n => (
                <View key={n.id}>{renderNotif({ item: n })}</View>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  highlight?: boolean;
  onPress: () => void;
}
const FilterChip: React.FC<FilterChipProps> = ({ label, count, active, highlight, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.chip,
      active && (highlight ? styles.chipActiveAlert : styles.chipActive),
    ]}
    activeOpacity={0.85}
  >
    <Text style={[
      styles.chipLabel,
      active && (highlight ? styles.chipLabelActiveAlert : styles.chipLabelActive),
    ]}>
      {label}
    </Text>
    {count > 0 && (
      <View style={[
        styles.chipCount,
        active && (highlight ? styles.chipCountActiveAlert : styles.chipCountActive),
      ]}>
        <Text style={[
          styles.chipCountText,
          active && styles.chipCountTextActive,
        ]}>{count}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  markAllBtnDisabled: { opacity: 0.45 },
  markAllText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#2196F3', borderColor: '#1976D2' },
  chipActiveAlert: { backgroundColor: '#EF4444', borderColor: '#dc2626' },
  chipLabel: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  chipLabelActive: { color: '#fff' },
  chipLabelActiveAlert: { color: '#fff' },
  chipCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipCountActiveAlert: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipCountText: { fontSize: 10, fontWeight: '800', color: '#4b5563' },
  chipCountTextActive: { color: '#fff' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },

  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
    backgroundColor: '#f8fbff',
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  titleUnread: { fontWeight: '800', color: '#1f2937' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  message: { fontSize: 13, color: '#6b7280', lineHeight: 17 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});
