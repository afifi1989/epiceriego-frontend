import api from './api';
import { RechargeTransaction } from '../type';

/**
 * Service pour l'exécution des recharges téléphoniques
 */
export const rechargeService = {
  /**
   * Exécuter une recharge pour un OrderItem
   */
  executeRecharge: async (orderItemId: number): Promise<RechargeTransaction> => {
    try {
      const response = await api.post<RechargeTransaction>(
        `/epicier/telecom/order-item/${orderItemId}/execute`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur lors de l\'exécution de la recharge';
      throw new Error(message);
    }
  },

  /**
   * Obtenir le statut de la recharge pour un OrderItem
   */
  getRechargeStatus: async (orderItemId: number): Promise<{
    hasTransaction: boolean;
    status: string;
    transaction?: RechargeTransaction;
  }> => {
    try {
      const response = await api.get(
        `/epicier/telecom/order-item/${orderItemId}/status`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Erreur lors de la récupération du statut'
      );
    }
  },

  /**
   * Réessayer une recharge échouée
   */
  retryRecharge: async (transactionId: number): Promise<RechargeTransaction> => {
    try {
      const response = await api.post<RechargeTransaction>(
        `/epicier/telecom/transaction/${transactionId}/retry`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Erreur lors du réessai de la recharge'
      );
    }
  },
};
