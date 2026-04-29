/**
 * Design tokens partagés par tous les écrans d'onboarding.
 * Inspiration : minimaliste type Linear/Stripe.
 *
 * Importer depuis ce fichier plutôt que de hardcoder pour garantir la
 * cohérence visuelle entre le shell et les steps.
 */

export const colors = {
  // Brand (épicier = bleu)
  primary: '#2563EB',          // bleu plus contemporain que #2196F3
  primaryDark: '#1D4ED8',
  primarySoft: '#EFF6FF',      // fond chip actif léger

  // Validation
  success: '#10B981',          // vert moderne
  successSoft: '#ECFDF5',

  // États
  warning: '#F59E0B',
  danger: '#EF4444',

  // Surfaces & texte
  bg: '#FAFAFA',               // fond global légèrement off-white
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  text: '#0F172A',             // slate-900 — plus chaud que #1a1a1a
  textMuted: '#64748B',        // slate-500
  textSubtle: '#94A3B8',       // slate-400
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  display: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  h1:      { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h2:      { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  body:    { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  micro:   { fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
