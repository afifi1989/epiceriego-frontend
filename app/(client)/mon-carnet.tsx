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
import { useLanguage } from '../../src/context/LanguageContext';
import { authService } from '../../src/services/authService';
import { clientManagementService } from '../../src/services/clientManagementService';
import { creditPaymentService } from '../../src/services/creditPaymentService';
import { epicerieService } from '../../src/services/epicerieService';
import { Theme, useTheme } from '../../src/theme';
import { ClientEpicerieRelation, Epicerie } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';

interface CarnetEntry {
  relation: ClientEpicerieRelation;
  epicerie: Epicerie | null;
  creditInfo: {
    allowCredit: boolean;
    creditLimit: number;
    balanceDue: number;
    totalAdvances: number;
    availableCredit: number;
  };
  /** Avances déposées (séparément de creditInfo pour clarté visuelle). */
  totalAdvances: number;
}

/**
 * Page "Mon carnet" — vue par épicerie du crédit client.
 *
 * <p>Concept inspiré du carnet papier traditionnel marocain : l'épicier
 * tient un registre où il note les achats à crédit de chaque client.
 * Ici on donne au client une vue **transparente** sur sa propre situation
 * dans chaque épicerie où il a un compte.</p>
 *
 * <p>Pour chaque épicerie : statut autorisation crédit, plafond, dette
 * en cours, avances déposées, et crédit dispo. Tap → page factures pour
 * le détail des transactions.</p>
 */
