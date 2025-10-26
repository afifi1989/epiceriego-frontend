import api from './api';
import { CreateOrderRequest, Order } from '../type';

export const orderService = {
  /**
   * Crée une nouvelle commande
   */
  createOrder: async (orderData: CreateOrderRequest): Promise<Order> => {
    try {
      const response = await api.post<Order>('/orders', orderData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la création de la commande';
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
};
