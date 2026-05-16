import { TextStyle } from 'react-native';

/**
 * Échelle typographique. Cohérence stricte des tailles + line-heights.
 * `lineHeight` calculé pour un confort de lecture (~1.35 sur les tailles courantes).
 */
export const typography = {
  display:    { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  titleLg:    { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  titleMd:    { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  titleSm:    { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  bodyLg:     { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  body:       { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption:    { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  label:      { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
