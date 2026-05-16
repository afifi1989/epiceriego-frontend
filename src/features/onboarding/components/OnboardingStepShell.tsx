/**
 * OnboardingStepShell — Squelette partagé par toutes les étapes du
 * wizard d'onboarding.
 *
 * Refonte minimaliste :
 *  - Top bar : flèche back + "Étape N/M" + bouton "Plus tard" (skip)
 *  - Barre de progression continue (pas de dots numérotés)
 *  - Hero : titre large + sous-titre, badge contextuel ("Obligatoire" / "Optionnel")
 *  - Footer : un seul gros bouton primaire pleine largeur
 *
 * Le contrat des props est inchangé pour préserver la compatibilité
 * avec l'orchestrateur (app/(epicier)/onboarding.tsx).
 */

import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WIZARD_STEPS, WizardStepMeta, formatEstimatedTime } from '../stepDefinitions';
import { colors, radii, shadow, space, typography } from '../theme';

/**
 * Format "≈ X min" / "< 1 min" pour le temps total restant.
 * Volontairement plus lisse que formatEstimatedTime (qui affiche en secondes).
 */
function formatRemainingTime(seconds: number | undefined): string | null {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 60) return '< 1 min';
  const min = Math.round(seconds / 60);
  return `${min} min`;
}

interface OnboardingStepShellProps {
  meta: WizardStepMeta;
  currentIndex: number;
  resolvedIndices: Set<number>;
  busy: boolean;
  children: ReactNode;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  onSkip?: () => void;
  onBack?: () => void;
  onJumpTo?: (index: number) => void;
  /**
   * Temps total estimé restant (somme des estimatedSeconds des étapes
   * non encore résolues, en secondes). Affiché en pill dans le top bar
   * pour rassurer l'utilisateur sur l'effort restant.
   */
  timeRemainingSec?: number;
  /**
   * Si fourni, affiche un bouton "⚡ Mode Express" dans le top bar qui
   * permet de skipper toutes les étapes optionnelles restantes en lot
   * — utile quand l'épicier est pressé et veut juste accéder au dashboard.
   */
  onExpressMode?: () => void;
}

