import api from './api';
import { Order } from '../type';

/**
 * Service pour la préparation des commandes article par article
 */
export const orderPreparationService = {
  /**
   * Marque un article comme indisponible
   */
  markItemUnavailable: async (orderId: number, itemId: number): Promise<Order> => {
    try {
      const response = await api.patch<Order>(
        `/orders/${orderId}/items/${itemId}/unavailable`
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du marquage de l\'article';
    }
  },

  /**
   * Marque un article comme complété
   */
  markItemComplete: async (orderId: number, itemId: number): Promise<Order> => {
    try {
      const response = await api.patch<Order>(
        `/orders/${orderId}/items/${itemId}/complete`
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la complétion de l\'article';
    }
  },

  /**
   * Met à jour la quantité réelle d'un article (pour produits au poids)
   */
  updateItemQuantity: async (
    orderId: number,
    itemId: number,
    quantityActual: number
  ): Promise<Order> => {
    try {
      const response = await api.put<Order>(
        `/orders/${orderId}/items/${itemId}`,
        { quantityActual }
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la mise à jour de la quantité';
    }
  },

  /**
   * Scanner un produit par code-barres
   */
  scanProduct: async (orderId: number, barcode: string): Promise<Order> => {
    try {
      const response = await api.post<Order>(
        `/orders/${orderId}/scan`,
        { barcode }
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Produit non trouvé dans la commande';
    }
  },

  /**
   * Complète la préparation de toute la commande (passe en READY)
   */
  completeOrderPreparation: async (orderId: number): Promise<Order> => {
    try {
      const response = await api.post<Order>(`/orders/${orderId}/complete`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la finalisation de la commande';
    }
  },
};
