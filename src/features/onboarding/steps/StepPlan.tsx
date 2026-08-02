/**
 * StepPlan — Étape "Choisir une offre" du wizard onboarding.
 *
 * Au signup, le backend crée automatiquement un trial PRO de 14 jours.
 * Cette étape sert à :
 *  - Montrer à l'épicier qu'il bénéficie de cet essai gratuit
 *  - Présenter le comparatif des 4 plans (Découverte/Essentiel/Pro/Premium)
 *  - Permettre un changement immédiat (downgrade libre, upgrade = demande)
 *
 * submit() est tolérant : si la sélection est inchangée (= PRO trial déjà
 * actif), on ne fait aucun appel et on avance. Si l'épicier sélectionne
 * un autre plan, on appelle subscriptionService.switchPlan(planCode).
 */

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  subscriptionService,
  type MySubscription,
  type SubscriptionPlan,
} from '../../../services/subscriptionService';
import { colors, radii, space, typography } from '../theme';
import { planAccent } from '../../../utils/planLabels';
import type { StepHandle, StepProps } from './stepProps';

/** Quotas affichés sur chaque carte (libellé court + valeur formatée). */
interface QuotaLine {
  icon: string;
  label: string;
  value: string;
}

function formatQuota(n: number | null | undefined, suffix: string): string {
  if (n == null) return `Illimité ${suffix}`.trim();
  return `${n} ${suffix}`.trim();
}

function formatPrice(plan: SubscriptionPlan): string {
  if (!plan.monthlyPrice || plan.monthlyPrice === 0) return 'Gratuit';
  return `${plan.monthlyPrice} DH/mois`;
}

function buildQuotaLines(plan: SubscriptionPlan): QuotaLine[] {
  return [
    { icon: '📦', label: 'Produits',     value: formatQuota(plan.maxProducts, '') },
    { icon: '🧾', label: 'Commandes/mois', value: formatQuota(plan.maxOrdersPerMonth, '') },
    { icon: '👥', label: 'Collaborateurs', value: formatQuota(plan.maxCollaborators, '') },
    { icon: '🛒', label: 'Clients',       value: formatQuota(plan.maxClients, '') },
  ];
}

function buildFeatureLines(plan: SubscriptionPlan): { icon: string; label: string; on: boolean }[] {
  return [
    { icon: '💬', label: 'WhatsApp Business', on: plan.hasWhatsapp },
    { icon: '🎁', label: 'Codes promo',       on: plan.hasPromotions },
    { icon: '📈', label: 'Statistiques avancées', on: plan.hasAdvancedStats },
    { icon: '📋', label: 'Import CSV',        on: plan.hasCsvImport },
    { icon: '🎴', label: 'Fidélité',          on: plan.hasLoyalty },
    { icon: '🏬', label: 'Multi-épicerie',    on: plan.hasMultiEpicerie },
  ];
}

