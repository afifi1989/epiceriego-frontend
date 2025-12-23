import api from './api';
import { Payment, PaymentCreateRequest } from '../type';

/**
 * Credit Payment Service
 * Handles advances, credit payments, and balance management
 */
export const creditPaymentService = {
  /**
   * Record an advance payment (prepayment by client)
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @param amount Amount of the advance
   * @param paymentMethod Method of payment (CASH/CARD/TRANSFER)
   * @param notes Optional notes
   * @returns Created advance payment
   */
  recordAdvancePayment: async (
    epicerieId: number,
    clientId: number,
    amount: number,
    paymentMethod: string = 'CASH',
    notes?: string
  ): Promise<Payment> => {
    try {
      const response = await api.post<Payment>(
        `/epiceries/${epicerieId}/payments/advance`,
        {
          clientId,
          amount,
          paymentMethod,
          reference: notes,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error recording advance:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'enregistrement de l\'avance';
    }
  },

  /**
   * Get advance payment history for a client at an epicerie
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns List of advance payments
   */
  getClientAdvances: async (
    epicerieId: number,
    clientId: number
  ): Promise<{
    totalAdvances: number;
    availableBalance: number;
    usedBalance: number;
    transactions: Payment[];
  }> => {
    try {
      const response = await api.get<any>(
        `/epiceries/${epicerieId}/clients/${clientId}/advances`
      );
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error getting client advances:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des avances';
    }
  },

  /**
   * Get my advances as a client
   * @returns Advance information
   */
  getMyAdvances: async (): Promise<{
    totalAdvances: number;
    availableBalance: number;
    usedBalance: number;
    byStore: {
      epicerieId: number;
      epicerieName: string;
      totalAdvances: number;
      availableBalance: number;
      usedBalance: number;
    }[];
  }> => {
    try {
      const response = await api.get<any>('/payments/my-advances');
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error getting my advances:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de vos avances';
    }
  },

  /**
   * Pay an invoice using cash or advance
   * @param invoiceId ID of the invoice to pay
   * @param amount Amount to pay
   * @param paymentMethod CASH or ADVANCE
   * @param reference Optional payment reference
   * @returns Payment record
   */
  payInvoice: async (
    invoiceId: number,
    amount: number,
    paymentMethod: 'CASH' | 'ADVANCE',
    reference?: string
  ): Promise<Payment> => {
    try {
      const response = await api.post<Payment>(
        `/invoices/${invoiceId}/pay`,
        {
          amount,
          paymentMethod,
          reference,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error paying invoice:', error.message);
      throw error.response?.data?.message || 'Erreur lors du paiement de la facture';
    }
  },

  /**
   * Record a credit payment from an epicier (admin operation)
   * Marks an invoice as paid when cash payment is received
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @param amount Amount received
   * @param notes Optional payment notes
   * @returns Payment record
   */
  recordCreditPayment: async (
    epicerieId: number,
    clientId: number,
    amount: number,
    notes?: string
  ): Promise<Payment> => {
    try {
      const response = await api.post<Payment>(
        `/epiceries/${epicerieId}/clients/${clientId}/payments/record`,
        {
          amount,
          notes,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error recording credit payment:', error.message);
      throw error.response?.data?.message || 'Erreur lors de l\'enregistrement du paiement';
    }
  },

  /**
   * Get all payments for a client at an epicerie
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns List of payments
   */
  getClientPaymentHistory: async (
    epicerieId: number,
    clientId: number
  ): Promise<Payment[]> => {
    try {
      const response = await api.get<Payment[]>(
        `/epiceries/${epicerieId}/clients/${clientId}/payments`
      );
      return response.data || [];
    } catch (error: any) {
      console.error('[CreditPaymentService] Error getting client payment history:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de l\'historique des paiements';
    }
  },

  /**
   * Get my payment history as a client
   * @returns List of payments
   */
  getMyPaymentHistory: async (): Promise<Payment[]> => {
    try {
      const response = await api.get<Payment[]>('/payments/my-history');
      return response.data || [];
    } catch (error: any) {
      console.error('[CreditPaymentService] Error getting my payment history:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération de votre historique de paiements';
    }
  },

  /**
   * Get total amount of advances for a client
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @returns Total amount of advances
   */
  getClientTotalAdvances: async (
    epicerieId: number,
    clientId: number
  ): Promise<number> => {
    try {
      const response = await api.get<{ totalAdvances: number }>(
        `/epiceries/${epicerieId}/clients/${clientId}/advances/total`
      );
      return response.data.totalAdvances || 0;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error getting client total advances:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération du total des avances';
    }
  },

  /**
   * Create a generic payment record
   * @param paymentData Payment creation data
   * @returns Created payment
   */
  createPayment: async (paymentData: PaymentCreateRequest): Promise<Payment> => {
    try {
      const response = await api.post<Payment>('/payments', paymentData);
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error creating payment:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la création du paiement';
    }
  },

  /**
   * Get payment statistics for an epicerie
   * @param epicerieId ID of the epicerie
   * @returns Payment statistics
   */
  getPaymentStats: async (
    epicerieId: number
  ): Promise<{
    totalPayments: number;
    totalAdvances: number;
    averagePaymentAmount: number;
    lastPaymentDate: string;
  }> => {
    try {
      const response = await api.get<any>(
        `/epiceries/${epicerieId}/payments/stats`
      );
      return response.data;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error getting payment stats:', error.message);
      throw error.response?.data?.message || 'Erreur lors de la récupération des statistiques de paiement';
    }
  },

  /**
   * Check if a client has enough advance balance for an order
   * @param epicerieId ID of the epicerie
   * @param clientId ID of the client
   * @param amount Amount needed
   * @returns Whether client has sufficient balance
   */
  hasEnoughAdvanceBalance: async (
    epicerieId: number,
    clientId: number,
    amount: number
  ): Promise<boolean> => {
    try {
      const response = await api.get<{ hasEnough: boolean }>(
        `/epiceries/${epicerieId}/clients/${clientId}/advances/check`,
        { params: { amount } }
      );
      return response.data.hasEnough || false;
    } catch (error: any) {
      console.error('[CreditPaymentService] Error checking advance balance:', error.message);
      return false;
    }
  },
};
