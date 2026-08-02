import {
  ClientAccount,
  ClientDuplicateResponse,
  ClientEpicerieRelation,
  ClientInvitation,
} from '../type';
import api from './api';
import { authService } from './authService';

/**
 * Détecte un 409 CLIENT_DUPLICATE et le relance sous forme d'erreur structurée
 * (Error avec `.clientDuplicate = ClientDuplicateResponse`) pour que l'écran
 * puisse ouvrir la modal de confirmation au lieu d'afficher l'erreur générique.
 * Renvoie `false` si ce n'est pas un doublon (le caller poursuit son catch).
 */
function throwIfClientDuplicate(error: any): void {
  if (
    error?.response?.status === 409 &&
    error.response?.data?.code === 'CLIENT_DUPLICATE'
  ) {
    const e: any = new Error('CLIENT_DUPLICATE');
    e.clientDuplicate = error.response.data as ClientDuplicateResponse;
    throw e;
  }
}

/** Éligibilité à la clôture d'un client (miroir de ClientDeletionEligibilityDTO). */
export interface DeletionEligibility {
  code: string;                 // 'OK' | 'ACCOUNT_NOT_SETTLED'
  canDelete: boolean;
  totalDebtUnpaid: number;
  refundableAdvance: number;
  requiredActions: string[];    // 'SETTLE_DEBT' | 'REFUND_ADVANCE'
}

/**
 * Client Management Service
 * Handles all operations related to client-epicerie relationships, invitations, and credit settings
 */
