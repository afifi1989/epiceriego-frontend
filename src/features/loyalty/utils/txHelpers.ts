import type { LoyaltyTransaction, TxKind } from '../types';

export function txIcon(kind: TxKind): string {
  switch (kind) {
    case 'EARN':
      return '➕';
    case 'REDEEM':
      return '🎁';
    case 'EXPIRE':
      return '⏱';
    case 'ADJUST':
      return '⚙️';
    case 'CANCEL':
      return '↩️';
  }
}

export function txColor(kind: TxKind): string {
  switch (kind) {
    case 'EARN':
      return '#4CAF50';
    case 'REDEEM':
      return '#2196F3';
    case 'EXPIRE':
      return '#9E9E9E';
    case 'ADJUST':
      return '#FF9800';
    case 'CANCEL':
      return '#9E9E9E';
  }
}

export function txLabelKey(kind: TxKind): string {
  switch (kind) {
    case 'EARN':
      return 'loyalty.history.earn';
    case 'REDEEM':
      return 'loyalty.history.redeem';
    case 'EXPIRE':
      return 'loyalty.history.expire';
    case 'ADJUST':
      return 'loyalty.history.adjust';
    case 'CANCEL':
      return 'loyalty.history.cancel';
  }
}

/**
 * Signe affiché devant le nombre de points. EARN est un gain (+), tout le reste
 * est représenté avec un signe négatif (−). Le champ `points` de l'API est
 * typiquement positif, on laisse la présentation au composant.
 */
export function txSign(kind: TxKind): '+' | '−' {
  return kind === 'EARN' ? '+' : '−';
}

/**
 * Formatage de date court (ex : "19 avr., 14:30").
 */
export function formatTxDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const datePart = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${timePart}`;
  } catch {
    return iso;
  }
}

export function toTxKind(tx: LoyaltyTransaction): TxKind {
  return tx.transactionType;
}
