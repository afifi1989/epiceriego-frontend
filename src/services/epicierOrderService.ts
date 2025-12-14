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

export interface OrderDetailDTO {
  id: number;
  orderNumber: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  totalItems: number;
  totalAmount: number;
  status: 'NEW' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
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
  status: 'NEW' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
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
   * Mark item as unavailable
   */
  async markItemUnavailable(orderId: number, itemId: number) {
    try {
      const response = await api.patch(
        `/orders/${orderId}/items/${itemId}/unavailable`
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
   * Get new orders
   */
  async getNewOrders(page = 0, size = 20) {
    return this.getOrders('NEW', page, size);
  }
}

export default new EpicierOrderService();
