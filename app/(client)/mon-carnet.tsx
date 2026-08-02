export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenState } from '../../src/components/shared/ScreenState';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  clientAccountService,
  MyEpicerieAccount,
} from '../../src/services/clientAccountService';
import { Theme, useTheme } from '../../src/theme';
import { formatPrice } from '../../src/utils/helpers';

/**
 * Page "Mon carnet" — le compte du client chez chaque épicerie, géré comme
 * un compte bancaire.
 *
 * <p>Pour chaque épicerie : le SOLDE du compte (avances nettes − dette,
 * positif = en ma faveur), la dette, les avances déposées, l'argent gagné
 * via la fidélité (cashback), et le crédit disponible. Tap → relevé
 * d'écritures complet (achats, avances, paiements, gains fidélité) avec
 * solde courant, comme un relevé bancaire.</p>
 *
 * <p>Un SEUL appel réseau (`/clients/me/accounts`) — remplace l'ancienne
 * cascade relations + avances + N×(épicerie + crédit). Les identifiants
 * sont dérivés du JWT côté serveur : aucune donnée d'un autre client ne
 * peut être consultée.</p>
 */
export default function MonCarnetScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [accounts, setAccounts] = useState<MyEpicerieAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await clientAccountService.getMyAccounts();
      // Actifs d'abord (solde décroissant), archivés en fin de liste.
      data.sort((a, b) => {
        if (a.relationStatus !== b.relationStatus) {
          return a.relationStatus === 'ARCHIVED' ? 1 : -1;
        }
        return (b.accountBalance || 0) - (a.accountBalance || 0);
      });
      setAccounts(data);
    } catch (e: any) {
      console.error('[MonCarnet] load failed:', e?.message || e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAccounts();
  };

  // Totaux du header — calculés localement à partir des comptes.
  const totalMoney = accounts.reduce(
    (s, a) => s + Math.max(0, a.accountBalance || 0), 0);
  const totalDebt = accounts.reduce((s, a) => s + (a.totalDebt || 0), 0);
  const totalCashback = accounts.reduce(
    (s, a) => s + (a.totalCashbackEarned || 0), 0);

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  // ── Erreur réseau (aucune donnée chargée) ────────────────────────
  if (error && accounts.length === 0) {
    return <ScreenState variant="error" onRetry={loadAccounts} />;
  }

  // ── Empty ────────────────────────────────────────────────────────
  if (accounts.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.emptyEmoji}>📒</Text>
        <Text style={styles.emptyTitle}>{t('carnet.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('carnet.emptySubtitle')}</Text>
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: theme.colors.brand }]}
          onPress={() => router.push('/(client)/epiceries')}
        >
          <Text style={styles.emptyButtonText}>{t('carnet.discoverStores')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Liste ────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Résumé global — comme l'entête d'un relevé bancaire */}
      <View style={styles.summary}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>{t('carnet.myMoney')}</Text>
          <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
            {formatPrice(totalMoney)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>{t('carnet.totalDette')}</Text>
          <Text style={[styles.summaryValue, { color: totalDebt > 0 ? '#dc2626' : '#52525b' }]}>
            {formatPrice(totalDebt)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>{t('carnet.fidelityEarned')}</Text>
          <Text style={[styles.summaryValue, { color: '#9333ea' }]}>
            {formatPrice(totalCashback)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('carnet.myStores')}</Text>

      {accounts.map((account) => (
        <AccountCard
          key={account.epicerieId}
          account={account}
          onPress={() =>
            router.push({
              pathname: '/(client)/carnet-releve',
              params: {
                epicerieId: account.epicerieId.toString(),
                epicerieName: account.epicerieName,
              },
            })
          }
          theme={theme}
          t={t}
        />
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ──────────────────────────────────────────────────────────────────
// AccountCard — le compte chez une épicerie, façon compte bancaire
// ──────────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: MyEpicerieAccount;
  onPress: () => void;
  theme: Theme;
  t: (key: string) => string;
}

const AccountCard: React.FC<AccountCardProps> = ({ account, onPress, theme, t }) => {
  const styles = makeStyles(theme);
  const archived = account.relationStatus === 'ARCHIVED';
  const balance = account.accountBalance || 0;
  const inMyFavor = balance >= 0;

  return (
    <TouchableOpacity
      style={[styles.card, archived && styles.cardArchived]}
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${account.epicerieName} — ${t('carnet.balance')} ${formatPrice(balance)}`}
    >
      {/* Bandeau supérieur : logo + nom + statut */}
      <View style={styles.cardTop}>
        {account.epiceriePhotoUrl ? (
          <ExpoImage
            source={{ uri: account.epiceriePhotoUrl }}
            style={styles.cardLogo}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.cardLogo, styles.cardLogoFallback]}>
            <Text style={styles.cardLogoEmoji}>🏪</Text>
          </View>
        )}
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {account.epicerieName}
          </Text>
          {account.epicerieAddress ? (
            <Text style={styles.cardAddress} numberOfLines={1}>
              📍 {account.epicerieAddress}
            </Text>
          ) : null}
        </View>
        {archived ? (
          <View style={[styles.statusPill, { backgroundColor: '#9ca3af20' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#9ca3af' }]} />
            <Text style={[styles.statusText, { color: '#6b7280' }]}>
              {t('carnet.archived')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Solde du compte — la ligne maîtresse du relevé */}
      <View style={styles.balanceBlock}>
        <View>
          <Text style={styles.balanceLabel}>{t('carnet.balance')}</Text>
          <Text style={styles.balanceHint}>
            {inMyFavor ? t('carnet.inMyFavor') : t('carnet.iOwe')}
          </Text>
        </View>
        <Text
          style={[
            styles.balanceValue,
            { color: inMyFavor ? '#16a34a' : '#dc2626' },
          ]}
        >
          {formatPrice(Math.abs(balance))}
        </Text>
      </View>

      {/* Détails : dette / avances / gains fidélité / crédit dispo */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('carnet.dette')}</Text>
          <Text style={[styles.detailValue, account.totalDebt > 0 && { color: '#dc2626' }]}>
            {formatPrice(account.totalDebt || 0)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('carnet.avances')}</Text>
          <Text style={[styles.detailValue, { color: '#0ea5e9' }]}>
            {formatPrice(account.totalAdvances || 0)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('carnet.fidelityEarned')}</Text>
          <Text style={[styles.detailValue, { color: '#9333ea' }]}>
            {formatPrice(account.totalCashbackEarned || 0)}
          </Text>
        </View>
        {!archived && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('carnet.totalDispo')}</Text>
            <Text style={[styles.detailValue, { color: '#16a34a' }]}>
              {formatPrice(account.availableCredit || 0)}
            </Text>
          </View>
        )}
      </View>

      {/* CTA Footer → relevé d'écritures */}
      <View style={styles.cardFooter}>
        <Text style={[styles.cardFooterText, { color: theme.colors.brand }]}>
          {t('carnet.seeStatement')}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.brand} />
      </View>
    </TouchableOpacity>
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
      paddingTop: 12,
      paddingBottom: 24,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F7F7F8',
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: '#F7F7F8',
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#1f1f1f',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: '#71717a',
      marginBottom: 20,
      textAlign: 'center',
    },
    emptyButton: {
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 22,
    },
    emptyButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    // ── Summary ────────────────────────────────────────────
    summary: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 16,
      backgroundColor: '#fff',
      borderRadius: 14,
      paddingVertical: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    summaryCol: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      backgroundColor: '#e5e7eb',
      marginVertical: 4,
    },
    summaryLabel: {
      fontSize: 11,
      color: '#71717a',
      fontWeight: '600',
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: '800',
      color: '#1f1f1f',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#52525b',
      marginHorizontal: 16,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // ── Card ────────────────────────────────────────────
    card: {
      backgroundColor: '#fff',
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 14,
      padding: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardArchived: {
      opacity: 0.75,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    cardLogo: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#f4f4f5',
    },
    cardLogoFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardLogoEmoji: {
      fontSize: 26,
    },
    cardHeaderText: {
      flex: 1,
    },
    cardName: {
      fontSize: 15,
      fontWeight: '800',
      color: '#18181b',
    },
    cardAddress: {
      fontSize: 12,
      color: '#71717a',
      marginTop: 2,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 10.5,
      fontWeight: '700',
    },
    // ── Balance block ─────────────────────────────────────────
    balanceBlock: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: '#fafafa',
      borderRadius: 10,
      marginBottom: 10,
    },
    balanceLabel: {
      fontSize: 12,
      color: '#52525b',
      fontWeight: '600',
    },
    balanceHint: {
      fontSize: 10.5,
      color: '#a1a1aa',
      marginTop: 2,
    },
    balanceValue: {
      fontSize: 22,
      fontWeight: '800',
    },
    // ── Details ─────────────────────────────────────────
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    detailItem: {
      alignItems: 'flex-start',
      minWidth: 70,
    },
    detailLabel: {
      fontSize: 10.5,
      color: '#71717a',
      fontWeight: '600',
      marginBottom: 2,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '700',
      color: '#18181b',
    },
    // ── Footer CTA ───────────────────────────────────────────
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#f4f4f5',
      gap: 4,
    },
    cardFooterText: {
      fontSize: 12.5,
      fontWeight: '700',
    },
  });
