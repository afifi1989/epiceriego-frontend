export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenState } from '../../src/components/shared/ScreenState';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  clientAccountService,
  MyStatement,
  StatementEntry,
} from '../../src/services/clientAccountService';
import { Theme, useTheme } from '../../src/theme';
import { formatPrice } from '../../src/utils/helpers';

const PAGE_SIZE = 20;

/**
 * Relevé de compte — les écritures du carnet chez une épicerie, présentées
 * comme un relevé bancaire.
 *
 * <p>Chaque opération est une écriture : achat (débit), avance déposée
 * (crédit), paiement (crédit), gain fidélité / cashback (crédit),
 * remboursement d'avance (débit) — avec le solde du compte APRÈS chaque
 * écriture. Les données viennent du ledger serveur (le même que celui de
 * l'épicier) : aucune divergence de chiffres possible.</p>
 *
 * <p>Sécurité : endpoint self-service `/clients/me/...` — l'identité vient
 * du JWT, l'app n'envoie jamais d'identifiant client.</p>
 */
export default function CarnetReleveScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const params = useLocalSearchParams<{ epicerieId?: string; epicerieName?: string }>();
  const epicerieId = Number(params.epicerieId);

  const [statement, setStatement] = useState<MyStatement | null>(null);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      if (!Number.isFinite(epicerieId)) {
        setError(true);
        setLoading(false);
        return;
      }
      try {
        if (pageToLoad === 0) setError(false);
        const data = await clientAccountService.getMyStatement(
          epicerieId, pageToLoad, PAGE_SIZE);
        setStatement(data);
        setPage(pageToLoad);
        setEntries(prev =>
          replace ? data.transactions : [...prev, ...data.transactions]);
      } catch (e: any) {
        console.error('[CarnetReleve] load failed:', e?.message || e);
        if (pageToLoad === 0) setError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [epicerieId]
  );

  useEffect(() => {
    loadPage(0, true);
  }, [loadPage]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPage(0, true);
  };

  const onLoadMore = () => {
    if (loadingMore || !statement) return;
    if (page + 1 >= statement.totalPages) return;
    setLoadingMore(true);
    loadPage(page + 1, false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  if (error && entries.length === 0) {
    return <ScreenState variant="error" onRetry={() => loadPage(0, true)} />;
  }

  // Solde « bancaire » affiché au client : avances − dette (inversion de la
  // convention carnet où balanceDue positif = dette).
  const bankBalance = -(statement?.balanceDue ?? 0);
  const inMyFavor = bankBalance >= 0;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.header}>
          {params.epicerieName ? (
            <Text style={styles.storeName} numberOfLines={1}>
              {params.epicerieName}
            </Text>
          ) : null}
          <Text style={styles.balanceLabel}>{t('carnet.balance')}</Text>
          <Text style={[styles.balanceValue, { color: inMyFavor ? '#16a34a' : '#dc2626' }]}>
            {formatPrice(Math.abs(bankBalance))}
          </Text>
          <Text style={styles.balanceHint}>
            {inMyFavor ? t('carnet.inMyFavor') : t('carnet.iOwe')}
          </Text>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>{t('carnet.dette')}</Text>
              <Text style={styles.headerStatValue}>
                {formatPrice(statement?.totalDebt ?? 0)}
              </Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>{t('carnet.avances')}</Text>
              <Text style={styles.headerStatValue}>
                {formatPrice(statement?.totalAdvances ?? 0)}
              </Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>{t('carnet.totalPurchases')}</Text>
              <Text style={styles.headerStatValue}>
                {formatPrice(statement?.totalPurchases ?? 0)}
              </Text>
            </View>
          </View>
          {statement?.relationStatus === 'ARCHIVED' ? (
            <View style={styles.archivedBanner}>
              <Ionicons name="lock-closed-outline" size={14} color="#6b7280" />
              <Text style={styles.archivedBannerText}>{t('carnet.archivedReadOnly')}</Text>
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>{t('carnet.statementTitle')}</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🧾</Text>
          <Text style={styles.emptyText}>{t('carnet.emptyStatement')}</Text>
        </View>
      }
      ListFooterComponent={
        statement && page + 1 < statement.totalPages ? (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={onLoadMore}
            disabled={loadingMore}
            accessibilityRole="button"
            accessibilityLabel={t('carnet.loadMore')}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.colors.brand} />
            ) : (
              <Text style={[styles.loadMoreText, { color: theme.colors.brand }]}>
                {t('carnet.loadMore')}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ height: 24 }} />
        )
      }
      renderItem={({ item }) => <EntryRow entry={item} theme={theme} t={t} />}
    />
  );
}

// ──────────────────────────────────────────────────────────────────
// EntryRow — une écriture du relevé
// ──────────────────────────────────────────────────────────────────

