import api from './api';
import { CreateOrderRequest, Order, DeliveryInfo, UpdateDeliveryInfoRequest } from '../type';

export const orderService = {
  /**
   * Crée une nouvelle commande
   */
  createOrder: async (orderData: CreateOrderRequest): Promise<Order> => {
    try {
      console.log('[OrderService] Envoi de la commande au serveur...');
      console.log('[OrderService] Données formatées:', JSON.stringify(orderData, null, 2));

      const response = await api.post<Order>('/orders', orderData);

      console.log('[OrderService] Réponse reçue avec succès');
      console.log('[OrderService] Réponse:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      console.error('[OrderService] Erreur lors de la création');
      console.error('[OrderService] Status HTTP:', error.response?.status);
      console.error('[OrderService] Message backend:', error.response?.data);
      console.error('[OrderService] Config request:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        data: error.config?.data,
      });

      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la création de la commande';
      throw errorMessage;
    }
  },

  /**
   * Récupère les commandes du client connecté
   */
  getMyOrders: async (): Promise<Order[]> => {
    try {
      const response = await api.get<Order[]>('/orders/my-orders');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Récupère les commandes de l'épicerie de l'épicier connecté
   */
  getEpicerieOrders: async (status?: string): Promise<Order[]> => {
    try {
      const params = status ? { status } : {};
      const response = await api.get<Order[]>('/orders/epicerie/my-orders', { params });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Récupère une commande par son ID
   */
  getOrderById: async (id: number): Promise<Order> => {
    try {
      const response = await api.get<Order>(`/orders/${id}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Commande non trouvée';
    }
  },

  /**
   * Met à jour le statut d'une commande
   */
  updateOrderStatus: async (id: number, status: string): Promise<Order> => {
    try {
      const response = await api.put<Order>(`/orders/${id}/status`, { status });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Annule une commande
   */
  cancelOrder: async (id: number): Promise<Order> => {
    try {
      const response = await api.put<Order>(`/orders/${id}/cancel`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Impossible d\'annuler cette commande';
    }
  },

  /**
   * Récupère les informations de livraison par défaut du client
   */
  getDefaultDeliveryInfo: async (): Promise<DeliveryInfo> => {
    try {
      const response = await api.get<DeliveryInfo>('/orders/delivery-info/default');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la récupération des informations de livraison';
    }
  },

  /**
   * Récupère les informations de livraison d'une commande
   */
  getDeliveryInfo: async (orderId: number): Promise<DeliveryInfo> => {
    try {
      const response = await api.get<DeliveryInfo>(`/orders/${orderId}/delivery-info`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la récupération des informations de livraison';
    }
  },

  /**
   * Met à jour les informations de livraison d'une commande
   */
  updateDeliveryInfo: async (orderId: number, data: UpdateDeliveryInfoRequest): Promise<DeliveryInfo> => {
    try {
      const response = await api.put<DeliveryInfo>(`/orders/${orderId}/delivery-info`, data);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la mise à jour des informations de livraison';
    }
  },

  /**
   * Met à jour le statut d'une commande
   */
  updateOrderStatus: async (orderId: number, status: string): Promise<Order> => {
    try {
      console.log(`[OrderService] Mise à jour du statut de la commande ${orderId} à ${status}`);
      const response = await api.put<Order>(`/orders/${orderId}/status`, { status });
      console.log('[OrderService] ✅ Statut mis à jour avec succès');
      return response.data;
    } catch (error: any) {
      console.error('[OrderService] ❌ Erreur lors de la mise à jour du statut:', error);
      throw error.response?.data?.message || 'Erreur lors de la mise à jour du statut';
    }
  },
};
