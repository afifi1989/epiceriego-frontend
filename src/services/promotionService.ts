import api from './api';

export interface Promotion {
  id: number;
  epicerieId: number;
  epicerieName: string;
  epicerieImageUrl?: string;
  titre: string;
  description?: string;
  reductionPercentage: number;
  imageUrl?: string;
  dateDebut: string;
  dateFin: string;
  isActive: boolean;
  createdAt: string;
  isCurrentlyActive: boolean;
}

export interface CreatePromotionRequest {
  titre: string;
  description?: string;
  reductionPercentage: number;
  imageUrl?: string;
  dateDebut: string;
  dateFin: string;
}

export interface UpdatePromotionRequest extends Partial<CreatePromotionRequest> {
  isActive?: boolean;
}

export const promotionService = {
  // ============================================
  // CLIENT ENDPOINTS
  // ============================================

  /**
   * Get nearby promotions based on user location and favorites
   * Filters promotions from:
   * 1. User's favorite epiceries
   * 2. Epiceries within the specified radius from user's location
   *
   * @param latitude User's current latitude
   * @param longitude User's current longitude
   * @param radius Search radius in kilometers (default: 1 km)
   * @returns List of nearby promotions
   */
  getNearbyPromotions: async (
    latitude: number,
    longitude: number,
    radius: number = 1
  ): Promise<Promotion[]> => {
    try {
      const response = await api.get<Promotion[]>('/promotions/nearby', {
        params: { latitude, longitude, radius },
      });
      return response.data;
    } catch (error: any) {
      console.error('[PromotionService] Error getting nearby promotions:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors du chargement des promotions'
      );
    }
  },

  /**
   * Get promotions from user's favorite epiceries only
   *
   * @returns List of promotions from favorite epiceries
   */
  getFavoriteEpiceriesPromotions: async (): Promise<Promotion[]> => {
    try {
      const response = await api.get<Promotion[]>('/promotions/favorites');
      return response.data;
    } catch (error: any) {
      console.error(
        '[PromotionService] Error getting favorite epiceries promotions:',
        error
      );
      throw (
        error.response?.data?.message ||
        'Erreur lors du chargement des promotions'
      );
    }
  },

  /**
   * Get all currently active promotions
   * No filtering applied - returns all available promotions
   *
   * @returns List of all active promotions
   */
  getAllActivePromotions: async (): Promise<Promotion[]> => {
    try {
      const response = await api.get<Promotion[]>('/promotions/all');
      return response.data;
    } catch (error: any) {
      console.error(
        '[PromotionService] Error getting all active promotions:',
        error
      );
      throw (
        error.response?.data?.message ||
        'Erreur lors du chargement des promotions'
      );
    }
  },

  // ============================================
  // EPICIER MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Get all promotions for the current epicier's store
   *
   * @returns List of promotions for the store
   */
  getMyPromotions: async (): Promise<Promotion[]> => {
    try {
      const response = await api.get<Promotion[]>('/promotions/my-store');
      return response.data;
    } catch (error: any) {
      console.error('[PromotionService] Error getting my promotions:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors du chargement de vos promotions'
      );
    }
  },

  /**
   * Get a single promotion by ID
   *
   * @param id Promotion ID
   * @returns Promotion details
   */
  getPromotionById: async (id: number): Promise<Promotion> => {
    try {
      const response = await api.get<Promotion>(`/promotions/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('[PromotionService] Error getting promotion by ID:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors du chargement de la promotion'
      );
    }
  },

  /**
   * Create a new promotion
   *
   * @param data Promotion data
   * @returns Created promotion
   */
  createPromotion: async (data: CreatePromotionRequest): Promise<Promotion> => {
    try {
      const response = await api.post<Promotion>('/promotions', data);
      return response.data;
    } catch (error: any) {
      console.error('[PromotionService] Error creating promotion:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors de la création de la promotion'
      );
    }
  },

  /**
   * Update an existing promotion
   *
   * @param id Promotion ID
   * @param data Updated promotion data
   * @returns Updated promotion
   */
  updatePromotion: async (
    id: number,
    data: UpdatePromotionRequest
  ): Promise<Promotion> => {
    try {
      const response = await api.put<Promotion>(`/promotions/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('[PromotionService] Error updating promotion:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors de la mise à jour de la promotion'
      );
    }
  },

  /**
   * Delete a promotion
   *
   * @param id Promotion ID
   */
  deletePromotion: async (id: number): Promise<void> => {
    try {
      await api.delete(`/promotions/${id}`);
    } catch (error: any) {
      console.error('[PromotionService] Error deleting promotion:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors de la suppression de la promotion'
      );
    }
  },

  /**
   * Toggle promotion active status
   *
   * @param id Promotion ID
   * @param isActive New active status
   * @returns Updated promotion
   */
  togglePromotionStatus: async (
    id: number,
    isActive: boolean
  ): Promise<Promotion> => {
    try {
      const response = await api.put<Promotion>(
        `/promotions/${id}/toggle?isActive=${isActive}`
      );
      return response.data;
    } catch (error: any) {
      console.error('[PromotionService] Error toggling promotion status:', error);
      throw (
        error.response?.data?.message ||
        'Erreur lors de la mise à jour du statut'
      );
    }
  },
};
