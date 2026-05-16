/**
 * Échelle d'espacement basée sur 4px. Évite les magic numbers.
 * Usage: `paddingHorizontal: theme.spacing.md` plutôt que `paddingHorizontal: 16`.
 */
export const spacing = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;
