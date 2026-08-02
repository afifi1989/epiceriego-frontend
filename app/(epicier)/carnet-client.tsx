export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Carnet Digital (الكرني) — Écran unifié de gestion client
 *
 * Remplace les 4 anciens écrans (détail client, crédit, avance, factures)
 * par une seule vue avec :
 * - En-tête client + solde
 * - 3 boutons d'action rapide (Encaisser, Avance, Crédit)
 * - Résumé financier (4 cartes)
 * - Timeline chronologique des transactions
 * - Alertes intelligentes (factures en retard, limite crédit)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../src/constants/config';
import { usePermissions } from '../../src/hooks/usePermissions';
import { LoginResponse } from '../../src/type';
import { useCarnet } from '../../src/features/carnet/hooks/useCarnet';
import { ALERT_CONFIG, CarnetAlert } from '../../src/features/carnet/types';
import { CarnetHeader } from '../../src/features/carnet/components/CarnetHeader';
import { CarnetSummary } from '../../src/features/carnet/components/CarnetSummary';
import { CarnetTimeline } from '../../src/features/carnet/components/CarnetTimeline';
import { QuickPaymentModal } from '../../src/features/carnet/components/QuickPaymentModal';
import { QuickAdvanceModal } from '../../src/features/carnet/components/QuickAdvanceModal';
import { CreditSettingsModal } from '../../src/features/carnet/components/CreditSettingsModal';
import { loyaltyService, LoyaltyBalance } from '../../src/services/loyaltyService';
import { orderService } from '../../src/services/orderService';
import { epicerieService } from '../../src/services/epicerieService';
import { Order, SpringPage } from '../../src/type';
import { formatPrice, getStatusColor } from '../../src/utils/helpers';
import { useLanguage } from '../../src/context/LanguageContext';

const BLUE = Colors.primary;

