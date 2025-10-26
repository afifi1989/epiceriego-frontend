import api from './api';
import { Delivery } from '../type';

export const livreurService = {
  /**
   * Récupère les livraisons du livreur connecté
   */
  getMyDeliveries: async (status?: string): Promise<Delivery[]> => {
    try {
      const params = status ? { status } : {};
      const response = await api.get<Delivery[]>('/livreurs/my-deliveries', { params });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Met à jour la disponibilité du livreur
   */
  updateAvailability: async (
    isAvailable: boolean, 
    latitude?: number, 
    longitude?: number
  ): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>('/livreurs/availability', {
        isAvailable,
        latitude,
        longitude,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Met à jour la position GPS du livreur
   */
  updateLocation: async (latitude: number, longitude: number): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>('/livreurs/location', {
        latitude,
        longitude,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Démarre une livraison
   */
  startDelivery: async (orderId: number): Promise<Delivery> => {
    try {
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/start`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Marque une livraison comme terminée
   */
  completeDelivery: async (orderId: number): Promise<Delivery> => {
    try {
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/complete`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },
};