export const StepPlan = forwardRef<StepHandle, StepProps>(
  function StepPlan(_props, ref) {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [mySub, setMySub] = useState<MySubscription | null>(null);
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const [list, current] = await Promise.all([
            subscriptionService.listPlans(),
            subscriptionService.getMyPlan(),
          ]);
          if (!alive) return;
          // Tri stable par displayOrder
          list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          setPlans(list);
          setMySub(current);
          setSelectedCode(current?.plan?.code ?? 'PRO');
        } catch (e: any) {
          if (!alive) return;
          setError(e?.message ?? 'Impossible de charger les offres');
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => { alive = false; };
    }, []);

    useImperativeHandle(ref, () => ({
      async submit() {
        // Pas de sélection (cas dégradé : aucun plan chargé) → on laisse
        // passer, le trial PRO auto reste en place.
        if (!selectedCode || !mySub) return true;

        const currentCode = mySub.plan?.code;
        if (selectedCode === currentCode) return true; // rien à changer

        setSaving(true);
        try {
          // V99 : requestChange gère le branchement gratuit vs payant.
          // Plan gratuit (Découverte) → switch direct.
          // Plan payant → crée une demande PENDING. L'épicier verra la
          // bannière dans Mon abonnement après l'onboarding.
          const res = await subscriptionService.requestChange(selectedCode);
          if (res.status === 'PENDING') {
            // On laisse passer l'étape onboarding même si pending —
            // l'épicier continue avec son trial PRO actif jusqu'à validation.
            setError(null);
          }
          return true;
        } catch (e: any) {
          setError(e?.message ?? 'Changement de plan impossible');
          return false;
        } finally {
          setSaving(false);
        }
      },
    }), [selectedCode, mySub]);

    const trialDays = useMemo(() => {
      if (mySub?.status === 'TRIAL') return mySub.daysRemaining ?? 14;
      return null;
    }, [mySub]);

    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des offres…</Text>
        </View>
      );
    }

    if (error && plans.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Vous pouvez continuer — vous bénéficiez de l'essai PRO 14 jours par défaut.
          </Text>
        </View>
      );
    }

    return (
      <View>
        {/* ── Bandeau trial actif ── */}
        {trialDays != null && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialIcon}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.trialTitle}>
                Essai PRO offert — {trialDays} jour{trialDays > 1 ? 's' : ''} restant{trialDays > 1 ? 's' : ''}
              </Text>
              <Text style={styles.trialSubtitle}>
                Profitez de toutes les fonctionnalités sans engagement. Vous pourrez
                ajuster votre plan à la fin de l'essai.
              </Text>
            </View>
          </View>
        )}

        {/* ── Cartes plans ── */}
        {plans.map((plan) => {
          const isCurrent = mySub?.plan?.code === plan.code;
          const isSelected = selectedCode === plan.code;
          const isRecommended = plan.code === 'PRO';
          const accent = planAccent(plan.code);

          return (
            <Pressable
              key={plan.code}
              onPress={() => setSelectedCode(plan.code)}
              style={[
                styles.card,
                isSelected && {
                  borderColor: accent.tint,
                  borderWidth: 2,
                  backgroundColor: accent.soft,
                },
              ]}
            >
              {/* ── Header carte ── */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.planName, { color: accent.tint }]}>
                      {plan.name}
                    </Text>
                    {isRecommended && (
                      <View style={[styles.badge, { backgroundColor: accent.tint }]}>
                        <Text style={styles.badgeText}>Recommandé</Text>
                      </View>
                    )}
                    {isCurrent && (
                      <View style={styles.badgeCurrent}>
                        <Text style={styles.badgeCurrentText}>
                          {mySub?.status === 'TRIAL' ? 'Essai en cours' : 'Plan actuel'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {plan.tagline && (
                    <Text style={styles.tagline}>{plan.tagline}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.radio,
                    isSelected && { borderColor: accent.tint, backgroundColor: accent.tint },
                  ]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </View>

              {/* ── Prix ── */}
              <Text style={[styles.price, { color: accent.tint }]}>
                {formatPrice(plan)}
              </Text>

              {/* ── Quotas ── */}
              <View style={styles.quotaGrid}>
                {buildQuotaLines(plan).map((q, i) => (
                  <View key={i} style={styles.quotaItem}>
                    <Text style={styles.quotaIcon}>{q.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quotaLabel}>{q.label}</Text>
                      <Text style={styles.quotaValue}>{q.value}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* ── Features ── */}
              <View style={styles.featureList}>
                {buildFeatureLines(plan).map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={[styles.featureMark, !f.on && styles.featureMarkOff]}>
                      {f.on ? '✓' : '–'}
                    </Text>
                    <Text style={[styles.featureLabel, !f.on && styles.featureLabelOff]}>
                      {f.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}

        {/* ── Petits rappels ── */}
        <View style={styles.hintBox}>
          <Text style={styles.hintIcon}>ℹ️</Text>
          <Text style={styles.hintText}>
            Vous pouvez changer de plan à tout moment depuis Paramètres → Mon
            abonnement. Pas de carte bancaire demandée pendant l'essai.
          </Text>
        </View>

        {error && plans.length > 0 && (
          <Text style={styles.inlineError}>{error}</Text>
        )}
        {saving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.savingText}>Mise à jour du plan…</Text>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  centered: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.md,
  },
  loadingText: { ...typography.caption, color: colors.textMuted },
  errorIcon: { fontSize: 32 },
  errorText: {
    ...typography.bodyStrong,
    color: colors.danger,
    textAlign: 'center',
  },
  errorHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.lg,
  },

  // ── Bandeau trial ──
  trialBanner: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: '#F3E8FF',
    borderRadius: radii.lg,
    padding: space.md + 2,
    marginBottom: space.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  trialIcon: { fontSize: 28 },
  trialTitle: {
    ...typography.bodyStrong,
    color: '#5B21B6',
    marginBottom: 2,
  },
  trialSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: '#6D28D9',
    lineHeight: 17,
  },

  // ── Carte plan ──
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.lg,
    marginBottom: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginBottom: space.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.xs + 2,
    marginBottom: 4,
  },
  planName: {
    fontSize: 19,
    fontWeight: '800',
  },
  tagline: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: {
    ...typography.micro,
    color: '#fff',
    letterSpacing: 0.3,
  },
  badgeCurrent: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgeCurrentText: {
    ...typography.micro,
    color: colors.success,
    letterSpacing: 0.3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // ── Prix ──
  price: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: space.md,
  },

  // ── Quotas ──
  quotaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: space.md,
    marginHorizontal: -4,
  },
  quotaItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  quotaIcon: { fontSize: 14 },
  quotaLabel: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
  },
  quotaValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 16,
  },

  // ── Features ──
  featureList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm + 2,
    gap: 5,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  featureMark: {
    width: 14,
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
  },
  featureMarkOff: { color: colors.textSubtle },
  featureLabel: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  featureLabelOff: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },

  // ── Hint & erreurs ──
  hintBox: {
    flexDirection: 'row',
    gap: space.sm + 2,
    backgroundColor: colors.bg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  hintIcon: { fontSize: 16 },
  hintText: {
    flex: 1,
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  inlineError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: space.sm,
    textAlign: 'center',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  savingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