export default function MonCarnetScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [entries, setEntries] = useState<CarnetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({
    totalDispo: 0,
    totalDette: 0,
    totalAvances: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadCarnet();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadCarnet = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      if (!user?.userId) {
        setEntries([]);
        return;
      }

      // 1) Liste des relations client-épicerie (avec creditLimit + allowCredit)
      const relations = await clientManagementService.getClientRelationships(user.userId);
      // On filtre les relations non-acceptées : pas de carnet à montrer si la
      // relation est PENDING / REVOKED.
      const accepted = relations.filter((r) => r.status === 'ACCEPTED');

      // 2) Avances globales (byStore) — donne nom épicerie sans extra appel
      const advancesByStore: Record<number, number> = {};
      try {
        const adv = await creditPaymentService.getMyAdvances();
        for (const s of adv.byStore) {
          advancesByStore[s.epicerieId] = s.totalAdvances ?? 0;
        }
      } catch (e) {
        console.warn('[MonCarnet] advances fetch failed', e);
      }

      // 3) Pour chaque relation, on charge l'épicerie (logo + nom) ET le
      //    crédit en parallèle. Les échecs partiels ne cassent pas la page.
      const enriched = await Promise.all(
        accepted.map(async (relation) => {
          const [epicerie, creditInfo] = await Promise.all([
            epicerieService
              .getEpicerieById(relation.epicerieId)
              .catch(() => null as Epicerie | null),
            clientManagementService
              .getCreditInfo(relation.epicerieId)
              .catch(() => ({
                allowCredit: false,
                creditLimit: 0,
                balanceDue: 0,
                totalAdvances: 0,
                availableCredit: 0,
              })),
          ]);
          return {
            relation,
            epicerie,
            creditInfo,
            totalAdvances: advancesByStore[relation.epicerieId] ?? creditInfo.totalAdvances ?? 0,
          };
        })
      );

      // Tri : crédit dispo décroissant pour mettre en avant les épiceries où
      // le client peut encore acheter.
      enriched.sort((a, b) => b.creditInfo.availableCredit - a.creditInfo.availableCredit);
      setEntries(enriched);

      // Totaux globaux pour le header résumé
      const totalDispo = enriched.reduce((s, e) => s + (e.creditInfo.availableCredit || 0), 0);
      const totalDette = enriched.reduce((s, e) => s + (e.creditInfo.balanceDue || 0), 0);
      const totalAvances = enriched.reduce((s, e) => s + (e.totalAdvances || 0), 0);
      setTotals({ totalDispo, totalDette, totalAvances });
    } catch (e) {
      console.error('[MonCarnet] load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCarnet();
  };

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────
  if (entries.length === 0) {
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
      {/* Résumé global */}
      <View style={styles.summary}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>{t('carnet.totalDispo')}</Text>
          <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
            {formatPrice(totals.totalDispo)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>{t('carnet.totalDette')}</Text>
          <Text style={[styles.summaryValue, { color: totals.totalDette > 0 ? '#dc2626' : '#52525b' }]}>
            {formatPrice(totals.totalDette)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>{t('carnet.totalAvances')}</Text>
          <Text style={styles.summaryValue}>{formatPrice(totals.totalAvances)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('carnet.myStores')}</Text>

      {entries.map((entry) => (
        <CarnetCard
          key={entry.relation.epicerieId}
          entry={entry}
          onPress={() => router.push({
            pathname: '/(client)/factures-paiements',
            params: { epicerieId: entry.relation.epicerieId.toString() },
          })}
          theme={theme}
          t={t}
        />
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ──────────────────────────────────────────────────────────────────
// CarnetCard — carte par épicerie
// ──────────────────────────────────────────────────────────────────

interface CarnetCardProps {
  entry: CarnetEntry;
  onPress: () => void;
  theme: Theme;
  t: (key: string) => string;
}

const CarnetCard: React.FC<CarnetCardProps> = ({ entry, onPress, theme, t }) => {
  const styles = makeStyles(theme);
  const { relation, epicerie, creditInfo, totalAdvances } = entry;

  const limit = creditInfo.creditLimit || 0;
  const effective = Math.max(limit, totalAdvances);
  const used = effective - creditInfo.availableCredit;
  const usedPct = effective > 0 ? Math.min(100, Math.max(0, (used / effective) * 100)) : 0;

  const statusColor = !creditInfo.allowCredit
    ? '#9ca3af'
    : creditInfo.availableCredit > 0
      ? '#16a34a'
      : '#dc2626';
  const statusLabel = !creditInfo.allowCredit
    ? t('carnet.creditDisabled')
    : creditInfo.availableCredit > 0
      ? t('carnet.creditAvailable')
      : t('carnet.creditExhausted');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${epicerie?.nomEpicerie || `Épicerie #${relation.epicerieId}`} — ${statusLabel}`}
    >
      {/* Bandeau supérieur : logo + nom + statut */}
      <View style={styles.cardTop}>
        {epicerie?.photoUrl ? (
          <ExpoImage source={{ uri: epicerie.photoUrl }} style={styles.cardLogo} contentFit="cover" />
        ) : (
          <View style={[styles.cardLogo, styles.cardLogoFallback]}>
            <Text style={styles.cardLogoEmoji}>🏪</Text>
          </View>
        )}
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardName} numberOfLines={1}>
            {epicerie?.nomEpicerie || `Épicerie #${relation.epicerieId}`}
          </Text>
          {epicerie?.adresse ? (
            <Text style={styles.cardAddress} numberOfLines={1}>
              📍 {epicerie.adresse}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Bloc crédit : barre + chiffres */}
      {creditInfo.allowCredit ? (
        <View style={styles.creditBlock}>
          <View style={styles.creditHeader}>
            <Text style={styles.creditHeaderLabel}>{t('carnet.creditAvailable')}</Text>
            <Text style={styles.creditHeaderValue}>
              {formatPrice(creditInfo.availableCredit)}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${usedPct}%`, backgroundColor: usedPct >= 90 ? '#dc2626' : usedPct >= 70 ? '#f59e0b' : theme.colors.brand }]} />
          </View>

          <View style={styles.creditDetails}>
            <View style={styles.creditDetailItem}>
              <Text style={styles.creditDetailLabel}>{t('carnet.plafond')}</Text>
              <Text style={styles.creditDetailValue}>{formatPrice(effective)}</Text>
            </View>
            <View style={styles.creditDetailItem}>
              <Text style={styles.creditDetailLabel}>{t('carnet.dette')}</Text>
              <Text style={[styles.creditDetailValue, creditInfo.balanceDue > 0 && { color: '#dc2626' }]}>
                {formatPrice(creditInfo.balanceDue)}
              </Text>
            </View>
            {totalAdvances > 0 && (
              <View style={styles.creditDetailItem}>
                <Text style={styles.creditDetailLabel}>{t('carnet.avances')}</Text>
                <Text style={[styles.creditDetailValue, { color: '#0ea5e9' }]}>
                  {formatPrice(totalAdvances)}
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.disabledBlock}>
          <Text style={styles.disabledText}>{t('carnet.creditNotActivated')}</Text>
        </View>
      )}

      {/* CTA Footer */}
      <View style={styles.cardFooter}>
        <Text style={[styles.cardFooterText, { color: theme.colors.brand }]}>
          {t('carnet.seeHistory')}
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
    // ── Credit block ─────────────────────────────────────────
    creditBlock: {
      padding: 12,
      backgroundColor: '#fafafa',
      borderRadius: 10,
    },
    creditHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    creditHeaderLabel: {
      fontSize: 12,
      color: '#52525b',
      fontWeight: '600',
    },
    creditHeaderValue: {
      fontSize: 18,
      fontWeight: '800',
      color: '#16a34a',
    },
    progressTrack: {
      height: 6,
      backgroundColor: '#e5e7eb',
      borderRadius: 3,
      marginBottom: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    creditDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    creditDetailItem: {
      alignItems: 'flex-start',
    },
    creditDetailLabel: {
      fontSize: 10.5,
      color: '#71717a',
      fontWeight: '600',
      marginBottom: 2,
    },
    creditDetailValue: {
      fontSize: 13,
      fontWeight: '700',
      color: '#18181b',
    },
    disabledBlock: {
      padding: 12,
      backgroundColor: '#f4f4f5',
      borderRadius: 10,
      alignItems: 'center',
    },
    disabledText: {
      fontSize: 12,
      color: '#71717a',
      fontWeight: '600',
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