/** Visuel par type d'écriture (icône, couleur, libellé i18n). */
const ENTRY_VISUALS: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; labelKey: string }
> = {
  INVOICE: { icon: 'cart-outline', color: '#dc2626', labelKey: 'carnet.purchase' },
  PAYMENT: { icon: 'checkmark-circle-outline', color: '#16a34a', labelKey: 'carnet.paymentEntry' },
  ADVANCE: { icon: 'wallet-outline', color: '#0ea5e9', labelKey: 'carnet.advanceDeposit' },
  REFUND: { icon: 'arrow-undo-outline', color: '#f59e0b', labelKey: 'carnet.refundEntry' },
  CASHBACK: { icon: 'gift-outline', color: '#9333ea', labelKey: 'carnet.cashbackEntry' },
};

const EntryRow: React.FC<{
  entry: StatementEntry;
  theme: Theme;
  t: (key: string) => string;
}> = ({ entry, theme, t }) => {
  const styles = makeStyles(theme);
  const visual = ENTRY_VISUALS[entry.type] ?? {
    icon: 'document-text-outline' as const,
    color: '#71717a',
    labelKey: 'carnet.statementTitle',
  };
  const isDebit = (entry.debit || 0) > 0;
  const amount = isDebit ? entry.debit : entry.credit;
  // Solde courant côté client : inversion de la convention carnet.
  const runningBank = -(entry.runningBalance ?? 0);

  const date = entry.date ? new Date(entry.date) : null;
  const dateLabel = date
    ? `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <View style={styles.entryRow}>
      <View style={[styles.entryIcon, { backgroundColor: visual.color + '18' }]}>
        <Ionicons name={visual.icon} size={18} color={visual.color} />
      </View>
      <View style={styles.entryBody}>
        <Text style={styles.entryTitle} numberOfLines={1}>
          {t(visual.labelKey)}
        </Text>
        <Text style={styles.entryDesc} numberOfLines={1}>
          {entry.description}
        </Text>
        <Text style={styles.entryDate}>{dateLabel}</Text>
      </View>
      <View style={styles.entryAmounts}>
        <Text style={[styles.entryAmount, { color: isDebit ? '#dc2626' : '#16a34a' }]}>
          {isDebit ? '−' : '+'}{formatPrice(amount || 0)}
        </Text>
        <Text style={styles.entryRunning}>
          {t('carnet.runningBalance')} {runningBank >= 0 ? '' : '−'}
          {formatPrice(Math.abs(runningBank))}
        </Text>
      </View>
    </View>
  );
};

// ──────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F7F7F8',
    },
    content: {
      paddingBottom: 24,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F7F7F8',
    },
    // ── Header ────────────────────────────────────────────
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    storeName: {
      fontSize: 16,
      fontWeight: '800',
      color: '#18181b',
      marginBottom: 10,
    },
    balanceLabel: {
      fontSize: 12,
      color: '#71717a',
      fontWeight: '600',
    },
    balanceValue: {
      fontSize: 30,
      fontWeight: '800',
      marginTop: 2,
    },
    balanceHint: {
      fontSize: 12,
      color: '#a1a1aa',
      marginTop: 2,
      marginBottom: 12,
    },
    headerStats: {
      flexDirection: 'row',
      backgroundColor: '#fff',
      borderRadius: 12,
      paddingVertical: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    headerStat: {
      flex: 1,
      alignItems: 'center',
    },
    headerStatDivider: {
      width: 1,
      backgroundColor: '#e5e7eb',
    },
    headerStatLabel: {
      fontSize: 10.5,
      color: '#71717a',
      fontWeight: '600',
      marginBottom: 3,
    },
    headerStatValue: {
      fontSize: 13.5,
      fontWeight: '800',
      color: '#18181b',
    },
    archivedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 12,
    },
    archivedBannerText: {
      fontSize: 12,
      color: '#6b7280',
      fontWeight: '600',
      flex: 1,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#52525b',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // ── Entry ────────────────────────────────────────────
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    entryIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryBody: {
      flex: 1,
    },
    entryTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: '#18181b',
    },
    entryDesc: {
      fontSize: 11.5,
      color: '#71717a',
      marginTop: 1,
    },
    entryDate: {
      fontSize: 10.5,
      color: '#a1a1aa',
      marginTop: 2,
    },
    entryAmounts: {
      alignItems: 'flex-end',
    },
    entryAmount: {
      fontSize: 14,
      fontWeight: '800',
    },
    entryRunning: {
      fontSize: 10,
      color: '#a1a1aa',
      marginTop: 3,
    },
    // ── Empty / footer ───────────────────────────────────
    emptyBox: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyEmoji: {
      fontSize: 44,
      marginBottom: 10,
    },
    emptyText: {
      fontSize: 13,
      color: '#71717a',
    },
    loadMoreBtn: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    loadMoreText: {
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