export const clientManagementService = {
  /**
   * Get all invitations sent by an epicerie
   * @param epicerieId ID of the epicerie
   * @returns List of client invitations
   */
  getClientInvitations: async (epicerieId: number): Promise<ClientInvitation[]> => {
    try {
      const response = await api.get<ClientInvitation[]>(
        `/epiceries/${epicerieId}/clients/invitations`
      );
      // Le backend renvoie un tableau ; on tolère une éventuelle enveloppe.
      const data: any = response.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.content)) return data.content;
      return [];
    } catch (error: any) {
      // Ne JAMAIS logger le corps de la réponse : données financières.
      console.error('[ClientManagementService] Error getting invitations:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des invitations';
    }
  },

  /**
   * Send an invitation to a client to join the epicerie by email
   * @param epicerieId ID of the epicerie
   * @param clientEmail Email of the client to invite
   * @param clientName Name of the client to invite
   * @returns Created invitation
   */
  sendClientInvitationByEmail: async (
    epicerieId: number,
    clientEmail: string,
    clientName: string,
    confirmMerge: boolean = false
  ): Promise<ClientInvitation> => {
    try {
      const response = await api.post<ClientInvitation>(
        `/epiceries/${epicerieId}/clients/invite`,
        { clientEmail, clientName, confirmMerge }
      );
      return response.data;
    } catch (error: any) {
      // 409 CLIENT_DUPLICATE (confirmAction LINK) : on remonte le corps structuré
      // pour que l'écran affiche la modal de confirmation (existing vs incoming).
      throwIfClientDuplicate(error);
      console.error('[ClientManagementService] Error sending invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'envoi de l\'invitation';
    }
  },

  /**
   * Send an invitation to a client by account ID (résultat de recherche).
   * Le backend re-valide la cible (compte CLIENT réel) — serveur autoritaire.
   * Gère le 409 CLIENT_DUPLICATE comme l'invitation par email.
   */
  sendClientInvitation: async (
    epicerieId: number,
    clientId: number,
    confirmMerge: boolean = false
  ): Promise<ClientInvitation> => {
    try {
      const response = await api.post<ClientInvitation>(
        `/epiceries/${epicerieId}/clients/invite`,
        { clientId, confirmMerge }
      );
      return response.data;
    } catch (error: any) {
      throwIfClientDuplicate(error);
      console.error('[ClientManagementService] Error sending invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'envoi de l\'invitation';
    }
  },

  /**
   * Create a "virtual" client — a placeholder account managed by the
   * epicier on behalf of someone who hasn't installed the app yet.
   * The carnet/factures/avances work the same as for a real client; if
   * the customer later signs up with the same phone, the backend will
   * automatically claim the virtual user (preserving all transactions).
   */
  createVirtualClient: async (
    epicerieId: number,
    payload: { name: string; phone?: string; email?: string },
    confirmMerge: boolean = false
  ): Promise<ClientEpicerieRelation> => {
    try {
      const response = await api.post<ClientEpicerieRelation>(
        `/epiceries/${epicerieId}/clients/virtual`,
        { ...payload, confirmMerge }
      );
      return response.data;
    } catch (error: any) {
      // 409 CLIENT_DUPLICATE (confirmAction MERGE) : on remonte le corps structuré
      // pour que l'écran affiche la modal de confirmation (existing vs incoming).
      throwIfClientDuplicate(error);
      console.error('[ClientManagementService] Error creating virtual client:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la création du client virtuel';
    }
  },

  /**
   * Update a virtual client's name/phone. Backend rejects (400) if the
   * client is no longer virtual (i.e. has been claimed by a real signup).
   */
  updateVirtualClient: async (
    epicerieId: number,
    clientId: number,
    payload: { name: string; phone?: string; email?: string }
  ): Promise<ClientEpicerieRelation> => {
    try {
      const response = await api.put<ClientEpicerieRelation>(
        `/epiceries/${epicerieId}/clients/${clientId}/virtual`,
        payload
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error updating virtual client:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la modification du client virtuel';
    }
  },

  /**
   * Resend a pending invitation. Triggers a fresh email + push to the
   * client. Backend rejects if the invitation is no longer PENDING.
   */
  resendInvitation: async (
    epicerieId: number,
    clientId: number
  ): Promise<ClientInvitation> => {
    try {
      const response = await api.post<ClientInvitation>(
        `/epiceries/${epicerieId}/clients/${clientId}/resend-invitation`,
        {}
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error resending invitation:', error.message);
      throw error.response?.data?.message || "Erreur lors du renvoi de l'invitation";
    }
  },

  /**
   * Accept an invitation to join an epicerie (client side)
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns Updated relationship
   */
  acceptInvitation: async (
    epicerieId: number,
    clientId: number
  ): Promise<ClientEpicerieRelation> => {
    try {
      const response = await api.put<ClientEpicerieRelation>(
        `/epiceries/${epicerieId}/clients/${clientId}/accept-invitation`,
        {}
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error accepting invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'acceptation de l\'invitation';
    }
  },

  /**
   * Reject an invitation (client side)
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   */
  rejectInvitation: async (epicerieId: number, clientId: number): Promise<void> => {
    try {
      await api.put(`/epiceries/${epicerieId}/clients/${clientId}/reject-invitation`, {});
    } catch (error: any) {
      console.error('[ClientManagementService] Error rejecting invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors du rejet de l\'invitation';
    }
  },

  /**
   * Get all clients of an epicerie.
   * NB : l'endpoint n'est PAS paginé côté backend — ne pas envoyer de
   * page/size trompeurs (ils étaient ignorés).
   */
  getEpicerieClients: async (
    epicerieId: number
  ): Promise<ClientEpicerieRelation[]> => {
    try {
      const response = await api.get<ClientEpicerieRelation[]>(
        `/epiceries/${epicerieId}/clients`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting clients:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des clients';
    }
  },

  /**
   * Get all epiceries where a client is registered
   * @param clientId ID of the client
   * @returns List of client relationships
   */
  getClientRelationships: async (clientId: number): Promise<ClientEpicerieRelation[]> => {
    try {
      const response = await api.get<ClientEpicerieRelation[]>(
        `/clients/${clientId}/epiceries`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting relationships:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des relations';
    }
  },

  /**
   * Get details of a specific client for an epicerie
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns Client relationship details
   */
  getClientDetails: async (
    epicerieId: number,
    clientId: number
  ): Promise<ClientEpicerieRelation> => {
    try {
      const response = await api.get<ClientEpicerieRelation>(
        `/epiceries/${epicerieId}/clients/${clientId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting client details:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des détails du client';
    }
  },

  /**
   * Update client credit settings for an epicerie
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @param allowCredit Whether to allow credit
   * @param creditLimit Optional credit limit
   * @returns Updated relationship
   */
  updateClientCredit: async (
    epicerieId: number,
    clientId: number,
    allowCredit: boolean,
    creditLimit?: number
  ): Promise<ClientEpicerieRelation> => {
    try {
      const response = await api.put<ClientEpicerieRelation>(
        `/epiceries/${epicerieId}/clients/${clientId}/credit`,
        {
          allowCredit,
          creditLimit,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error updating client credit:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la mise à jour du crédit du client';
    }
  },

  /**
   * Remove a client from an epicerie
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   */
  removeClient: async (epicerieId: number, clientId: number): Promise<void> => {
    try {
      await api.delete(`/epiceries/${epicerieId}/clients/${clientId}`);
    } catch (error: any) {
      // 409 = compte non soldé : on remonte l'éligibilité structurée au caller
      // pour qu'il propose la régularisation (remboursement / règlement dette).
      if (error?.response?.status === 409 && error.response?.data) {
        const e: any = new Error('ACCOUNT_NOT_SETTLED');
        e.eligibility = error.response.data as DeletionEligibility;
        throw e;
      }
      console.error('[ClientManagementService] Error removing client:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la suppression du client';
    }
  },

  /** Pré-vérifie si le client peut être retiré (sinon, actions requises). */
  getDeletionEligibility: async (
    epicerieId: number,
    clientId: number
  ): Promise<DeletionEligibility> => {
    const res = await api.get(
      `/epiceries/${epicerieId}/clients/${clientId}/deletion-eligibility`
    );
    return res.data;
  },

  /** Montant d'avance encore remboursable pour ce client. */
  getRefundableAdvance: async (
    epicerieId: number,
    clientId: number
  ): Promise<number> => {
    const res = await api.get(
      `/epiceries/${epicerieId}/clients/${clientId}/advances/refundable`
    );
    return res.data?.refundable ?? 0;
  },

  /** Envoie au client un rappel de règlement de sa dette (email + in-app + push). */
  sendDebtReminder: async (epicerieId: number, clientId: number): Promise<void> => {
    await api.post(`/epiceries/${epicerieId}/clients/${clientId}/debt-reminder`, {});
  },

  /** Rembourse une avance au client (écrit une ligne REFUND au carnet). */
  refundAdvance: async (
    epicerieId: number,
    clientId: number,
    payload: { amount: number; paymentMethod?: string; reference?: string; notes?: string }
  ): Promise<void> => {
    await api.post(
      `/epiceries/${epicerieId}/clients/${clientId}/advances/refund`,
      payload
    );
  },

  /**
   * Get client account information (balance, debt, advances).
   *
   * <p><strong>Variante épicier</strong> : nécessite la permission CLIENT_VIEW
   * côté backend. Utilisé par l'app épicier (fiche client) — pas par le client.</p>
   *
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns Client account details
   */
  getClientAccount: async (
    epicerieId: number,
    clientId: number
  ): Promise<ClientAccount> => {
    try {
      const response = await api.get<ClientAccount>(
        `/epiceries/${epicerieId}/clients/${clientId}/account`
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting client account:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération du compte client';
    }
  },

  /**
   * Get the connected client's OWN account at a given epicerie.
   *
   * <p>Endpoint dédié <strong>self-service</strong> client : ne nécessite
   * pas la permission épicier CLIENT_VIEW. Utilisé par la page Mon Carnet
   * et le panneau de transparence crédit dans le panier.</p>
   *
   * <p>Le clientId est dérivé du JWT côté backend — pas du path — donc
   * impossible de consulter la fiche d'un autre client.</p>
   *
   * @param epicerieId ID of the epicerie
   * @returns Account details for the currently authenticated client
   */
  getMyClientAccount: async (epicerieId: number): Promise<ClientAccount> => {
    try {
      const response = await api.get<ClientAccount>(
        `/clients/me/epiceries/${epicerieId}/account`
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting my client account:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de votre compte';
    }
  },

  /**
   * Get all clients of an epicerie with their account information
   * @param epicerieId ID of the epicerie
   * @returns List of clients with their account info
   */
  getClientsWithAccounts: async (
    epicerieId: number
  ): Promise<(ClientEpicerieRelation & ClientAccount)[]> => {
    try {
      const response = await api.get<(ClientEpicerieRelation & ClientAccount)[]>(
        `/epiceries/${epicerieId}/clients/with-accounts`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting clients with accounts:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des clients avec comptes';
    }
  },

  /**
   * Get the ARCHIVED (closed) clients of an epicerie, with their account
   * information. Même forme que {@link getClientsWithAccounts} (status='ARCHIVED').
   *
   * <p>Chargé à la demande depuis l'onglet « Archivés » de la liste clients :
   * ces relations sont clôturées et consultables en LECTURE SEULE (aucune
   * action de gestion possible).</p>
   *
   * @param epicerieId ID of the epicerie
   * @returns List of archived clients with their account info
   */
  getArchivedClients: async (
    epicerieId: number
  ): Promise<(ClientEpicerieRelation & ClientAccount)[]> => {
    try {
      const response = await api.get<(ClientEpicerieRelation & ClientAccount)[]>(
        `/epiceries/${epicerieId}/clients/archived`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting archived clients:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des clients archivés';
    }
  },

  /**
   * Search clients by name or email for an epicerie
   * @param epicerieId ID of the epicerie
   * @param searchTerm Search term
   * @returns List of matching clients
   */
  searchClients: async (
    epicerieId: number,
    searchTerm: string
  ): Promise<ClientEpicerieRelation[]> => {
    try {
      const response = await api.get<ClientEpicerieRelation[]>(
        `/epiceries/${epicerieId}/clients/search`,
        // Le backend attend `query` (@RequestParam String query) — `q` était
        // silencieusement ignoré et la recherche serveur ne fonctionnait pas.
        { params: { query: searchTerm } }
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error searching clients:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la recherche de clients';
    }
  },

  /**
   * Get all invitations for the current client
   * @returns List of invitations
   */
  getMyInvitations: async (): Promise<ClientInvitation[]> => {
    try {
      const response = await api.get<ClientInvitation[]>('/clients/invitations');
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error getting invitations:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des invitations';
    }
  },

  /**
   * Get credit information for current client at an epicerie
   * @param epicerieId ID of the epicerie
   * @returns Object with creditInfo and allowCredit status
   */
  getCreditInfo: async (epicerieId: number): Promise<{
    allowCredit: boolean;
    creditLimit: number;
    balanceDue: number;
    totalAdvances: number;
    availableCredit: number;
  }> => {
    try {
      // Get current user
      const currentUser = await authService.getCurrentUser();
      if (!currentUser || !currentUser.userId) {
        throw new Error('User not authenticated');
      }

      // Get client relationships to check if credit is allowed
      const relationships = await clientManagementService.getClientRelationships(currentUser.userId);

      const relationship = relationships.find(r => r.epicerieId === epicerieId);

      // Sans relation du tout → impossible d'utiliser le compte (le backend
      // renverrait NOT_REGISTERED_CLIENT). On coupe court.
      if (!relationship) {
        return {
          allowCredit: false,
          creditLimit: 0,
          balanceDue: 0,
          totalAdvances: 0,
          availableCredit: 0,
        };
      }

      const allowCredit = !!relationship.allowCredit;

      // ALIGNÉ SUR LE BACKEND : le plafond n'est pris en compte que si le crédit
      // est EXPLICITEMENT accordé (allowCredit + plafond saisi). Sinon plafond=0
      // → le client ne peut dépenser que ses AVANCES (dépôts + cashback), jamais
      // emprunter. On calcule donc toujours le disponible, même sans crédit.
      const grantedLimit = allowCredit && relationship.creditLimit
        ? relationship.creditLimit
        : 0;

      // Solde du compte (balanceDue net + avances) via l'endpoint self-service
      // `/clients/me/epiceries/{id}/account` (pas de permission épicier requise).
      let balanceDue = 0;
      let totalAdvances = 0;
      try {
        const account = await clientManagementService.getMyClientAccount(epicerieId);
        balanceDue = account.balanceDue || 0;
        totalAdvances = account.totalAdvances || 0;
      } catch (accountError: any) {
        console.warn('[getCreditInfo] Could not get client account, using defaults:', accountError?.message || accountError);
      }

      // account.balanceDue = totalDebt - totalAdvances (NET) → rawDebt = totalDebt.
      const rawDebt = balanceDue + totalAdvances;

      // availableCredit = max(plafond accordé, avances) - dette brute.
      // Cashback-only (allowCredit=false) : plafond=0 → dispo = avances - dette.
      const effectiveLimit = Math.max(grantedLimit, totalAdvances);
      const availableCredit = Math.max(0, effectiveLimit - rawDebt);

      return {
        allowCredit,
        creditLimit: grantedLimit,
        balanceDue,
        totalAdvances,
        availableCredit,
      };
    } catch (error: any) {
      // Message seul — jamais le corps de la réponse (données financières).
      console.error('[ClientManagementService] Error getting credit info:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des informations de crédit';
    }
  },

  /**
   * Check if client has enough credit to place an order
   * @param epicerieId ID of the epicerie
   * @param orderAmount Amount of the order
   * @returns True if client can afford the order with credit
   */
  canAffordOrder: async (epicerieId: number, orderAmount: number): Promise<boolean> => {
    try {
      const creditInfo = await clientManagementService.getCreditInfo(epicerieId);
      // On se base sur le disponible réel (avances/cashback inclus), pas sur
      // allowCredit : un client peut payer avec son propre solde sans crédit accordé.
      return creditInfo.availableCredit >= orderAmount;
    } catch (error: any) {
      console.error('[ClientManagementService] Error checking credit affordability:', error.message);
      return false; // If error, assume cannot afford
    }
  },

  /**
   * Liste les comptes mobile reels dont le telephone (normalise sur 9 chiffres)
   * correspond a celui du client virtuel. Sert d'aide a la decision avant link.
   */
  getLinkCandidates: async (
    epicerieId: number,
    clientId: number
  ): Promise<LinkCandidate[]> => {
    try {
      const response = await api.get<LinkCandidate[]>(
        `/epiceries/${epicerieId}/clients/${clientId}/link-candidates`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[ClientManagementService] Error fetching link candidates:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la recherche de candidats';
    }
  },

  /**
   * Fusionne le client virtuel {@code clientId} dans le compte mobile reel
   * {@code targetUserId}. Apres ce call, factures/avances/commandes sont
   * visibles cote client connecte.
   */
  linkVirtualToReal: async (
    epicerieId: number,
    clientId: number,
    targetUserId: number
  ): Promise<void> => {
    try {
      await api.post(`/epiceries/${epicerieId}/clients/${clientId}/link`, {
        targetUserId,
      });
    } catch (error: any) {
      console.error('[ClientManagementService] Error linking virtual client:', error.message);
      throw error.response?.data?.message || 'Erreur lors du rattachement';
    }
  },
};

export interface LinkCandidate {
  userId: number;
  nom: string;
  email: string;
  telephone: string;
}
