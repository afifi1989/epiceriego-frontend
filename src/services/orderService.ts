import api from './api';
import { CreateOrderRequest, Order, DeliveryInfo, UpdateDeliveryInfoRequest, QrTokenResponse, QrValidateResponse } from '../type';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, API_CONFIG } from '../constants/config';

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
   * Récupère (ou génère) le token QR d'une commande (client uniquement)
   */
  getQrToken: async (orderId: number): Promise<QrTokenResponse> => {
    try {
      const response = await api.get<QrTokenResponse>(`/orders/${orderId}/qr-token`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Impossible de récupérer le QR Code';
    }
  },

  /**
   * Valide un QR Code scanné (épicier pour PICKUP, livreur pour HOME_DELIVERY)
   */
  validateQrCode: async (qrToken: string): Promise<QrValidateResponse> => {
    try {
      const response = await api.post<QrValidateResponse>('/orders/qr/validate', { qrToken });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'QR Code invalide';
    }
  },

  /**
   * Vente directe en magasin (Point of Sale).
   * Crée une commande immédiatement DELIVERED + PICKUP pour un client présent.
   */
  createDirectSale: async (payload: {
    clientId: number;
    items: { productId: number; unitId?: number; quantite: number; requestedQuantity?: number }[];
    paymentMethod: 'CASH' | 'CARD' | 'CLIENT_ACCOUNT';
    notes?: string;
  }): Promise<Order> => {
    try {
      const response = await api.post<Order>('/orders/direct-sale', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la vente directe');
    }
  },

  /**
   * Envoie le reçu d'une commande par email au client.
   */
  sendReceiptByEmail: async (orderId: number): Promise<void> => {
    try {
      await api.post(`/orders/${orderId}/send-receipt`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Impossible d\'envoyer le reçu par email');
    }
  },

  /**
   * Télécharge la facture PDF d'une commande (READY ou DELIVERED).
   * Sauvegarde le fichier localement et retourne l'URI local.
   */
  downloadInvoicePdf: async (orderId: number): Promise<string> => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) throw new Error('Non authentifié');

    const fileUri = FileSystem.documentDirectory + `facture-FAC-${String(orderId).padStart(6, '0')}.pdf`;

    const result = await FileSystem.downloadAsync(
      `${API_CONFIG.BASE_URL}/orders/${orderId}/invoice/download`,
      fileUri,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!result || result.status !== 200) {
      throw new Error('Impossible de télécharger la facture');
    }

    return result.uri;
  },
};
