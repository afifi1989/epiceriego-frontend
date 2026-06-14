/**
 * Order service for epicier (shop owner)
 * Handles order preparation and management
 */

import api from './api';

export interface OrderItem {
  id: number;
  productId: number;
  productNom: string;
  quantityCommanded: number;
  quantityActual: number;
  uniteVente: string;
  prix: number;
  status: 'PENDING' | 'SCANNED' | 'UNAVAILABLE' | 'MODIFIED';
  barcode?: string;
}

export type RefundStatus = 'DRAFT' | 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'CANCELLED';

export interface RefundItem {
  id: number;
  orderItemId: number | null;
  kind: 'ITEM' | 'DELIVERY_FEE';
  label: string;
  amount: number;
  note?: string | null;
}

export interface Refund {
  id: number;
  orderId: number;
  clientId: number;
  paymentMethod: 'CARD' | 'MOBILE' | 'CLIENT_ACCOUNT';
  currencyCode: string;
  totalAmount: number;
  status: RefundStatus;
  settlementMethod?: string | null;
  externalReference?: string | null;
  reason?: string | null;
  finalizedAt?: string | null;
  processedAt?: string | null;
  items: RefundItem[];
}

export interface OrderDetailDTO {
  id: number;
  orderNumber: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  totalItems: number;
  totalAmount: number;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'IN_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  source?: 'APP' | 'WEB' | 'WHATSAPP' | 'DIRECT_SALE';
  items: OrderItem[];
  createdAt: string;
  notes?: string;
}

export interface OrderListDTO {
  id: number;
  orderNumber: string;
  clientName: string;
  totalItems: number;
  totalAmount: number;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'IN_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  source?: 'APP' | 'WEB' | 'WHATSAPP' | 'DIRECT_SALE';
  createdAt: string;
}

class EpicierOrderService {
  /**
   * Get orders for current epicerie with status filter
   */
  async getOrders(status?: string, page = 0, size = 20) {
    try {
      const response = await api.get('/orders/epicerie/my-orders', {
        params: {
          ...(status && { status }),
          page,
          size,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  /**
   * Get order details by ID
   */
  async getOrderDetails(orderId: number): Promise<OrderDetailDTO> {
    try {
      const response = await api.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string) {
    try {
      const response = await api.put(`/orders/${orderId}/status`, {
        status,
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating order ${orderId} status:`, error);
      throw error;
    }
  }

  /**
   * Record product scan for order
   */
  async recordProductScan(orderId: number, barcode: string) {
    try {
      const response = await api.post(`/orders/${orderId}/scan`, {
        barcode,
      });
      return response.data;
    } catch (error) {
      console.error(`Error recording scan for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Update scanned quantity for weight/volume products
   */
  async updateScannedQuantity(
    orderId: number,
    itemId: number,
    actualQuantity: number
  ) {
    try {
      const response = await api.put(`/orders/${orderId}/items/${itemId}`, {
        quantityActual: actualQuantity,
      });
      return response.data;
    } catch (error) {
      console.error(
        `Error updating quantity for order ${orderId}, item ${itemId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Mark item as unavailable.
   * @param message Mot optionnel de l'épicier au client (raison de l'indisponibilité).
   *   Le backend notifie le client et, si la commande est pré-payée / à crédit,
   *   enregistre une ligne de remboursement. Si TOUS les articles deviennent
   *   indisponibles, la commande renvoyée a le statut CANCELLED.
   */
  async markItemUnavailable(orderId: number, itemId: number, message?: string) {
    try {
      const response = await api.patch(
        `/orders/${orderId}/items/${itemId}/unavailable`,
        message ? { message } : {}
      );
      return response.data;
    } catch (error) {
      console.error(
        `Error marking item unavailable for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Récupère le remboursement d'une commande (null si aucun).
   */
  async getOrderRefund(orderId: number): Promise<Refund | null> {
    try {
      const response = await api.get<Refund | null>(`/orders/${orderId}/refund`);
      return response.data ?? null;
    } catch (error) {
      console.error(`Error fetching refund for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * V116 — Force le statut LIVRÉ sur une commande IN_DELIVERY / DELIVERY_FAILED
   * (remise en main propre hors app, livreur injoignable…). Toujours tracé.
   */
  async forceDelivered(orderId: number, reason?: string) {
    try {
      const response = await api.put(`/orders/${orderId}/delivery/force-delivered`, { reason });
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message || 'Action impossible';
    }
  }

  /**
   * Valide et règle le remboursement (action épicier).
   * @param reference Obligatoire pour un paiement carte/mobile (réf. du reversal).
   */
  async processOrderRefund(orderId: number, reference?: string): Promise<Refund> {
    try {
      const response = await api.put<Refund>(
        `/orders/${orderId}/refund/process`,
        reference ? { reference } : {}
      );
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message || 'Impossible d\'effectuer le remboursement';
    }
  }

  /**
   * Mark individual item as complete
   */
  async markItemComplete(orderId: number, itemId: number) {
    try {
      const response = await api.patch(
        `/orders/${orderId}/items/${itemId}/complete`
      );
      return response.data;
    } catch (error) {
      console.error(
        `Error marking item complete for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Complete order preparation
   */
  async completeOrder(orderId: number, notes?: string) {
    try {
      const response = await api.post(`/orders/${orderId}/complete`, {
        notes,
      });
      return response.data;
    } catch (error) {
      console.error(`Error completing order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get orders pending preparation
   */
  async getPendingOrders(page = 0, size = 20) {
    return this.getOrders('PREPARING', page, size);
  }

  /**
   * Get new orders (nouvelles commandes en attente d'acceptation par l'épicier).
   * Le backend ne connaît pas le statut 'NEW' (enum = PENDING/ACCEPTED/…) et
   * renvoyait un 400 « Statut invalide » : on interroge bien 'PENDING'.
   */
  async getNewOrders(page = 0, size = 20) {
    return this.getOrders('PENDING', page, size);
  }
}

export default new EpicierOrderService();