export function OnboardingStepShell({
  meta,
  currentIndex,
  resolvedIndices,
  busy,
  children,
  onContinue,
  continueLabel = 'Continuer',
  continueDisabled,
  onSkip,
  onBack,
  onJumpTo,
  timeRemainingSec,
  onExpressMode,
}: OnboardingStepShellProps) {
  const total = WIZARD_STEPS.length;
  const stepNumber = currentIndex + 1;
  const progressPct = (resolvedIndices.size / total) * 100;
  const timeRemainingLabel = formatRemainingTime(timeRemainingSec);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Top bar ────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          disabled={!onBack || busy}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            !onBack && styles.iconBtnHidden,
            pressed && styles.iconBtnPressed,
          ]}
        >
          <Text style={styles.iconBtnGlyph}>←</Text>
        </Pressable>

        <View style={styles.topBarCenter}>
          <Text style={styles.stepCounter}>
            Étape {stepNumber} sur {total}
          </Text>
          {timeRemainingLabel && (
            <Text style={styles.timeRemaining}>⏱ {timeRemainingLabel} restant</Text>
          )}
        </View>

        {onSkip && !meta.required ? (
          <Pressable
            onPress={onSkip}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => [
              styles.skipPill,
              pressed && styles.skipPillPressed,
            ]}
          >
            <Text style={styles.skipPillText}>Plus tard</Text>
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Mode Express : bandeau d'opportunité quand l'épicier est sur une
          étape optionnelle et qu'il reste plusieurs optionnelles à venir.
          Permet de tout skipper d'un coup pour atteindre l'étape obligatoire
          ou la fin plus vite. */}
      {onExpressMode && !meta.required && !busy && (
        <Pressable
          onPress={onExpressMode}
          style={({ pressed }) => [
            styles.expressBar,
            pressed && styles.expressBarPressed,
          ]}
        >
          <Text style={styles.expressBarIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.expressBarTitle}>Mode Express</Text>
            <Text style={styles.expressBarSubtitle}>
              Sauter toutes les étapes optionnelles d'un coup
            </Text>
          </View>
          <Text style={styles.expressBarChev}>›</Text>
        </Pressable>
      )}

      {/* ── Barre de progression continue ──────────────────────── */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${progressPct}%` }]}
        />
      </View>

      {/* ── Mini-stepper cliquable (étapes complétées seulement) ── */}
      <View style={styles.miniStepper}>
        {WIZARD_STEPS.map((s, idx) => {
          const isCurrent = idx === currentIndex;
          const isResolved = resolvedIndices.has(idx);
          const canJump = !!onJumpTo && (isResolved || idx < currentIndex);
          return (
            <TouchableOpacity
              key={s.id}
              activeOpacity={canJump ? 0.6 : 1}
              onPress={canJump ? () => onJumpTo!(idx) : undefined}
              disabled={!canJump}
              style={styles.miniDotWrap}
            >
              <View
                style={[
                  styles.miniDot,
                  isResolved && styles.miniDotResolved,
                  isCurrent && styles.miniDotCurrent,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Body scrollable ─────────────────────────────────────── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroIcon}>{meta.icon}</Text>
          </View>
          <Text style={styles.heroTitle}>{meta.title}</Text>
          <Text style={styles.heroSubtitle}>{meta.subtitle}</Text>
          <View style={styles.heroBadgeRow}>
            <View style={[
              styles.heroBadge,
              meta.required ? styles.heroBadgeRequired : styles.heroBadgeOptional,
            ]}>
              <Text style={[
                styles.heroBadgeText,
                meta.required ? styles.heroBadgeTextRequired : styles.heroBadgeTextOptional,
              ]}>
                {meta.required ? 'Étape obligatoire' : 'Optionnel — modifiable plus tard'}
              </Text>
            </View>
            <View style={styles.heroTimeBadge}>
              <Text style={styles.heroTimeBadgeText}>
                ⏱ {formatEstimatedTime(meta.estimatedSeconds)}
              </Text>
            </View>
          </View>
        </View>

        {/* Contenu spécifique de l'étape */}
        <View style={styles.stepContent}>{children}</View>
      </ScrollView>

      {/* ── Footer fixe ─────────────────────────────────────────── */}
      {onContinue && (
        <View style={[styles.footer, { paddingBottom: Math.max(space.lg, insets.bottom + space.sm) }]}>
          <Pressable
            onPress={onContinue}
            disabled={busy || continueDisabled}
            style={({ pressed }) => [
              styles.continueBtn,
              continueDisabled && styles.continueBtnDisabled,
              pressed && !continueDisabled && styles.continueBtnPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueBtnText}>{continueLabel}</Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: 48,
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  stepCounter: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnHidden: { opacity: 0 },
  iconBtnPressed: { backgroundColor: colors.bg },
  iconBtnGlyph: {
    fontSize: 22,
    color: colors.text,
    lineHeight: 24,
  },
  skipPill: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm - 2,
    borderRadius: radii.pill,
  },
  skipPillPressed: { backgroundColor: colors.bg },
  skipPillText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // ── Progress bar ──
  progressTrack: {
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: space.lg,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },

  // ── Mini-stepper ──
  miniStepper: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: space.sm,
    paddingBottom: space.xs,
    gap: 6,
  },
  miniDotWrap: { padding: 4 },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  miniDotResolved: { backgroundColor: colors.success },
  miniDotCurrent: {
    backgroundColor: colors.primary,
    width: 18,
  },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: space.lg, paddingBottom: space.xxl },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  heroIcon: { fontSize: 32 },
  heroTitle: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  heroBadge: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  heroBadgeRequired: { backgroundColor: colors.primarySoft },
  heroBadgeOptional: { backgroundColor: colors.bg },
  heroBadgeText: {
    ...typography.micro,
    fontSize: 11,
  },
  heroBadgeTextRequired: { color: colors.primary },
  heroBadgeTextOptional: { color: colors.textMuted },

  // ── Step content ──
  stepContent: { paddingTop: space.xs },

  // ── Footer ──
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadow.raised,
  },
  continueBtnDisabled: {
    backgroundColor: colors.borderStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnPressed: { backgroundColor: colors.primaryDark },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Temps restant + hero time badge + Express bar ──
  timeRemaining: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  heroTimeBadge: {
    backgroundColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  heroTimeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  expressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  expressBarPressed: {
    backgroundColor: '#fff3cd',
    transform: [{ scale: 0.98 }],
  },
  expressBarIcon: { fontSize: 20 },
  expressBarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  expressBarSubtitle: {
    fontSize: 11,
    color: '#a16207',
    marginTop: 1,
    lineHeight: 14,
  },
  expressBarChev: {
    fontSize: 20,
    color: '#92400e',
    fontWeight: '700',
  },
});