export default function CarnetScreen() {
  const router = useRouter();
  const { id, clientName: clientNameParam, archived } = useLocalSearchParams<{ id: string; clientName?: string; archived?: string }>();
  const clientId = parseInt(id ?? '0', 10);
  // Dossier ouvert depuis la liste des clients ARCHIVÉS → LECTURE SEULE :
  // toutes les actions (Encaisser, Avance, Crédit, Modifier, relance) sont
  // masquées ; seul l'historique reste consultable.
  // Le param de route `archived=1` déclenche la lecture seule immédiatement
  // (transition fluide depuis l'onglet Archivés), mais un client archivé
  // atteint par un AUTRE chemin (scan QR, détail commande) n'a pas ce param :
  // on complète donc avec `relationStatus === 'ARCHIVED'` renvoyé dans le
  // payload carnet, disponible une fois les données chargées.
  const archivedParam = archived === '1' || archived === 'true';
  // Titre instantané pendant le chargement (avant que le carnet ne soit chargé),
  // passé par l'appelant (scan carte / détail commande) pour une transition fluide.
  const initialClientName = typeof clientNameParam === 'string' ? clientNameParam : undefined;

  const [epicerieId, setEpicerieId] = useState<number>(0);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const { can } = usePermissions(loginData);
  const canManageCredit = can('clients:credit');

  // Charger epicerieId + loginData
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) {
        const user = JSON.parse(raw);
        setLoginData(user);
        setEpicerieId(user.epicerieId ?? 0);
      }
    });
  }, []);

  // Hook carnet
  const { carnet, loading, refreshing, error, isStale, loadMore, hasMore, refresh } = useCarnet({
    epicerieId,
    clientId,
    enabled: epicerieId > 0 && clientId > 0,
  });

  // Lecture seule : param de route OU statut de relation ARCHIVED renvoyé par
  // le backend. Se réévalue après le fetch (carnet chargé) → pas figé avant
  // la réponse : un client archivé atteint sans le param bascule en lecture
  // seule dès que `relationStatus` est disponible.
  const isReadOnly = archivedParam || carnet?.relationStatus === 'ARCHIVED';

  // Loyalty
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);

  useEffect(() => {
    if (clientId > 0) {
      loyaltyService.getClientBalance(clientId)
        .then(setLoyaltyBalance)
        .catch(() => setLoyaltyBalance(null));
    }
  }, [clientId]);

  // ── Nom de la carte de fidélité de l'épicerie (branding perso) ─────
  // Affiché en chip dans la section Commandes pour que l'épicier voie
  // quelle carte concerne ce client. Fallback i18n si vide.
  const [cardName, setCardName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    epicerieService.getMyEpicerie()
      .then(e => { if (!cancelled) setCardName(e.cardName?.trim() || null); })
      .catch(() => { if (!cancelled) setCardName(null); });
    return () => { cancelled = true; };
  }, []);

  // ── Commandes du client (en cours + historique compact) ───────────
  const { t } = useLanguage();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [historyPage, setHistoryPage] = useState<SpringPage<Order> | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  // Nombre de commandes affichées dans l'historique compact. « Voir tout »
  // ouvre désormais l'écran dédié `client-commandes` (liste paginée).
  const historySize = 5;

  const loadOrders = useCallback(() => {
    if (clientId <= 0) return;
    setOrdersLoading(true);
    setOrdersError(null);
    Promise.all([
      // Un échec sur les "en cours" ne doit pas masquer l'historique.
      orderService.getEpicerieClientActiveOrders(clientId).catch(() => [] as Order[]),
      orderService.getEpicerieClientOrders(clientId, { page: 0, size: historySize }),
    ])
      .then(([active, page]) => {
        setActiveOrders(active);
        setHistoryPage(page);
      })
      .catch((e) => setOrdersError(typeof e === 'string' ? e : t('carnetOrders.loadError')))
      .finally(() => setOrdersLoading(false));
  }, [clientId, historySize, t]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Libellé de statut traduit (fallback : code brut si clé absente).
  const statusLabel = useCallback((status: string) => {
    const key = `carnetOrders.status.${status}`;
    const label = t(key);
    return label === key ? status : label;
  }, [t]);

  const openOrder = useCallback((orderId: number) => {
    router.push(`/details-commande?orderId=${orderId}` as any);
  }, [router]);

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  // ── Filtre timeline : Tout / Impayés / Récents (30j) ───────────────
  type TimelineFilter = 'ALL' | 'UNPAID' | 'RECENT';
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('ALL');

  // Plus ancienne facture (INVOICE) — sert à calculer le retard de paiement.
  const oldestUnpaidDate: string | null = useMemo(() => {
    if (!carnet || (carnet.balanceDue ?? 0) <= 0) return null;
    const invoices = carnet.transactions
      .filter(t => t.type === 'INVOICE')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return invoices[0]?.date ?? null;
  }, [carnet]);

  const daysSinceOldest: number | null = useMemo(() => {
    if (!oldestUnpaidDate) return null;
    const ms = Date.now() - new Date(oldestUnpaidDate).getTime();
    return Math.floor(ms / (24 * 3600 * 1000));
  }, [oldestUnpaidDate]);

  // Transactions filtrées pour la timeline
  const filteredTransactions = useMemo(() => {
    if (!carnet) return [];
    if (timelineFilter === 'ALL') return carnet.transactions;
    if (timelineFilter === 'RECENT') {
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      return carnet.transactions.filter(t => new Date(t.date).getTime() >= cutoff);
    }
    // UNPAID = factures INVOICE non encore couvertes (heuristique simple :
    // toutes les INVOICE ; le runningBalance permet de voir l'evolution).
    return carnet.transactions.filter(t => t.type === 'INVOICE');
  }, [carnet, timelineFilter]);

  const openWhatsApp = useCallback(() => {
    if (!carnet?.clientPhone) return;
    const phone = carnet.clientPhone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Bonjour ${carnet.clientName}, votre solde actuel est de ${carnet.balanceDue?.toFixed(2)} DH. Merci pour votre fidélité.`
    );
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`)
      .catch(() => Linking.openURL(`https://wa.me/${phone}?text=${msg}`));
  }, [carnet]);

  const handleActionSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // ── Loading ──
  if (loading && !carnet) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{initialClientName || 'Carnet client'}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error && !carnet) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carnet client</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: '#e53935', fontSize: 15 }}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={{ marginTop: 12, padding: 10 }}>
            <Text style={{ color: BLUE, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!carnet) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Barre de navigation ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carnet</Text>
        {/* Visible uniquement pour les clients virtuels — un client réel
            gère son profil lui-même depuis son app. */}
        {carnet.clientIsVirtual && !isReadOnly && (
          <TouchableOpacity
            style={styles.editVirtualBtn}
            onPress={() => router.push({
              pathname: '/(epicier)/clients/nouveau-virtuel' as any,
              params: {
                clientId: String(carnet.clientId),
                name: carnet.clientName,
                phone: carnet.clientPhone ?? '',
                email: carnet.clientEmail ?? '',
              },
            })}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {isStale && (
          <View style={styles.staleBadge}>
            <Text style={styles.staleText}>Hors-ligne</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); loadOrders(); }} colors={[BLUE]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── En-tête client ── */}
        <CarnetHeader carnet={carnet} />

        {/* ── Bandeau LECTURE SEULE (client archivé) ── */}
        {isReadOnly && (
          <View style={styles.readOnlyBanner}>
            <Ionicons name="lock-closed-outline" size={16} color="#607D8B" />
            <Text style={styles.readOnlyBannerText}>
              {t('clientsArchive.readOnlyBanner')}
            </Text>
          </View>
        )}

        {/* ── Encours epinglé : visible des qu'il y a une dette, mis en
             evidence selon l'anciennete pour faciliter la relance. ── */}
        {(carnet.balanceDue ?? 0) > 0 && (() => {
          const days = daysSinceOldest ?? 0;
          // 3 paliers : <15j = info, 15-30j = warning, >30j = critique
          const palette =
            days > 30 ? { bg: '#ffebee', border: '#d32f2f', text: '#b71c1c', label: 'EN RETARD' } :
            days > 15 ? { bg: '#fff3e0', border: '#ef6c00', text: '#e65100', label: 'À RELANCER' } :
            { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1', label: 'EN COURS' };
          return (
            <View style={[encoursStyles.card, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={encoursStyles.headerRow}>
                <View style={[encoursStyles.badge, { backgroundColor: palette.border }]}>
                  <Text style={encoursStyles.badgeText}>{palette.label}</Text>
                </View>
                {daysSinceOldest != null && daysSinceOldest > 0 && (
                  <Text style={[encoursStyles.daysText, { color: palette.text }]}>
                    {daysSinceOldest} j depuis la 1ère facture
                  </Text>
                )}
              </View>
              <Text style={[encoursStyles.amount, { color: palette.text }]}>
                {carnet.balanceDue.toFixed(2)} DH
              </Text>
              <Text style={[encoursStyles.label, { color: palette.text }]}>
                à percevoir
                {carnet.creditLimit > 0 && (
                  <Text style={{ opacity: 0.7 }}>
                    {'  ·  limite '}{carnet.creditLimit.toFixed(0)} DH
                  </Text>
                )}
              </Text>
              {carnet.clientPhone && !isReadOnly && (
                <View style={encoursStyles.actions}>
                  <TouchableOpacity
                    style={[encoursStyles.actionBtn, { backgroundColor: '#25D366' }]}
                    onPress={openWhatsApp}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text style={encoursStyles.actionBtnText}>Relancer WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[encoursStyles.actionBtn, { backgroundColor: palette.border }]}
                    onPress={() => carnet.clientPhone && Linking.openURL(`tel:${carnet.clientPhone}`)}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={encoursStyles.actionBtnText}>Appeler</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Actions rapides ── */}
        {/* Encaisser visible pour tous les profils. Avance et Crédit
            requièrent la permission `clients:credit` (caissier exclu).
            Masquées entièrement pour un client archivé (lecture seule).

            Règles métier (cohérentes avec le backend) :
            - « Encaisser » n'a de sens que s'il reste une dette : désactivé
              quand le solde dû ≤ 0 (rien à encaisser).
            - « Avance » : on ne prend un dépôt d'avance qu'une fois la dette
              soldée : désactivé tant que le solde dû > 0. */}
        {!isReadOnly && (() => {
          const balanceDue = carnet.balanceDue ?? 0;
          const canEncaisser = balanceDue > 0;
          const canAdvance = balanceDue <= 0;
          return (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGreen, !canEncaisser && styles.actionBtnDisabled]}
                onPress={() => setShowPayment(true)}
                disabled={!canEncaisser}
                accessibilityState={{ disabled: !canEncaisser }}
              >
                <Text style={styles.actionIcon}>💰</Text>
                <Text style={styles.actionLabel}>Encaisser</Text>
              </TouchableOpacity>
              {canManageCredit && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnBlue, !canAdvance && styles.actionBtnDisabled]}
                  onPress={() => setShowAdvance(true)}
                  disabled={!canAdvance}
                  accessibilityState={{ disabled: !canAdvance }}
                >
                  <Text style={styles.actionIcon}>📝</Text>
                  <Text style={styles.actionLabel}>Avance</Text>
                </TouchableOpacity>
              )}
              {canManageCredit && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPurple]} onPress={() => setShowCredit(true)}>
                  <Text style={styles.actionIcon}>⚙️</Text>
                  <Text style={styles.actionLabel}>Crédit</Text>
                </TouchableOpacity>
              )}
              {/* Info : explique quand chaque action est disponible. */}
              <TouchableOpacity
                style={styles.actionInfoBtn}
                onPress={() =>
                  Alert.alert(
                    'Règles des actions',
                    'Encaisser : disponible uniquement s’il reste un montant dû, et limité au montant des impayés (pas de trop-perçu).\n\n' +
                    'Avance : disponible uniquement quand la dette est soldée.'
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Règles des actions"
              >
                <Ionicons name="information-circle-outline" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Alertes ── */}
        {carnet.alerts.length > 0 && (
          <View style={styles.alertsSection}>
            {carnet.alerts.map((alert: CarnetAlert, idx: number) => {
              const config = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.OVERDUE;
              return (
                <View key={idx} style={[styles.alertCard, { backgroundColor: config.bgColor }]}>
                  <Text style={styles.alertIcon}>{config.icon}</Text>
                  <Text style={[styles.alertText, { color: config.color }]}>{alert.message}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Points fidélité ── */}
        {loyaltyBalance && loyaltyBalance.balance > 0 && (
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyIcon}>
              <Ionicons name="star" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyTitle}>Points fidélité</Text>
              <Text style={styles.loyaltyBalance}>{loyaltyBalance.balance} pts</Text>
            </View>
          </View>
        )}

        {/* ── Résumé financier ── */}
        <CarnetSummary carnet={carnet} />

        {/* ── Section Commandes (en cours + historique compact) ── */}
        <View style={ordersStyles.section}>
          <View style={ordersStyles.sectionHeader}>
            <Text style={ordersStyles.sectionTitle}>{t('carnetOrders.sectionTitle')}</Text>
            <View style={ordersStyles.cardChip}>
              <Ionicons name="card-outline" size={12} color={BLUE} />
              <Text style={ordersStyles.cardChipText} numberOfLines={1}>
                {cardName || t('carnetOrders.cardFallback')}
              </Text>
            </View>
          </View>

          {/* Bandeau « Commande en cours » — une carte par commande active */}
          {activeOrders.map((order) => (
            <TouchableOpacity
              key={`active-${order.id}`}
              style={ordersStyles.activeCard}
              onPress={() => openOrder(order.id)}
              activeOpacity={0.85}
            >
              <View style={ordersStyles.activeHeader}>
                <Ionicons name="time-outline" size={16} color="#e65100" />
                <Text style={ordersStyles.activeBanner}>{t('carnetOrders.activeOrder')}</Text>
              </View>
              <View style={ordersStyles.rowBetween}>
                <Text style={ordersStyles.orderRef}>
                  {t('carnetOrders.orderRef', { id: order.id })}
                </Text>
                <Text style={ordersStyles.orderAmount}>
                  {formatPrice(order.total, order.currency)}
                </Text>
              </View>
              <View style={ordersStyles.rowBetween}>
                <Text style={ordersStyles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString()}
                </Text>
                <View style={[ordersStyles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={ordersStyles.statusText}>{statusLabel(order.status)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Historique compact des dernières commandes */}
          {ordersLoading && !historyPage ? (
            <View style={ordersStyles.stateBox}>
              <ActivityIndicator color={BLUE} />
            </View>
          ) : ordersError ? (
            <View style={ordersStyles.stateBox}>
              <Text style={ordersStyles.errorText}>{ordersError}</Text>
              <TouchableOpacity onPress={loadOrders} style={{ marginTop: 8 }}>
                <Text style={{ color: BLUE, fontWeight: '700' }}>{t('screenState.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (historyPage?.content?.length ?? 0) === 0 && activeOrders.length === 0 ? (
            <View style={ordersStyles.stateBox}>
              <Text style={ordersStyles.emptyText}>{t('carnetOrders.empty')}</Text>
            </View>
          ) : (
            <>
              {(historyPage?.content ?? []).map((order) => (
                <TouchableOpacity
                  key={`hist-${order.id}`}
                  style={ordersStyles.historyRow}
                  onPress={() => openOrder(order.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={ordersStyles.historyRef}>
                      {t('carnetOrders.orderRef', { id: order.id })}
                    </Text>
                    <Text style={ordersStyles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={ordersStyles.historyRight}>
                    <Text style={ordersStyles.historyAmount}>
                      {formatPrice(order.total, order.currency)}
                    </Text>
                    <Text style={[ordersStyles.historyStatus, { color: getStatusColor(order.status) }]}>
                      {statusLabel(order.status)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* « Voir tout » : écran dédié paginé (scroll infini + filtre) */}
              {historyPage && !historyPage.last && (
                <TouchableOpacity
                  style={ordersStyles.seeAllBtn}
                  onPress={() => router.push({
                    pathname: '/(epicier)/client-commandes' as any,
                    params: { clientId: String(clientId), clientName: carnet.clientName },
                  })}
                >
                  <Text style={ordersStyles.seeAllText}>{t('carnetOrders.seeAll')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Filtres rapides timeline : Tout / Impayés / Récents (30j) ── */}
        <View style={filterChipsStyles.row}>
          {(['ALL', 'UNPAID', 'RECENT'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                filterChipsStyles.chip,
                timelineFilter === f && filterChipsStyles.chipActive,
              ]}
              onPress={() => setTimelineFilter(f)}
            >
              <Text
                style={[
                  filterChipsStyles.chipText,
                  timelineFilter === f && filterChipsStyles.chipTextActive,
                ]}
              >
                {f === 'ALL' ? 'Tout' : f === 'UNPAID' ? 'Factures' : 'Récents (30j)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Timeline ── */}
        <CarnetTimeline
          transactions={filteredTransactions}
          hasMore={hasMore && timelineFilter === 'ALL'}
          onLoadMore={loadMore}
          loading={loading}
        />

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <QuickPaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handleActionSuccess}
        epicerieId={epicerieId}
        clientId={clientId}
        clientName={carnet.clientName}
        balanceDue={carnet.balanceDue}
      />

      <QuickAdvanceModal
        visible={showAdvance}
        onClose={() => setShowAdvance(false)}
        onSuccess={handleActionSuccess}
        epicerieId={epicerieId}
        clientId={clientId}
        clientName={carnet.clientName}
      />

      <CreditSettingsModal
        visible={showCredit}
        onClose={() => setShowCredit(false)}
        onSuccess={handleActionSuccess}
        epicerieId={epicerieId}
        clientId={clientId}
        clientName={carnet.clientName}
        currentAllowCredit={carnet.allowCredit}
        currentCreditLimit={carnet.creditLimit}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BLUE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' },
  body: { flex: 1, backgroundColor: '#f5f7fa' },

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
  staleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  staleText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  editVirtualBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Bandeau lecture seule (client archivé)
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#eceff1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfd8dc',
  },
  readOnlyBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#546e7a',
  },

  // Actions rapides
  actionsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  actionBtnGreen: { backgroundColor: '#e8f5e9' },
  actionBtnBlue: { backgroundColor: '#e3f2fd' },
  actionBtnPurple: { backgroundColor: '#f3e5f5' },
  // Bouton grisé : action non applicable dans l'état courant du solde.
  actionBtnDisabled: { opacity: 0.4 },
  // Bouton info « i » aligné avec la barre d'actions.
  actionInfoBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: '#333' },

  // Alertes
  alertsSection: { paddingHorizontal: 12, gap: 6 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10,
  },
  alertIcon: { fontSize: 16 },
  alertText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Loyalty
  loyaltyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginBottom: 10,
    backgroundColor: '#fff8e1', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#ffe082',
  },
  loyaltyIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FF9800',
    alignItems: 'center', justifyContent: 'center',
  },
  loyaltyTitle: { fontSize: 12, color: '#e65100', fontWeight: '600' },
  loyaltyBalance: { fontSize: 20, fontWeight: '900', color: '#e65100' },
});

// Carte "Encours" epinglée en haut quand balanceDue > 0.
const encoursStyles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  daysText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amount: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

// Section « Commandes » (bandeau en cours + historique compact).
const ordersStyles = StyleSheet.create({
  section: {
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '55%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  cardChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: BLUE,
    flexShrink: 1,
  },
  // Bandeau « Commande en cours »
  activeCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffcc80',
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeBanner: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e65100',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderRef: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1f2937',
  },
  orderDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  // Historique compact
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eceff1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  historyRef: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f2937',
  },
  historyStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  seeAllBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  seeAllText: {
    color: BLUE,
    fontWeight: '800',
    fontSize: 13,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: '#e53935',
    textAlign: 'center',
  },
});

// Chips de filtre pour la timeline.
const filterChipsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: '#1976D2',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  chipTextActive: {
    color: '#fff',
  },
});
