import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { promoCodeEpicierService, PromoCodeStats } from '../../services/promoCodeService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * Widget dashboard mobile epicier — economies offertes via codes promos sur 30j.
 *
 * <p>Pendant du {@code DashboardPromoWidget} (Promotions auto). Tap → navigation
 * vers la page {@code codes-promos}. Cas erreur (403 sans STATS_VIEW, reseau) :
 * widget masque silencieusement pour ne pas casser le dashboard.</p>
 *
 * <p>UI epicier mobile en francais uniquement (cohérent avec
 * EpicierLanguageProvider).</p>
 */
export function DashboardPromoCodesWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PromoCodeStats | null>(null);
  const [hidden, setHidden] = useState(false);

  // Defense-in-depth : meme si le parent rend ce widget par erreur, on refuse
  // de fetcher si l'utilisateur n'a pas la permission backend correspondante
  // (/promo-codes/stats exige STATS_VIEW). Evite un 403 visible pour le caissier.
  const user = useCurrentUser();
  const { can } = usePermissions(user);
  const allowed = can('stats:view');

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setHidden(false);
    let cancelled = false;
    (async () => {
      try {
        const s = await promoCodeEpicierService.stats();
        if (cancelled) return;
        setStats(s);
      } catch {
        // 403 / reseau : masquer silencieusement
        if (!cancelled) setHidden(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allowed]);

  const goManage = () => router.push('/(epicier)/codes-promos' as any);

  // Pas la permission ou erreur silencieuse → on masque completement.
  if (!allowed || hidden) return null;

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color="#4CAF50" />
      </View>
    );
  }

  // Cas vide : pas de redemption sur 30 jours
  if (!stats || stats.redemptionCount === 0) {
    return (
      <TouchableOpacity style={[styles.card, styles.emptyCard]} onPress={goManage} activeOpacity={0.8}>
        <Text style={styles.emoji}>🎟️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Codes promos</Text>
          <Text style={styles.muted}>Aucun code utilisé sur 30 jours</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  const topCode = stats.topCodes?.[0];

  return (
    <TouchableOpacity style={styles.card} onPress={goManage} activeOpacity={0.8}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>🎟️</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Économies offertes (30 j)</Text>
        <Text style={styles.amount}>−{stats.totalDiscountGiven.toFixed(2)} DH</Text>
        <Text style={styles.meta}>
          {stats.redemptionCount} utilisation{stats.redemptionCount > 1 ? 's' : ''}
          {'  ·  '}{stats.activeCodesCount} code{stats.activeCodesCount > 1 ? 's' : ''}
        </Text>
        {topCode && (
          <View style={styles.topRow}>
            <Text style={styles.topLabel}>🥇 {topCode.code}</Text>
            <Text style={styles.topAmount}>−{topCode.totalDiscount.toFixed(2)} DH</Text>
          </View>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  loadingCard: {
    justifyContent: 'center', alignItems: 'center', minHeight: 60,
  },
  emptyCard: {
    borderLeftColor: '#E0E0E0',
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  emoji: { fontSize: 28 },

  label: {
    fontSize: 11, fontWeight: '800', color: '#555',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#222' },
  amount: { fontSize: 22, fontWeight: '800', color: '#2e7d32', marginTop: 2 },
  meta: { fontSize: 12, color: '#777', marginTop: 2 },
  muted: { fontSize: 12, color: '#888', marginTop: 2 },

  topRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  topLabel: { fontSize: 12, color: '#444', fontWeight: '600' },
  topAmount: { fontSize: 12, color: '#2e7d32', fontWeight: '700' },

  chevron: { fontSize: 24, color: '#BBB' },
});
