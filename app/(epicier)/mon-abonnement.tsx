export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Mon abonnement — Page épicier qui montre le plan actif, son statut
 * (trial / actif / expiré) + le comparatif des 4 plans pour basculer.
 *
 * Différence avec StepPlan (onboarding) : ici on a un header riche avec
 * le statut courant + jours restants + alerte si expiré. Le switchPlan
 * est immédiat (pas de "Valider" — c'est juste un toggle).
 */

import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking } from 'react-native';
import { refreshPendingRequest, refreshSubscription, useSubscription } from '../../src/hooks/useSubscription';
import {
  subscriptionService,
  type PaymentInstructions,
  type SubscriptionChangeRequest,
  type SubscriptionPlan,
  type SubscriptionSwitchPreview,
} from '../../src/services/subscriptionService';

const COLORS = {
  primary: '#2563EB',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
};

function planAccent(code: string): { tint: string; soft: string } {
  switch (code) {
    case 'PRO':       return { tint: '#7C3AED', soft: '#F3E8FF' };
    case 'PREMIUM':   return { tint: '#F59E0B', soft: '#FEF3C7' };
    case 'ESSENTIEL': return { tint: '#0EA5E9', soft: '#E0F2FE' };
    default:          return { tint: COLORS.textMuted, soft: '#F1F5F9' };
  }
}

function formatPrice(plan: SubscriptionPlan): string {
  if (!plan.monthlyPrice || plan.monthlyPrice === 0) return 'Gratuit';
  return `${plan.monthlyPrice} DH/mois`;
}

function formatQuota(n: number | null | undefined, label: string): string {
  if (n == null) return `Illimité — ${label}`;
  return `${n} ${label}`;
}

function statusLabel(status: string | undefined): { text: string; color: string; bg: string } {
  switch (status) {
    case 'TRIAL':     return { text: 'Essai gratuit', color: '#7C3AED', bg: '#F3E8FF' };
    case 'ACTIVE':    return { text: 'Actif',         color: COLORS.success, bg: COLORS.successSoft };
    case 'EXPIRED':   return { text: 'Expiré',        color: COLORS.danger,  bg: COLORS.dangerSoft };
    case 'CANCELLED': return { text: 'Annulé',        color: COLORS.textMuted, bg: '#F1F5F9' };
    default:          return { text: '—',             color: COLORS.textMuted, bg: '#F1F5F9' };
  }
}

/** Ligne label + valeur dans la bannière instructions de paiement. */
function PaymentRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.ppRow}>
      <Text style={styles.ppLabel}>{label}</Text>
      <Text style={[styles.ppValue, mono && styles.ppValueMono]} selectable>{value}</Text>
    </View>
  );
}

