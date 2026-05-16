import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { orderService } from '../../src/services/orderService';
import { offlineService } from '../../src/services/offline';
import { OrderListItem, OrderCounts } from '../../src/type';
import { formatPrice, getStatusLabel, getStatusColor } from '../../src/utils/helpers';

// ─────────────────────────────────────────────────────────────────────────
// Pattern Inbox/Archive : la page sépare les commandes "en cours"
// (PENDING/ACCEPTED/PREPARING/READY/IN_DELIVERY) — chargées immédiatement,
// pollées 15s, bornées par nature — de l'historique (DELIVERED/CANCELLED)
// — lazy au premier clic, paginé backend, infinite scroll. Avantages :
//   • Polling 15s ne recharge plus 500+ commandes archivées.
//   • Mémoire bornée : ~10 actives + page courante de l'archive.
//   • Recherche full-text côté backend sur l'archive.
// ─────────────────────────────────────────────────────────────────────────

type TopTab = 'active' | 'archive';
type ArchiveFilter = 'ALL' | 'DELIVERED' | 'CANCELLED';

const POLL_INTERVAL_MS = 15_000;
const ARCHIVE_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export default function CommandesScreen() {
  const router = useRouter();

  // ── Top tab ────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TopTab>('active');

  // ── Active orders (polling, jamais paginé) ─────────────────────────
  const [activeOrders, setActiveOrders] = useState<OrderListItem[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [refreshingActive, setRefreshingActive] = useState(false);

  // ── Archive orders (lazy, paginé, infinite scroll) ─────────────────
  const [archiveOrders, setArchiveOrders] = useState<OrderListItem[]>([]);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveLast, setArchiveLast] = useState(true);
  const [archiveTotalElements, setArchiveTotalElements] = useState(0);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('ALL');
  const [archiveSearchInput, setArchiveSearchInput] = useState('');
  const [archiveSearchDebounced, setArchiveSearchDebounced] = useState('');
  const [refreshingArchive, setRefreshingArchive] = useState(false);

  // ── Compteurs (badges + stats) ─────────────────────────────────────
  const [counts, setCounts] = useState<OrderCounts>({ active: 0, delivered: 0, cancelled: 0, today: 0 });

  // ── Live indicator (uniquement sur active) ─────────────────────────
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [updatedTick, setUpdatedTick] = useState(0);
  const lastPendingIdsRef = useRef<Set<number>>(new Set());

  // ── Selection multi (bulk) — uniquement sur active ─────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedOrderIds(new Set());
  }, []);

  const toggleOrderSelection = useCallback((orderId: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const enterSelectionWith = useCallback((orderId: number) => {
    setSelectionMode(true);
    setSelectedOrderIds(new Set([orderId]));
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // Active orders : load + polling + offline cache
  // ═════════════════════════════════════════════════════════════════

  const loadActive = useCallback(async (opts: { force?: boolean; silent?: boolean } = {}) => {
    try {
      const data = await offlineService.fetchWithCache<OrderListItem[]>({
        namespace: 'orders',
        key: 'epicerie-orders-active',
        fetcher: () => orderService.getActiveEpicerieOrders(),
        forceRefresh: opts.force ?? false,
      });
      if (data) {
        // Détecte nouvelles PENDING par diff IDs (skip 1er load).
        const previous = lastPendingIdsRef.current;
        const currentPendingIds = new Set(
          data.filter(o => o.status === 'PENDING').map(o => o.id)
        );
        if (previous.size > 0) {
          const fresh = Array.from(currentPendingIds).some(id => !previous.has(id));
          if (fresh) setHasNewOrders(true);
        }
        lastPendingIdsRef.current = currentPendingIds;

        setActiveOrders(data);
        setLastUpdatedAt(Date.now());
      }
    } catch (error) {
      if (!opts.silent && offlineService.isOnline()) {
        Alert.alert('Erreur', 'Impossible de charger les commandes en cours');
      }
    } finally {
      if (!opts.silent) {
        setLoadingActive(false);
        setRefreshingActive(false);
      }
    }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const c = await orderService.getEpicerieOrdersCounts();
      setCounts(c);
    } catch {
      // Silencieux : juste les badges, pas critique
    }
  }, []);

  useEffect(() => {
    loadActive();
    loadCounts();
  }, [loadActive, loadCounts]);

  // Tick toutes les 10s pour rafraîchir "il y a Xs"
  useEffect(() => {
    const t = setInterval(() => setUpdatedTick(v => v + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  // Polling silencieux uniquement quand on est sur la tab active ET focus.
  useFocusEffect(
    useCallback(() => {
      // Premier refresh au focus
      loadActive({ force: true });
      loadCounts();

      // Polling uniquement quand la tab active est visible — ça
      // évite de payer 4 requêtes/min quand l'utilisateur consulte
      // l'historique ou parcourt une commande.
      const intervalId = setInterval(() => {
        if (tab === 'active') {
          loadActive({ force: true, silent: true });
        }
      }, POLL_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [loadActive, loadCounts, tab])
  );

  // ═════════════════════════════════════════════════════════════════
  // Archive orders : lazy + paginé + recherche debouncée
  // ═════════════════════════════════════════════════════════════════

  // Debounce de la recherche : on attend SEARCH_DEBOUNCE_MS d'inactivité
  // avant de déclencher un fetch. Évite une requête par caractère tapé.
  useEffect(() => {
    if (archiveSearchInput === archiveSearchDebounced) return;
    const t = setTimeout(() => {
      setArchiveSearchDebounced(archiveSearchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [archiveSearchInput, archiveSearchDebounced]);

  const fetchArchivePage = useCallback(async (
    page: number,
    statuses: string[] | undefined,
    q: string | undefined,
    append: boolean,
  ) => {
    setArchiveLoading(true);
    try {
      const result = await orderService.getArchiveEpicerieOrders({
        page,
        size: ARCHIVE_PAGE_SIZE,
        statuses,
        q: q?.trim() || undefined,
      });
      setArchiveOrders(prev => append ? [...prev, ...result.content] : result.content);
      setArchivePage(page);
      setArchiveLast(result.last);
      setArchiveTotalElements(result.totalElements);
      setArchiveLoaded(true);
    } catch (error) {
      if (offlineService.isOnline()) {
        Alert.alert('Erreur', 'Impossible de charger l\'historique');
      }
    } finally {
      setArchiveLoading(false);
      setRefreshingArchive(false);
    }
  }, []);

  // Refetch from page 0 quand filtre ou recherche change ET qu'on a déjà
  // chargé une fois (sinon on déclenche un fetch au switch de tab).
  useEffect(() => {
    if (!archiveLoaded) return;
    const statuses = archiveFilter === 'ALL' ? undefined : [archiveFilter];
    fetchArchivePage(0, statuses, archiveSearchDebounced, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveFilter, archiveSearchDebounced]);

  const onSwitchTab = useCallback((next: TopTab) => {
    if (next === tab) return;
    setTab(next);
    if (next !== 'active') exitSelectionMode();
    if (next === 'archive' && !archiveLoaded) {
      const statuses = archiveFilter === 'ALL' ? undefined : [archiveFilter];
      fetchArchivePage(0, statuses, archiveSearchDebounced, false);
    }
  }, [tab, archiveLoaded, archiveFilter, archiveSearchDebounced, exitSelectionMode, fetchArchivePage]);

  const onArchiveEndReached = useCallback(() => {
    if (archiveLast || archiveLoading) return;
    const statuses = archiveFilter === 'ALL' ? undefined : [archiveFilter];
    fetchArchivePage(archivePage + 1, statuses, archiveSearchDebounced, true);
  }, [archiveLast, archiveLoading, archivePage, archiveFilter, archiveSearchDebounced, fetchArchivePage]);

  const onRefreshActive = () => {
    setRefreshingActive(true);
    loadActive({ force: true });
    loadCounts();
  };

  const onRefreshArchive = () => {
    setRefreshingArchive(true);
    const statuses = archiveFilter === 'ALL' ? undefined : [archiveFilter];
    fetchArchivePage(0, statuses, archiveSearchDebounced, false);
  };

  // ═════════════════════════════════════════════════════════════════
  // Actions sur commandes (status change, bulk, etc.)
  // ═════════════════════════════════════════════════════════════════

  const refreshAfterAction = useCallback(() => {
    loadActive({ force: true, silent: true });
    loadCounts();
    if (archiveLoaded && tab === 'archive') {
      const statuses = archiveFilter === 'ALL' ? undefined : [archiveFilter];
      fetchArchivePage(0, statuses, archiveSearchDebounced, false);
    }
  }, [loadActive, loadCounts, archiveLoaded, tab, archiveFilter, archiveSearchDebounced, fetchArchivePage]);

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      const result = await offlineService.writeOrQueue({
        domain: 'orders',
        method: 'PUT',
        endpoint: `/orders/${orderId}/status`,
        payload: { status: newStatus },
        invalidateCache: ['orders'],
        description: `Commande #${orderId} → ${newStatus}`,
      });
      if (result.online) {
        Alert.alert('✅', 'Statut mis à jour');
      } else {
        setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        Alert.alert('📦 Hors-ligne', 'Le changement sera synchronisé au retour du réseau.');
      }
      refreshAfterAction();
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const reportBatchResult = (
    successCount: number,
    failed: { orderId: number; reason: string }[],
    action: 'accept' | 'reject',
  ) => {
    const verbe = action === 'accept' ? 'acceptee(s)' : 'refusee(s)';
    if (failed.length === 0) {
      Alert.alert('✅', `${successCount} commande(s) ${verbe}.`);
      return;
    }
    if (successCount === 0) {
      const lines = failed.map(f => `• #${f.orderId} : ${f.reason}`).join('\n');
      Alert.alert('Aucune commande traitee', lines);
      return;
    }
    const lines = failed.map(f => `• #${f.orderId} : ${f.reason}`).join('\n');
    Alert.alert(
      `${successCount} ${verbe}, ${failed.length} echec(s)`,
      lines + '\n\nLes autres commandes sont passees correctement.',
    );
  };

  const handleBatchAccept = () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;
    Alert.alert(
      'Accepter les commandes',
      `Accepter ${ids.length} commande(s) ? Les clients seront notifies.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            try {
              setBatchProcessing(true);
              const result = await orderService.acceptBatch(ids);
              reportBatchResult(result.accepted.length, result.failed, 'accept');
              exitSelectionMode();
              refreshAfterAction();
            } catch (err: any) {
              Alert.alert('Erreur', String(err));
            } finally {
              setBatchProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleBatchReject = () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;
    Alert.alert(
      'Refuser les commandes',
      `Refuser ${ids.length} commande(s) ? Cette action est definitive et les clients seront notifies.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              setBatchProcessing(true);
              const result = await orderService.rejectBatch(ids);
              reportBatchResult(result.rejected.length, result.failed, 'reject');
              exitSelectionMode();
              refreshAfterAction();
            } catch (err: any) {
              Alert.alert('Erreur', String(err));
            } finally {
              setBatchProcessing(false);
            }
          },
        },
      ]
    );
  };

  // ═════════════════════════════════════════════════════════════════
  // Helpers
  // ═════════════════════════════════════════════════════════════════

  const formatRelativeUpdate = (): string => {
    if (!lastUpdatedAt) return '...';
    void updatedTick;
    const sec = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
    if (sec < 5) return 'À l\'instant';
    if (sec < 60) return `il y a ${sec}s`;
    return `il y a ${Math.floor(sec / 60)} min`;
  };

  const pendingActive = activeOrders.filter(o => o.status === 'PENDING');

  // ═════════════════════════════════════════════════════════════════
  // Render : carte de commande (commune active + archive)
  // ═════════════════════════════════════════════════════════════════

  const renderOrder = ({ item }: { item: OrderListItem }) => {
    const isPending = item.status === 'PENDING';
    const isSelected = selectedOrderIds.has(item.id);
    const isActiveTab = tab === 'active';
    const handleCardPress = () => {
      if (selectionMode && isPending && isActiveTab) {
        toggleOrderSelection(item.id);
      } else {
        router.push(`/details-commande?orderId=${item.id}` as any);
      }
    };
    const handleCardLongPress = () => {
      if (!selectionMode && isPending && isActiveTab) {
        enterSelectionWith(item.id);
      }
    };

    return (
      <View style={[styles.orderCard, isSelected && cardSelectionStyles.selected]}>
        <TouchableOpacity
          onPress={handleCardPress}
          onLongPress={handleCardLongPress}
          delayLongPress={350}
          style={styles.orderContent}
        >
          <View style={styles.orderHeader}>
            {selectionMode && isPending && isActiveTab && (
              <View style={cardSelectionStyles.checkboxBox}>
                <MaterialIcons
                  name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                  size={26}
                  color={isSelected ? '#4CAF50' : '#9ca3af'}
                />
              </View>
            )}
            <View style={styles.orderInfo}>
              <Text style={styles.orderClient}>👤 {item.clientNom || '—'}</Text>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleString('fr-FR')}
              </Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderTotal}>{formatPrice(item.total, item.currency)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.orderDetails}>
            <Text style={styles.detailRow}>📦 {item.nombreItems} article(s)</Text>
            {item.adresseLivraison && (
              <Text style={styles.detailRow}>📍 {item.adresseLivraison}</Text>
            )}
            {item.telephoneLivraison && (
              <Text style={styles.detailRow}>📞 {item.telephoneLivraison}</Text>
            )}
            {item.livreurNom && (
              <Text style={styles.detailRow}>🚚 {item.livreurNom}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Quick actions uniquement sur la tab active (l'archive est en lecture seule). */}
        {isActiveTab && (
          <View style={styles.cardFooter}>
            {item.status === 'PENDING' && !selectionMode && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.acceptBtn]}
                  onPress={() => handleUpdateStatus(item.id, 'ACCEPTED')}
                >
                  <Text style={styles.quickBtnText}>✅ Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.rejectBtn]}
                  onPress={() => handleUpdateStatus(item.id, 'CANCELLED')}
                >
                  <Text style={styles.quickBtnText}>❌ Refuser</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.status === 'ACCEPTED' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.prepareBtn]}
                  onPress={() => router.push(`/preparer-commande?orderId=${item.id}` as any)}
                >
                  <Text style={styles.quickBtnText}>👨‍🍳 Préparer</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.status === 'PREPARING' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.prepareBtn]}
                  onPress={() => router.push(`/preparer-commande?orderId=${item.id}` as any)}
                >
                  <Text style={styles.quickBtnText}>👨‍🍳 Continuer</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.status === 'READY' && (
              <View style={styles.quickActions}>
                <TouchableOpacity style={[styles.quickBtn, styles.infoBtn]} disabled={true}>
                  <Text style={styles.quickBtnText}>✅ Commande Prête</Text>
                </TouchableOpacity>
                {item.deliveryType === 'PICKUP' ? (
                  <TouchableOpacity
                    style={[styles.quickBtn, styles.scanBtn]}
                    onPress={() => router.push('/(epicier)/scan-qr')}
                  >
                    <MaterialCommunityIcons name="qrcode-scan" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.quickBtnText}>Scanner QR</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.readyText}>En attente de livreur</Text>
                )}
              </View>
            )}
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => router.push(`/details-commande?orderId=${item.id}` as any)}
            >
              <MaterialIcons name="arrow-forward" size={18} color="#2196F3" />
              <Text style={styles.detailsBtnText}>Détails</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Archive : carte cliquable, footer minimal avec juste "Détails" */}
        {!isActiveTab && (
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => router.push(`/details-commande?orderId=${item.id}` as any)}
            >
              <MaterialIcons name="arrow-forward" size={18} color="#2196F3" />
              <Text style={styles.detailsBtnText}>Détails</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ═════════════════════════════════════════════════════════════════
  // Render principal
  // ═════════════════════════════════════════════════════════════════

  if (loadingActive && activeOrders.length === 0 && tab === 'active') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* FAB scanner QR */}
      <TouchableOpacity
        style={styles.scanFab}
        onPress={() => router.push('/(epicier)/scan-qr')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="qrcode-scan" size={26} color="#fff" />
      </TouchableOpacity>

      {/* FAB vente directe */}
      <TouchableOpacity
        style={styles.posFab}
        onPress={() => router.push('/(epicier)/vente-directe')}
        activeOpacity={0.85}
      >
        <Text style={styles.posFabText}>🛒</Text>
      </TouchableOpacity>

      {/* Live bar uniquement sur la tab active */}
      {tab === 'active' && (
        <TouchableOpacity
          onPress={() => {
            setHasNewOrders(false);
            loadActive({ force: true });
            loadCounts();
          }}
          style={liveStyles.bar}
          activeOpacity={0.7}
        >
          <View style={[
            liveStyles.dot,
            hasNewOrders ? liveStyles.dotAlert : liveStyles.dotLive,
          ]} />
          <Text style={liveStyles.label}>
            {hasNewOrders
              ? 'Nouvelles commandes ! Tapez pour rafraichir.'
              : `Mis à jour ${formatRelativeUpdate()}`}
          </Text>
          <Text style={liveStyles.hint}>↻</Text>
        </TouchableOpacity>
      )}

      {/* Top tabs : En cours / Historique */}
      <View style={topTabStyles.container}>
        <TouchableOpacity
          style={[topTabStyles.tab, tab === 'active' && topTabStyles.tabActive]}
          onPress={() => onSwitchTab('active')}
        >
          <Text style={[topTabStyles.text, tab === 'active' && topTabStyles.textActive]}>
            🛍️ En cours
          </Text>
          {counts.active > 0 && (
            <View style={[topTabStyles.badge, tab === 'active' && topTabStyles.badgeActive]}>
              <Text style={[topTabStyles.badgeText, tab === 'active' && topTabStyles.badgeTextActive]}>
                {counts.active}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[topTabStyles.tab, tab === 'archive' && topTabStyles.tabActive]}
          onPress={() => onSwitchTab('archive')}
        >
          <Text style={[topTabStyles.text, tab === 'archive' && topTabStyles.textActive]}>
            📜 Historique
          </Text>
          {(counts.delivered + counts.cancelled) > 0 && (
            <View style={[topTabStyles.badge, tab === 'archive' && topTabStyles.badgeActive]}>
              <Text style={[topTabStyles.badgeText, tab === 'archive' && topTabStyles.badgeTextActive]}>
                {counts.delivered + counts.cancelled}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tab ACTIVE ────────────────────────────────────────────── */}
      {tab === 'active' && (
        <>
          {/* Bandeau de sélection */}
          {selectionMode && (
            <View style={selectionStyles.banner}>
              <TouchableOpacity onPress={exitSelectionMode} style={selectionStyles.cancelBtn}>
                <MaterialIcons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={selectionStyles.counter}>
                {selectedOrderIds.size} sur {pendingActive.length} sélectionnée(s)
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (selectedOrderIds.size === pendingActive.length) {
                    setSelectedOrderIds(new Set());
                  } else {
                    setSelectedOrderIds(new Set(pendingActive.map(o => o.id)));
                  }
                }}
                style={selectionStyles.allBtn}
              >
                <Text style={selectionStyles.allBtnText}>
                  {selectedOrderIds.size === pendingActive.length && pendingActive.length > 0
                    ? 'Aucune'
                    : 'Tout'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={activeOrders}
            renderItem={renderOrder}
            keyExtractor={(item) => `active-${item.id}`}
            contentContainerStyle={[
              styles.list,
              selectionMode && { paddingBottom: 100 },
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshingActive} onRefresh={onRefreshActive} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📦</Text>
                <Text style={styles.emptyText}>Aucune commande en cours</Text>
                <Text style={styles.emptySubtext}>
                  Les nouvelles commandes apparaîtront ici automatiquement.
                </Text>
              </View>
            }
          />

          {selectionMode && selectedOrderIds.size > 0 && (
            <View style={selectionStyles.fabContainer}>
              <TouchableOpacity
                style={[selectionStyles.fabBtn, selectionStyles.fabReject]}
                onPress={handleBatchReject}
                disabled={batchProcessing}
                activeOpacity={0.85}
              >
                {batchProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={selectionStyles.fabText}>
                    ❌ Refuser ({selectedOrderIds.size})
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[selectionStyles.fabBtn, selectionStyles.fabAccept]}
                onPress={handleBatchAccept}
                disabled={batchProcessing}
                activeOpacity={0.85}
              >
                {batchProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={selectionStyles.fabText}>
                    ✅ Accepter ({selectedOrderIds.size})
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── Tab ARCHIVE ───────────────────────────────────────────── */}
      {tab === 'archive' && (
        <>
          {/* Sous-filtres + recherche */}
          <View style={archiveStyles.filterBar}>
            <View style={archiveStyles.filterRow}>
              <TouchableOpacity
                style={[archiveStyles.filterBtn, archiveFilter === 'ALL' && archiveStyles.filterBtnActive]}
                onPress={() => setArchiveFilter('ALL')}
              >
                <Text style={[archiveStyles.filterText, archiveFilter === 'ALL' && archiveStyles.filterTextActive]}>
                  Toutes ({counts.delivered + counts.cancelled})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[archiveStyles.filterBtn, archiveFilter === 'DELIVERED' && archiveStyles.filterBtnActive]}
                onPress={() => setArchiveFilter('DELIVERED')}
              >
                <Text style={[archiveStyles.filterText, archiveFilter === 'DELIVERED' && archiveStyles.filterTextActive]}>
                  Livrées ({counts.delivered})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[archiveStyles.filterBtn, archiveFilter === 'CANCELLED' && archiveStyles.filterBtnActive]}
                onPress={() => setArchiveFilter('CANCELLED')}
              >
                <Text style={[archiveStyles.filterText, archiveFilter === 'CANCELLED' && archiveStyles.filterTextActive]}>
                  Annulées ({counts.cancelled})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={archiveStyles.searchBox}>
              <MaterialIcons name="search" size={18} color="#9ca3af" />
              <TextInput
                style={archiveStyles.searchInput}
                placeholder="Client, N° commande..."
                placeholderTextColor="#9ca3af"
                value={archiveSearchInput}
                onChangeText={setArchiveSearchInput}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {archiveSearchInput.length > 0 && (
                <TouchableOpacity onPress={() => setArchiveSearchInput('')}>
                  <MaterialIcons name="close" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={archiveOrders}
            renderItem={renderOrder}
            keyExtractor={(item) => `archive-${item.id}`}
            contentContainerStyle={styles.list}
            onEndReached={onArchiveEndReached}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl refreshing={refreshingArchive} onRefresh={onRefreshArchive} />
            }
            ListEmptyComponent={
              !archiveLoading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>📜</Text>
                  <Text style={styles.emptyText}>
                    {archiveSearchDebounced ? 'Aucun résultat' : 'Aucune commande archivée'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {archiveSearchDebounced
                      ? `Pour « ${archiveSearchDebounced} »`
                      : 'Les commandes livrées et annulées apparaîtront ici.'}
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              <View style={archiveStyles.footer}>
                {archiveLoading && (
                  <ActivityIndicator size="small" color="#2196F3" />
                )}
                {!archiveLoading && archiveLast && archiveOrders.length > 0 && (
                  <Text style={archiveStyles.footerEnd}>
                    ✓ Fin de l'historique ({archiveTotalElements} commande{archiveTotalElements !== 1 ? 's' : ''})
                  </Text>
                )}
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

// ── Styles : Top tabs ────────────────────────────────────────────────────
const topTabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -2,
  },
  tabActive: {
    borderBottomColor: '#2196F3',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  textActive: {
    color: '#2196F3',
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#2196F3',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  badgeTextActive: {
    color: '#fff',
  },
});

// ── Styles : Archive ────────────────────────────────────────────────────
const archiveStyles = StyleSheet.create({
  filterBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterTextActive: {
    color: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerEnd: {
    fontSize: 13,
    color: '#9ca3af',
  },
});

// ── Styles : Mode selection (bandeau + checkboxes + FAB) ─────────────────
const cardSelectionStyles = StyleSheet.create({
  selected: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f2',
  },
  checkboxBox: {
    marginRight: 8,
    justifyContent: 'center',
  },
});

const selectionStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  cancelBtn: { padding: 4 },
  counter: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  allBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
  },
  allBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  fabContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    flexDirection: 'row',
    gap: 10,
  },
  fabBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  fabAccept: { backgroundColor: '#4CAF50' },
  fabReject: { backgroundColor: '#F44336' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Styles : Live bar ──────────────────────────────────────────────────
const liveStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
  },
  dotLive: { backgroundColor: '#4CAF50' },
  dotAlert: { backgroundColor: '#F44336' },
  label: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  hint: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '700',
  },
});

// ── Styles : carte commande (réutilisé de l'ancien fichier) ─────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scanFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  posFab: {
    position: 'absolute',
    bottom: 94,
    right: 20,
    zIndex: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  posFabText: {
    fontSize: 26,
  },
  list: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderContent: {
    padding: 15,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  orderDetails: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  quickBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#4CAF50',
  },
  prepareBtn: {
    backgroundColor: '#2196F3',
  },
  rejectBtn: {
    backgroundColor: '#f44336',
  },
  infoBtn: {
    backgroundColor: '#2196F3',
    opacity: 0.7,
  },
  scanBtn: {
    backgroundColor: '#7B1FA2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  readyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  detailsBtnText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
