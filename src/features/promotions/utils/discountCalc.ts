/**
 * Applique un pourcentage de réduction à un prix, arrondi à 2 décimales.
 */
export function applyDiscount(price: number, percentage: number): number {
  const ratio = 1 - percentage / 100;
  return Math.round(price * ratio * 100) / 100;
}

/**
 * Calcule l'économie en valeur absolue pour un prix donné.
 */
export function savings(price: number, percentage: number): number {
  return Math.round(price * (percentage / 100) * 100) / 100;
}

/**
 * Formate un montant en DH avec 2 décimales.
 */
export function formatDH(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${amount.toFixed(2)} DH`;
}
