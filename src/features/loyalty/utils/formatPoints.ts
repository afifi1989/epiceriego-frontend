/**
 * Formatage du nombre de points avec séparateur de milliers.
 */
export function formatPoints(n: number | null | undefined): string {
  const value = Math.max(0, Math.round(n ?? 0));
  return value.toLocaleString('fr-FR');
}
