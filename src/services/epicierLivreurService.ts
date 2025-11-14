import api from './api';

export interface Livreur {
  id?: number; // Optional since backend may not always provide it
  userId?: number; // Backend may return this instead of id
  nom: string;
  telephone: string;
  isAvailable?: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
}

export interface AssignLivreurRequest {
  user: {
    id: number;
    nom: string;
    email: string;
    telephone: string;
    role: string;
  };
}

export interface AssignedLivreur extends Livreur {
  assignedAt: string;
}

export interface AssignOrderRequest {
  livreurId: number;
}

export const epicierLivreurService = {
  /**
   * Récupère la liste des livreurs non assignés
   */
  getUnassignedLivreurs: async (): Promise<Livreur[]> => {
    try {
      const response = await api.get<Livreur[]>('/livreurs/unassigned');
      // Ensure each livreur has an id field (use userId if id is missing)
      const livreurs = response.data.map(livreur => ({
        ...livreur,
        id: livreur.id || livreur.userId || Math.random(), // Fallback to userId or random ID
      }));
      console.log('[getUnassignedLivreurs] ✅ Livreurs transformés:', livreurs);
      return livreurs;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des livreurs';
    }
  },

  /**
   * Assigne un livreur à l'épicerie
   */
  assignLivreur: async (epicerieId: number, request: AssignLivreurRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post<{ message: string }>(
        `/livreurs/epicerie/${epicerieId}/assign`,
        request
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'assignation du livreur';
    }
  },

  /**
   * Récupère la liste des livreurs assignés à l'épicerie
   */
  getAssignedLivreurs: async (): Promise<AssignedLivreur[]> => {
    try {
      const response = await api.get<AssignedLivreur[]>('/livreurs/epicerie/available');
      // Ensure each livreur has an id field (use userId if id is missing)
      const livreurs = response.data.map(livreur => ({
        ...livreur,
        id: livreur.id || livreur.userId || Math.random(),
      }));
      console.log('[getAssignedLivreurs] ✅ Livreurs assignés transformés:', livreurs);
      return livreurs;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des livreurs assignés';
    }
  },

  /**
   * Désassigne un livreur de l'épicerie
   */
  unassignLivreur: async (epicerieId: number, livreurId: number): Promise<{ message: string }> => {
    try {
      const response = await api.delete<{ message: string }>(
        `/livreurs/epicerie/${epicerieId}/livreur/${livreurId}`
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la suppression de l\'assignation';
    }
  },

  /**
   * Assigne une commande à un livreur
   */
  assignOrderToLivreur: async (orderId: number, livreurId: number): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>(
        `/livreurs/order/${orderId}/assign-livreur`,
        { livreurId }
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'assignation de la commande';
    }
  },
};
