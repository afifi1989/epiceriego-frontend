import api from './api';

/**
 * clientAccountService — comptes du client connecté, gérés « comme un
 * compte bancaire » (un compte par épicerie, écritures débit/crédit).
 *
 * <p>Sécurité : tous les endpoints sont self-service (`/clients/me/...`) —
 * l'identifiant client est dérivé du JWT côté backend, jamais envoyé par
 * l'app. Il est donc impossible de consulter le compte d'un autre client.</p>
 */

/** Compte du client chez UNE épicerie (miroir de MyEpicerieAccountDTO). */
export interface MyEpicerieAccount {
  epicerieId: number;
  epicerieName: string;
  epicerieAddress?: string | null;
  epiceriePhotoUrl?: string | null;
  currencyCode?: string | null;
  /** ACCEPTED (actif) ou ARCHIVED (lecture seule, historique consultable). */
  relationStatus: 'ACCEPTED' | 'ARCHIVED' | string;
  /** Dette : factures impayées. */
  totalDebt: number;
  /** Avances nettes détenues par l'épicier (dépôts + cashback − remboursements). */
  totalAdvances: number;
  /** Solde « bancaire » = avances nettes − dette (positif = en ma faveur). */
  accountBalance: number;
  /** Argent fidélité (cashback) gagné chez cette épicerie. */
  totalCashbackEarned: number;
  allowCredit: boolean;
  creditLimit?: number | null;
  availableCredit: number;
}

/** Écriture du relevé (miroir de CarnetTransactionDTO). */
export interface StatementEntry {
  id: string;
  date: string;
  /** INVOICE (achat) | PAYMENT | ADVANCE | REFUND | CASHBACK (gain fidélité). */
  type: 'INVOICE' | 'PAYMENT' | 'ADVANCE' | 'REFUND' | 'CASHBACK' | string;
  description: string;
  debit: number;
  credit: number;
  /** Solde courant APRÈS cette écriture (convention carnet : positif = dette). */
  runningBalance: number;
  reference?: string | null;
  orderId?: number | null;
  invoiceId?: number | null;
  status?: string | null;
  /**
   * Échéance (format yyyy-MM-dd) — renseignée uniquement pour les écritures
   * INVOICE. Permet d'afficher « à régler avant le… » / « en retard de X j »
   * sur les achats encore impayés. Absente sur les anciens backends : le
   * front doit rester tolérant (champ optionnel).
   */
  dueDate?: string | null;
}

/** Relevé complet (miroir de CarnetResponseDTO, champs utiles côté client). */
export interface MyStatement {
  clientId: number;
  clientName: string;
  relationStatus?: string | null;
  totalDebt: number;
  totalAdvances: number;
  balanceDue: number;
  creditLimit: number;
  allowCredit: boolean;
  creditUsedPct: number;
  totalPurchases: number;
  transactions: StatementEntry[];
  page: number;
  totalPages: number;
  totalTransactions: number;
}

export const clientAccountService = {
  /**
   * Tous mes comptes, un par épicerie — un seul appel réseau.
   * Inclut les relations ARCHIVED (historique en lecture seule).
   */
  getMyAccounts: async (): Promise<MyEpicerieAccount[]> => {
    try {
      const response = await api.get<MyEpicerieAccount[]>('/clients/me/accounts');
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientAccountService] Error getting accounts:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de vos comptes';
    }
  },

  /**
   * Relevé d'écritures chez une épicerie (achats, avances, paiements,
   * remboursements, gains fidélité) avec solde courant — paginé.
   */
  getMyStatement: async (
    epicerieId: number,
    page: number = 0,
    size: number = 20
  ): Promise<MyStatement> => {
    try {
      const response = await api.get<MyStatement>(
        `/clients/me/epiceries/${epicerieId}/statement`,
        { params: { page, size } }
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientAccountService] Error getting statement:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération du relevé';
    }
  },
};
