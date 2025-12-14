import {
  ClientAccount,
  ClientEpicerieRelation,
  ClientInvitation,
} from '../type';
import api from './api';

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
      const response = await api.get<any>(
        `/epiceries/${epicerieId}/clients/invitations`
      );

      console.log('[ClientManagementService] ========================================');
      console.log('[ClientManagementService] GET /epiceries/' + epicerieId + '/clients/invitations');
      console.log('[ClientManagementService] Response status:', response.status);
      console.log('[ClientManagementService] Response type:', typeof response.data);
      console.log('[ClientManagementService] Is Array:', Array.isArray(response.data));
      console.log('[ClientManagementService] Raw response:', JSON.stringify(response.data, null, 2));
      console.log('[ClientManagementService] ========================================');

      // Handle different response formats
      let invitations: ClientInvitation[] = [];

      if (Array.isArray(response.data)) {
        invitations = response.data;
      } else if (response.data?.content) {
        // Paginated response
        invitations = response.data.content;
      } else if (response.data?.data) {
        // Wrapped response
        invitations = response.data.data;
      } else if (response.data) {
        // Try to extract from response object
        const keys = Object.keys(response.data);
        console.log('[ClientManagementService] Response keys:', keys);

        // If there's a key that looks like it contains the data
        const dataKey = keys.find(k =>
          k.includes('invitation') ||
          k.includes('data') ||
          k.includes('content')
        );

        if (dataKey && Array.isArray(response.data[dataKey])) {
          invitations = response.data[dataKey];
        }
      }

      console.log('[ClientManagementService] Processed invitations:', invitations.length);
      return invitations;
    } catch (error: any) {
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
    clientName: string
  ): Promise<ClientInvitation> => {
    try {
      const response = await api.post<ClientInvitation>(
        `/epiceries/${epicerieId}/clients/invite`,
        { clientEmail, clientName }
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error sending invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'envoi de l\'invitation';
    }
  },

  /**
   * Send an invitation to a client to join the epicerie by ID (deprecated, use sendClientInvitationByEmail)
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client to invite
   * @returns Created invitation
   */
  sendClientInvitation: async (
    epicerieId: number,
    clientId: number
  ): Promise<ClientInvitation> => {
    try {
      const response = await api.post<ClientInvitation>(
        `/epiceries/${epicerieId}/clients/invite`,
        { clientId }
      );
      return response.data;
    } catch (error: any) {
      console.error('[ClientManagementService] Error sending invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'envoi de l\'invitation';
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
        `/epiceries/${epicerieId}/clients/invitations/${clientId}/accept`,
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
      await api.put(`/epiceries/${epicerieId}/clients/invitations/${clientId}/reject`, {});
    } catch (error: any) {
      console.error('[ClientManagementService] Error rejecting invitation:', error.message);
      throw error.response?.data?.message || 'Erreur lors du rejet de l\'invitation';
    }
  },

  /**
   * Get all clients of an epicerie with pagination
   * @param epicerieId ID of the epicerie
   * @param page Page number (0-indexed)
   * @param size Items per page
   * @returns List of client relationships
   */
  getEpicerieClients: async (
    epicerieId: number,
    page: number = 0,
    size: number = 20
  ): Promise<ClientEpicerieRelation[]> => {
    try {
      const response = await api.get<any>(
        `/epiceries/${epicerieId}/clients`,
        { params: { page, size } }
      );
      return response.data.content || response.data || [];
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
      console.error('[ClientManagementService] Error removing client:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la suppression du client';
    }
  },

  /**
   * Get client account information (balance, debt, advances)
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
        { params: { q: searchTerm } }
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
};
