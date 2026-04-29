import type { Promotion, PromoStatus } from '../types';

/**
 * Détermine le statut effectif d'une promotion pour l'affichage.
 * Priorité au champ `status` (backend V70+), fallback sur le legacy `isActive + dates`.
 */
export function computeStatus(promo: Promotion): PromoStatus {
  if (promo.status) return promo.status;

  const now = new Date().getTime();
  const start = new Date(promo.dateDebut).getTime();
  const end = new Date(promo.dateFin).getTime();

  if (!promo.isActive) return 'CANCELLED';
  if (now > end) return 'EXPIRED';
  if (now < start) return 'SCHEDULED';
  return 'ACTIVE';
}

/**
 * Couleur principale associée à un statut (dot / border / texte d'accent).
 */
export function statusColor(status: PromoStatus): string {
  switch (status) {
    case 'ACTIVE':    return '#4CAF50';   // vert
    case 'SCHEDULED': return '#FF9800';   // orange
    case 'EXPIRED':   return '#9E9E9E';   // gris
    case 'CANCELLED': return '#F44336';   // rouge
    case 'DRAFT':     return '#607D8B';   // bleu-gris
  }
}

/**
 * Couleur de fond légère pour les badges (palette 50 de chaque couleur).
 */
export function statusBackground(status: PromoStatus): string {
  switch (status) {
    case 'ACTIVE':    return '#E8F5E9';
    case 'SCHEDULED': return '#FFF3E0';
    case 'EXPIRED':   return '#F5F5F5';
    case 'CANCELLED': return '#FFEBEE';
    case 'DRAFT':     return '#ECEFF1';
  }
}

/**
 * Emoji d'accompagnement du statut.
 */
export function statusEmoji(status: PromoStatus): string {
  switch (status) {
    case 'ACTIVE':    return '✅';
    case 'SCHEDULED': return '⏳';
    case 'EXPIRED':   return '🏁';
    case 'CANCELLED': return '⏸';
    case 'DRAFT':     return '📝';
  }
}
