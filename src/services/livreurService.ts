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
   * Récupère une livraison (passe le statut à IN_DELIVERY)
   * C'est quand le livreur récupère la commande en épicerie
   */
  startDelivery: async (orderId: number): Promise<Delivery> => {
    try {
      console.log('[LivreurService] 🚚 Démarrage de la livraison pour la commande:', orderId);
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/start`);
      console.log('[LivreurService] ✅ Livraison démarrée');
      return response.data;
    } catch (error: any) {
      console.error('[LivreurService] ❌ Erreur démarrage livraison:', error);
      throw error.response?.data?.message || 'Erreur lors du démarrage de la livraison';
    }
  },

  /**
   * Complète une livraison (passe le statut à DELIVERED)
   * C'est quand le livreur livre la commande au client à domicile
   * OU quand le livreur récupère une commande pour retrait en épicerie
   */
  completeDelivery: async (orderId: number): Promise<Delivery> => {
    try {
      console.log('[LivreurService] ✅ Complétude de la livraison pour la commande:', orderId);
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/complete`);
      console.log('[LivreurService] ✅ Livraison complétée');
      return response.data;
    } catch (error: any) {
      console.error('[LivreurService] ❌ Erreur complétude livraison:', error);
      throw error.response?.data?.message || 'Erreur lors de la complétude de la livraison';
    }
  },
};