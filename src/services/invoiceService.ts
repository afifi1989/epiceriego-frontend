import api from './api';
import { Invoice, InvoiceCreateRequest } from '../type';

/**
 * Invoice Service
 * Handles all operations related to invoices, billing, and payment status tracking
 */
export const invoiceService = {
  /**
   * Get all invoices for an epicerie (epicier view)
   * @param epicerieId ID of the epicerie
   * @param status Optional filter by status (PAID/UNPAID)
   * @param page Page number (0-indexed)
   * @param size Items per page
   * @returns List of invoices
   */
  getEpicerieInvoices: async (
    epicerieId: number,
    status?: 'PAID' | 'UNPAID',
    page: number = 0,
    size: number = 20
  ): Promise<Invoice[]> => {
    try {
      const params: any = { page, size };
      if (status) {
        params.status = status;
      }

      const response = await api.get<any>(
        `/epiceries/${epicerieId}/invoices`,
        { params }
      );

      return response.data.content || response.data || [];
    } catch (error: any) {
      console.error('[InvoiceService] Error getting epicerie invoices:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des factures';
    }
  },

  /**
   * Get all invoices for a specific client of an epicerie
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns List of invoices
   */
  getClientInvoices: async (
    epicerieId: number,
    clientId: number
  ): Promise<Invoice[]> => {
    try {
      const response = await api.get<Invoice[]>(
        `/epiceries/${epicerieId}/clients/${clientId}/invoices`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[InvoiceService] Error getting client invoices:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des factures du client';
    }
  },

  /**
   * Get invoice details
   * @param invoiceId ID of the invoice
   * @returns Invoice details
   */
  getInvoiceDetails: async (invoiceId: number): Promise<Invoice> => {
    try {
      const response = await api.get<Invoice>(`/invoices/${invoiceId}`);
      return response.data;
    } catch (error: any) {
      console.error('[InvoiceService] Error getting invoice details:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de la facture';
    }
  },

  /**
   * Get unpaid invoices for the current client
   * @returns List of unpaid invoices
   */
  getMyUnpaidInvoices: async (): Promise<Invoice[]> => {
    try {
      const response = await api.get<Invoice[]>('/invoices/my-unpaid');
      return response.data || [];
    } catch (error: any) {
      console.error('[InvoiceService] Error getting my unpaid invoices:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de vos factures impayées';
    }
  },

  /**
   * Get invoice history for the current client
   * @returns List of all invoices
   */
  getMyInvoiceHistory: async (): Promise<Invoice[]> => {
    try {
      const response = await api.get<Invoice[]>('/invoices/my-history');
      return response.data || [];
    } catch (error: any) {
      console.error('[InvoiceService] Error getting my invoice history:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de votre historique de factures';
    }
  },

  /**
   * Mark an invoice as paid
   * @param invoiceId ID of the invoice
   * @param paymentReference Payment reference or transaction ID
   * @returns Updated invoice
   */
  markInvoiceAsPaid: async (
    invoiceId: number,
    paymentReference: string
  ): Promise<Invoice> => {
    try {
      const response = await api.put<Invoice>(
        `/invoices/${invoiceId}/mark-paid`,
        { paymentReference }
      );
      return response.data;
    } catch (error: any) {
      console.error('[InvoiceService] Error marking invoice as paid:', error.message);
      throw error.response?.data?.message || 'Erreur lors du marquage de la facture comme payée';
    }
  },

  /**
   * Create a new invoice
   * @param invoiceData Invoice creation data
   * @returns Created invoice
   */
  createInvoice: async (invoiceData: InvoiceCreateRequest): Promise<Invoice> => {
    try {
      const response = await api.post<Invoice>('/invoices', invoiceData);
      return response.data;
    } catch (error: any) {
      console.error('[InvoiceService] Error creating invoice:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la création de la facture';
    }
  },

  /**
   * Get invoice statistics for an epicerie
   * @param epicerieId ID of the epicerie
   * @returns Invoice statistics
   */
  getInvoiceStats: async (
    epicerieId: number
  ): Promise<{
    totalUnpaid: number;
    totalPaid: number;
    overdue: number;
    averageDaysOverdue: number;
    totalClients: number;
  }> => {
    try {
      const response = await api.get<any>(
        `/epiceries/${epicerieId}/invoices/stats`
      );
      return response.data;
    } catch (error: any) {
      console.error('[InvoiceService] Error getting invoice stats:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des statistiques';
    }
  },

  /**
   * Get overdue invoices for an epicerie
   * @param epicerieId ID of the epicerie
   * @param daysOverdue Number of days overdue (default: all)
   * @returns List of overdue invoices
   */
  getOverdueInvoices: async (
    epicerieId: number,
    daysOverdue?: number
  ): Promise<Invoice[]> => {
    try {
      const params: any = {};
      if (daysOverdue) {
        params.daysOverdue = daysOverdue;
      }

      const response = await api.get<Invoice[]>(
        `/epiceries/${epicerieId}/invoices/overdue`,
        { params }
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[InvoiceService] Error getting overdue invoices:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des factures en retard';
    }
  },

  /**
   * Get invoices by date range for an epicerie
   * @param epicerieId ID of the epicerie
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @returns List of invoices in date range
   */
  getInvoicesByDateRange: async (
    epicerieId: number,
    startDate: string,
    endDate: string
  ): Promise<Invoice[]> => {
    try {
      const response = await api.get<Invoice[]>(
        `/epiceries/${epicerieId}/invoices/by-date`,
        { params: { startDate, endDate } }
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[InvoiceService] Error getting invoices by date range:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des factures par période';
    }
  },

  /**
   * Get total amount due by all clients for an epicerie
   * @param epicerieId ID of the epicerie
   * @returns Total amount due
   */
  getTotalAmountDue: async (epicerieId: number): Promise<number> => {
    try {
      const response = await api.get<{ totalAmountDue: number }>(
        `/epiceries/${epicerieId}/invoices/total-due`
      );
      return response.data.totalAmountDue || 0;
    } catch (error: any) {
      console.error('[InvoiceService] Error getting total amount due:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération du montant total dû';
    }
  },
};
