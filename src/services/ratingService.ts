import api from './api';

export interface Rating {
  id?: number;
  clientId: number;
  epicerieId: number;
  rating: number; // 1-5
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RatingStats {
  averageRating: number;
  totalRatings: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  recommendationPercentage: number;
}

export interface RatingNotificationInfo {
  epicerieId: number;
  epicerieName: string;
  epiceriePhotoUrl?: string;
  epicerieDescription?: string;
  orderId: number;
  orderTotal: number;
  deliveredAt: string;
  hasRated: boolean;
  existingRating?: Rating;
  message: string;
  stats: RatingStats;
}

/**
 * Service pour gérer les notations des épiceries
 */
export const ratingService = {
  /**
   * Ajouter ou modifier une notation
   */
  addOrUpdateRating: async (rating: Rating): Promise<any> => {
    try {
      console.log('[RatingService] Ajout/modification notation:', rating);
      const response = await api.post('/ratings', rating);
      console.log('[RatingService] Notation enregistrée avec succès');
      return response.data;
    } catch (error: any) {
      console.error('[RatingService] Erreur:', error);
      throw error.response?.data?.message || 'Erreur lors de l\'enregistrement de la notation';
    }
  },

  /**
   * Récupérer les informations pour le formulaire de notation (depuis notification)
   */
  getRatingInfoFromNotification: async (orderId: number): Promise<RatingNotificationInfo> => {
    try {
      console.log('[RatingService] Récupération infos notation pour commande:', orderId);
      const response = await api.get<RatingNotificationInfo>(`/ratings/from-notification/${orderId}`);
      console.log('[RatingService] Infos notation récupérées');
      return response.data;
    } catch (error: any) {
      console.error('[RatingService] Erreur:', error);
      throw error.response?.data?.message || 'Erreur lors de la récupération des informations';
    }
  },

  /**
   * Vérifier si le client a déjà noté une épicerie
   */
  hasRatedEpicerie: async (clientId: number, epicerieId: number): Promise<boolean> => {
    try {
      const response = await api.get<{ hasRated: boolean }>(
        `/ratings/client/${clientId}/epicerie/${epicerieId}/has-rated`
      );
      return response.data.hasRated;
    } catch (error) {
      console.error('[RatingService] Erreur vérification notation:', error);
      return false;
    }
  },

  /**
   * Vérifier si le client peut noter une épicerie
   */
  canRateEpicerie: async (clientId: number, epicerieId: number): Promise<boolean> => {
    try {
      const response = await api.get<{ canRate: boolean }>(
        `/ratings/client/${clientId}/epicerie/${epicerieId}/can-rate`
      );
      return response.data.canRate;
    } catch (error) {
      console.error('[RatingService] Erreur vérification possibilité notation:', error);
      return false;
    }
  },

  /**
   * Récupérer la notation d'un client pour une épicerie
   */
  getClientRating: async (clientId: number, epicerieId: number): Promise<Rating | null> => {
    try {
      const response = await api.get<Rating>(
        `/ratings/client/${clientId}/epicerie/${epicerieId}`
      );
      return response.data;
    } catch (error) {
      console.error('[RatingService] Erreur récupération notation:', error);
      return null;
    }
  },

  /**
   * Récupérer les statistiques de notation d'une épicerie
   */
  getEpicerieStats: async (epicerieId: number): Promise<RatingStats | null> => {
    try {
      const response = await api.get<RatingStats>(
        `/ratings/epicerie/${epicerieId}/average`
      );
      return response.data;
    } catch (error) {
      console.error('[RatingService] Erreur récupération stats:', error);
      return null;
    }
  },

  /**
   * Récupérer toutes les notations d'une épicerie
   */
  getEpicerieRatings: async (epicerieId: number): Promise<Rating[]> => {
    try {
      const response = await api.get<Rating[]>(`/ratings/epicerie/${epicerieId}`);
      return response.data;
    } catch (error) {
      console.error('[RatingService] Erreur récupération notations:', error);
      return [];
    }
  },

  /**
   * Supprimer une notation
   */
  deleteRating: async (ratingId: number): Promise<boolean> => {
    try {
      console.log('[RatingService] Suppression notation:', ratingId);
      await api.delete(`/ratings/${ratingId}`);
      console.log('[RatingService] Notation supprimée avec succès');
      return true;
    } catch (error: any) {
      console.error('[RatingService] Erreur suppression:', error);
      throw error.response?.data?.message || 'Erreur lors de la suppression';
    }
  },
};
