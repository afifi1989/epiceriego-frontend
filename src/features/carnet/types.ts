/**
 * Types pour le Carnet Digital (الكرني)
 * Miroir exact des DTOs backend : CarnetResponseDTO, CarnetTransactionDTO, CarnetAlertDTO
 */

// ── Transaction individuelle ──────────────────────────────────────

export type CarnetTransactionType = 'INVOICE' | 'PAYMENT' | 'ADVANCE';

export interface CarnetTransaction {
  id: string;
  date: string;
  type: CarnetTransactionType;
  description: string;
  /** Montant ajouté à la dette (facture) */
  debit: number;
  /** Montant réduisant la dette (paiement, avance) */
  credit: number;
  /** Solde cumulé après cette transaction */
  runningBalance: number;
  reference: string | null;
  orderId: number | null;
  invoiceId: number | null;
  status: string;
}

// ── Alertes ───────────────────────────────────────────────────────

export type CarnetAlertType = 'OVERDUE' | 'NEAR_LIMIT' | 'NO_ACTIVITY' | 'NEGATIVE_BALANCE';

export interface CarnetAlert {
  type: CarnetAlertType;
  message: string;
  count: number;
}

// ── Réponse complète du carnet ────────────────────────────────────

export interface CarnetResponse {
  // Infos client
  clientId: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  /**
   * True quand le client est encore "virtuel" (créé par l'épicier sans
   * que la personne ait l'application). Permet d'afficher un bouton
   * "Modifier" et de cacher certaines actions impossibles pour ce statut.
   */
  clientIsVirtual?: boolean;
  /**
   * Statut de la relation épicier ↔ client renvoyé par le backend
   * (PENDING / ACCEPTED / REJECTED / ARCHIVED). Permet de basculer le
   * carnet en lecture seule quand le client est archivé, quel que soit
   * le chemin d'accès (scan QR, détail commande, liste archivés…).
   */
  relationStatus?: string;

  // Résumé financier
  totalDebt: number;
  totalAdvances: number;
  balanceDue: number;
  creditLimit: number;
  allowCredit: boolean;
  creditUsedPct: number;
  totalPurchases: number;

  // Alertes
  alerts: CarnetAlert[];

  // Timeline
  transactions: CarnetTransaction[];

  // Pagination
  page: number;
  totalPages: number;
  totalTransactions: number;
}

// ── Helpers UI ────────────────────────────────────────────────────

export const TRANSACTION_CONFIG: Record<CarnetTransactionType, {
  icon: string;
  color: string;
  label: string;
  sign: '+' | '-';
}> = {
  INVOICE: { icon: '📦', color: '#e53935', label: 'Commande', sign: '+' },
  PAYMENT: { icon: '✅', color: '#388E3C', label: 'Paiement', sign: '-' },
  ADVANCE: { icon: '💰', color: '#1976D2', label: 'Avance', sign: '-' },
};

export const ALERT_CONFIG: Record<CarnetAlertType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  OVERDUE:          { icon: '⚠️', color: '#e53935', bgColor: '#ffebee' },
  NEAR_LIMIT:       { icon: '📊', color: '#FF9800', bgColor: '#fff3e0' },
  NO_ACTIVITY:      { icon: '💤', color: '#757575', bgColor: '#f5f5f5' },
  NEGATIVE_BALANCE: { icon: '🔴', color: '#c62828', bgColor: '#ffcdd2' },
};