export default function MonAbonnementScreen() {
  const router = useRouter();
  const {
    subscription,
    plan: currentPlan,
    loading,
    reload,
    pendingRequest,
    reloadPending,
  } = useSubscription();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await subscriptionService.listPlans();
        if (!alive) return;
        list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        setPlans(list);
      } finally {
        if (alive) setLoadingPlans(false);
      }
      // V99 : charge les instructions de paiement en parallèle.
      const pi = await subscriptionService.getPaymentInstructions();
      if (alive) setPaymentInstructions(pi);
    })();
    return () => { alive = false; };
  }, []);

  const performSwitch = useCallback(async (planCode: string) => {
    setSwitching(planCode);
    try {
      const res = await subscriptionService.requestChange(planCode);
      if (res.status === 'IMMEDIATE') {
        // Plan gratuit → switch appliqué directement
        await refreshSubscription();
        await reload();
        await reloadPending();
        Alert.alert('✅ Plan mis à jour',
          `Vous êtes maintenant sur le plan ${res.subscription?.plan.name ?? planCode}.`);
      } else {
        // Plan payant → demande PENDING créée
        if (res.paymentInstructions) setPaymentInstructions(res.paymentInstructions);
        await reloadPending();
        Alert.alert(
          '⏳ Demande enregistrée',
          'Votre demande sera traitée après réception du paiement. '
          + 'Consultez la bannière en haut de l\'écran pour les coordonnées.',
        );
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Changement impossible');
    } finally {
      setSwitching(null);
    }
  }, [reload, reloadPending]);

  const handleCancelRequest = useCallback((req: SubscriptionChangeRequest) => {
    Alert.alert(
      'Annuler la demande',
      `Annuler votre demande de passage au plan ${req.requestedPlan.name} ?\n\n`
      + 'Vous pourrez en refaire une nouvelle plus tard.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler la demande',
          style: 'destructive',
          onPress: async () => {
            setCancellingRequest(true);
            try {
              await subscriptionService.cancelMyRequest();
              await refreshPendingRequest();
              await reloadPending();
              Alert.alert('Demande annulée', 'Votre plan actuel reste inchangé.');
            } catch {
              Alert.alert('Erreur', 'Annulation impossible');
            } finally {
              setCancellingRequest(false);
            }
          },
        },
      ],
    );
  }, [reloadPending]);

  const handleSwitch = useCallback(async (planCode: string) => {
    if (planCode === currentPlan?.code) return;
    // Etape 1 : appel preview pour decider du type de confirmation
    let preview: SubscriptionSwitchPreview | null = null;
    try {
      preview = await subscriptionService.previewSwitch(planCode);
    } catch {
      // Si le preview echoue, on retombe sur la confirmation simple
    }

    const isMeaningfulDowngrade = !!preview && preview.isDowngrade
      && ((preview.featureLosses?.length ?? 0) > 0
       || (preview.quotaWarnings?.length ?? 0) > 0);

    if (isMeaningfulDowngrade) {
      // Confirmation enrichie — liste explicite des consequences
      const featureLines = (preview!.featureLosses ?? [])
        .map(f => `• ${f.label}${f.action ? ' — ' + f.action : ''}`)
        .join('\n');
      const quotaLines = (preview!.quotaWarnings ?? [])
        .map(q => `• ${q.currentUsage} ${q.label} (max ${q.newMax}) — créations bloquées jusqu'à descendre sous la limite`)
        .join('\n');

      let body = `Vous allez passer de ${preview!.currentPlanCode} à ${preview!.targetPlanName}.\n\n`;
      if (featureLines) body += `⚠️ Désactivations :\n${featureLines}\n\n`;
      if (quotaLines)   body += `📊 Quotas dépassés :\n${quotaLines}\n\n`;
      body += 'Vos données ne seront pas supprimées.';

      Alert.alert(
        '⚠️ Confirmer le downgrade',
        body,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Je confirme',
            style: 'destructive',
            onPress: () => performSwitch(planCode),
          },
        ],
      );
    } else {
      // Confirmation simple — upgrade ou switch neutre
      Alert.alert(
        'Changer de plan',
        `Confirmer le passage au plan ${planCode} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer', onPress: () => performSwitch(planCode) },
        ],
      );
    }
  }, [currentPlan?.code, performSwitch]);

  const sortedPlans = useMemo(() => plans, [plans]);
  const isExpired = subscription?.status === 'EXPIRED';
  const isTrial = subscription?.status === 'TRIAL';
  const daysLeft = subscription?.daysRemaining ?? 0;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Stack.Screen
        options={{
          title: 'Mon abonnement',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
        }}
      />

      {loading || loadingPlans ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* ═══════════════════════════════════════════════════════════
              V99 — Bannière demande en attente
              Affichée si l'épicier a une SubscriptionChangeRequest PENDING.
              Montre plan demandé + montant + RIB/WhatsApp + bouton annuler.
              ═══════════════════════════════════════════════════════════ */}
          {pendingRequest && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingHeader}>
                <Text style={styles.pendingIcon}>⏳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>Demande en attente de validation</Text>
                  <Text style={styles.pendingSubtitle}>
                    Passage de <Text style={styles.bold}>{pendingRequest.currentPlan.name}</Text>
                    {' '}vers <Text style={[styles.bold, { color: planAccent(pendingRequest.requestedPlan.code).tint }]}>
                      {pendingRequest.requestedPlan.name}
                    </Text>
                  </Text>
                  <Text style={styles.pendingAmount}>
                    {pendingRequest.amountDue} {pendingRequest.currency} / {pendingRequest.billingCycle === 'YEARLY' ? 'an' : 'mois'}
                  </Text>
                </View>
              </View>

              {paymentInstructions && (
                <View style={styles.pendingInstructionsBox}>
                  <Text style={styles.pendingInstructionsTitle}>
                    💳 {paymentInstructions.label}
                  </Text>
                  {paymentInstructions.bankName && (
                    <PaymentRow label="Banque" value={paymentInstructions.bankName} />
                  )}
                  {paymentInstructions.accountHolder && (
                    <PaymentRow label="Bénéficiaire" value={paymentInstructions.accountHolder} />
                  )}
                  {paymentInstructions.rib && (
                    <PaymentRow label="RIB" value={paymentInstructions.rib} mono />
                  )}
                  {paymentInstructions.iban && (
                    <PaymentRow label="IBAN" value={paymentInstructions.iban} mono />
                  )}
                  {paymentInstructions.phoneWhatsapp && (
                    <Pressable
                      onPress={() => {
                        const phone = paymentInstructions.phoneWhatsapp!.replace(/[^\d]/g, '');
                        Linking.openURL(`https://wa.me/${phone}`);
                      }}
                      style={({ pressed }) => [styles.pendingLinkRow, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.pendingLinkText}>
                        💬 WhatsApp : {paymentInstructions.phoneWhatsapp}
                      </Text>
                    </Pressable>
                  )}
                  {paymentInstructions.phoneCall && (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${paymentInstructions.phoneCall}`)}
                      style={({ pressed }) => [styles.pendingLinkRow, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.pendingLinkText}>
                        📞 Téléphone : {paymentInstructions.phoneCall}
                      </Text>
                    </Pressable>
                  )}
                  {paymentInstructions.acceptedMethods && (
                    <Text style={styles.pendingMethods}>
                      <Text style={styles.bold}>Méthodes : </Text>
                      {paymentInstructions.acceptedMethods}
                    </Text>
                  )}
                  {paymentInstructions.instructions && (
                    <Text style={styles.pendingExtra}>{paymentInstructions.instructions}</Text>
                  )}
                </View>
              )}

              <Text style={styles.pendingFooterNote}>
                Votre plan actuel <Text style={styles.bold}>{pendingRequest.currentPlan.name}</Text> reste actif jusqu'à validation. Aucun débit auto.
              </Text>

              <Pressable
                onPress={() => handleCancelRequest(pendingRequest)}
                disabled={cancellingRequest}
                style={({ pressed }) => [
                  styles.pendingCancelBtn,
                  (pressed || cancellingRequest) && { opacity: 0.7 },
                ]}
              >
                {cancellingRequest ? (
                  <ActivityIndicator color={COLORS.danger} size="small" />
                ) : (
                  <Text style={styles.pendingCancelBtnText}>❌ Annuler la demande</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ── Header plan courant ── */}
          <View style={[
            styles.headerCard,
            { borderLeftColor: planAccent(currentPlan.code).tint },
          ]}>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerLabel}>Votre plan</Text>
                <Text style={[styles.headerPlanName, { color: planAccent(currentPlan.code).tint }]}>
                  {currentPlan.name}
                </Text>
                <Text style={styles.headerPrice}>{formatPrice(currentPlan)}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: statusLabel(subscription?.status).bg },
              ]}>
                <Text style={[styles.statusBadgeText, { color: statusLabel(subscription?.status).color }]}>
                  {statusLabel(subscription?.status).text}
                </Text>
              </View>
            </View>

            {isTrial && (
              <View style={styles.trialPill}>
                <Text style={styles.trialPillIcon}>🎁</Text>
                <Text style={styles.trialPillText}>
                  {daysLeft} jour{daysLeft > 1 ? 's' : ''} d'essai restant{daysLeft > 1 ? 's' : ''} —
                  vous pourrez ajuster votre plan à l'expiration.
                </Text>
              </View>
            )}

            {isExpired && (
              <View style={styles.expiredAlert}>
                <Text style={styles.expiredIcon}>⚠️</Text>
                <Text style={styles.expiredText}>
                  Votre abonnement a expiré. Choisissez un nouveau plan ci-dessous pour
                  débloquer les fonctionnalités.
                </Text>
              </View>
            )}
          </View>

          {/* ── Section comparaison ── */}
          <Text style={styles.sectionTitle}>Comparer les plans</Text>
          <Text style={styles.sectionHint}>
            Vous pouvez changer à tout moment. Les downgrades sont libres.
          </Text>

          {sortedPlans.map(plan => {
            const isCurrent = plan.code === currentPlan.code;
            const accent = planAccent(plan.code);
            const isLoadingThis = switching === plan.code;

            return (
              <View
                key={plan.code}
                style={[
                  styles.planCard,
                  isCurrent && { borderColor: accent.tint, borderWidth: 2 },
                ]}
              >
                {/* Header plan */}
                <View style={styles.planHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.planTitleRow}>
                      <Text style={[styles.planName, { color: accent.tint }]}>
                        {plan.name}
                      </Text>
                      {plan.code === 'PRO' && (
                        <View style={[styles.recoBadge, { backgroundColor: accent.tint }]}>
                          <Text style={styles.recoBadgeText}>Recommandé</Text>
                        </View>
                      )}
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Actuel</Text>
                        </View>
                      )}
                    </View>
                    {plan.tagline && <Text style={styles.planTagline}>{plan.tagline}</Text>}
                  </View>
                </View>

                <Text style={[styles.planPrice, { color: accent.tint }]}>
                  {formatPrice(plan)}
                </Text>

                {/* Quotas clés */}
                <View style={styles.quotaSection}>
                  <Text style={styles.quotaLine}>
                    📦 {formatQuota(plan.maxProducts, 'produits')}
                  </Text>
                  <Text style={styles.quotaLine}>
                    🧾 {formatQuota(plan.maxOrdersPerMonth, 'commandes/mois')}
                  </Text>
                  <Text style={styles.quotaLine}>
                    👥 {formatQuota(plan.maxCollaborators, 'collaborateurs')}
                  </Text>
                </View>

                {/* Features booléennes */}
                <View style={styles.featList}>
                  {[
                    { label: 'WhatsApp Business', on: plan.hasWhatsapp },
                    { label: 'Codes promo', on: plan.hasPromotions },
                    { label: 'Stats avancées', on: plan.hasAdvancedStats },
                    { label: 'Import CSV', on: plan.hasCsvImport },
                    { label: 'Carte fidélité', on: plan.hasLoyalty },
                    { label: 'Multi-épicerie', on: plan.hasMultiEpicerie },
                    { label: 'Support prioritaire', on: plan.hasPrioritySupport },
                  ].map((f, i) => (
                    <View key={i} style={styles.featRow}>
                      <Text style={[
                        styles.featMark,
                        !f.on && styles.featMarkOff,
                      ]}>
                        {f.on ? '✓' : '–'}
                      </Text>
                      <Text style={[
                        styles.featLabel,
                        !f.on && styles.featLabelOff,
                      ]}>
                        {f.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* CTA : "Demande envoyée" si pending sur ce plan, sinon bouton */}
                {!isCurrent && pendingRequest?.requestedPlan.code === plan.code && (
                  <View style={styles.planPendingMark}>
                    <Text style={styles.planPendingMarkText}>⏳ Demande envoyée</Text>
                  </View>
                )}
                {!isCurrent && pendingRequest?.requestedPlan.code !== plan.code && (
                  <Pressable
                    onPress={() => handleSwitch(plan.code)}
                    disabled={isLoadingThis}
                    style={({ pressed }) => [
                      styles.cta,
                      { backgroundColor: accent.tint },
                      (pressed || isLoadingThis) && { opacity: 0.7 },
                    ]}
                  >
                    {isLoadingThis ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.ctaText}>
                        {(currentPlan.monthlyPrice ?? 0) < (plan.monthlyPrice ?? 0)
                          ? 'Passer à ce plan'
                          : 'Choisir ce plan'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}

          <View style={styles.footHint}>
            <Text style={styles.footHintText}>
              💡 Les upgrades vers ESSENTIEL/PRO/PREMIUM seront facturés
              manuellement par notre équipe (virement ou cash). Aucune
              carte bancaire n'est demandée dans la version actuelle.
            </Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>← Retour</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  // ── Header plan courant ──
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerPlanName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerPrice: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  trialPillIcon: { fontSize: 18 },
  trialPillText: {
    flex: 1,
    fontSize: 13,
    color: '#5B21B6',
    lineHeight: 18,
  },
  expiredAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  expiredIcon: { fontSize: 18 },
  expiredText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
  },

  // ── Plan card ──
  planCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: {
    marginBottom: 6,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  planName: {
    fontSize: 19,
    fontWeight: '800',
  },
  planTagline: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
  recoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  recoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.success,
    letterSpacing: 0.3,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
  },
  quotaSection: {
    paddingVertical: 8,
    marginBottom: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  quotaLine: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    lineHeight: 18,
  },
  featList: {
    gap: 5,
    marginBottom: 14,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featMark: {
    width: 14,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
    textAlign: 'center',
  },
  featMarkOff: { color: COLORS.textSubtle },
  featLabel: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  featLabelOff: {
    color: COLORS.textSubtle,
    textDecorationLine: 'line-through',
  },
  cta: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  footHint: {
    backgroundColor: COLORS.warningSoft,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  footHintText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  backLink: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 12,
  },
  backLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // ── V99 : Bannière demande en attente ─────────────────────────────
  pendingBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: COLORS.warning,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  pendingIcon: {
    fontSize: 28,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  pendingSubtitle: {
    fontSize: 14,
    color: '#78350F',
    marginBottom: 4,
  },
  pendingAmount: {
    fontSize: 15,
    color: '#78350F',
    fontWeight: '700',
  },
  bold: {
    fontWeight: '700',
  },
  pendingInstructionsBox: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  pendingInstructionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  ppRow: {
    marginBottom: 8,
  },
  ppLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  ppValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  ppValueMono: {
    fontFamily: 'monospace',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
  },
  pendingLinkRow: {
    paddingVertical: 6,
  },
  pendingLinkText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  pendingMethods: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 18,
  },
  pendingExtra: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
    borderStyle: 'dashed',
    lineHeight: 18,
  },
  pendingFooterNote: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  pendingCancelBtn: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  pendingCancelBtnText: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Plan card : marque "Demande envoyée" ──────────────────────────
  planPendingMark: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  planPendingMarkText: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 14,
  },
});
