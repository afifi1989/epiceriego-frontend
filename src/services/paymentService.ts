import api from './api';
import { CardPaymentDetails, SavedPaymentMethod } from '../type';

export const paymentService = {
  /**
   * Récupère les méthodes de paiement enregistrées du client
   */
  getSavedPaymentMethods: async (): Promise<SavedPaymentMethod[]> => {
    try {
      console.log('[PaymentService] Récupération des cartes enregistrées...');
      const response = await api.get<SavedPaymentMethod[]>('/payments/saved-methods');
      console.log('[PaymentService] Cartes reçues:', response.data.length);
      return response.data;
    } catch (error: any) {
      console.warn('[PaymentService] Impossible de récupérer les cartes (endpoint non disponible)');
      // Retourner une liste vide si l'endpoint n'existe pas encore
      return [];
    }
  },

  /**
   * Récupère la méthode de paiement par défaut
   */
  getDefaultPaymentMethod: async (): Promise<SavedPaymentMethod | null> => {
    try {
      console.log('[PaymentService] Récupération de la carte par défaut...');
      const response = await api.get<SavedPaymentMethod>('/payments/default-method');
      console.log('[PaymentService] Carte par défaut reçue');
      return response.data;
    } catch (error: any) {
      console.warn('[PaymentService] Pas de carte par défaut trouvée');
      return null;
    }
  },

  /**
   * Enregistre une nouvelle méthode de paiement par carte.
   *
   * SÉCURITÉ (PCI-DSS) : l'application ne doit JAMAIS transporter ni stocker un
   * PAN / CVV en clair. Tant qu'aucune passerelle de tokenisation (Stripe, CMI…)
   * n'est intégrée, l'enregistrement de carte est désactivé — on ne manipule pas
   * de données bancaires brutes côté client.
   */
  savePaymentMethod: async (_cardDetails: CardPaymentDetails, _setAsDefault: boolean = false): Promise<SavedPaymentMethod> => {
    console.warn('[PaymentService] Enregistrement de carte désactivé (aucune passerelle de tokenisation sécurisée).');
    throw 'L\'enregistrement de carte est momentanément indisponible : le paiement sécurisé par carte n\'est pas encore activé.';
  },

  /**
   * Définit une méthode de paiement comme défaut
   */
  setDefaultPaymentMethod: async (paymentMethodId: number): Promise<SavedPaymentMethod> => {
    try {
      console.log('[PaymentService] Définition de la carte', paymentMethodId, 'comme défaut');
      const response = await api.put<SavedPaymentMethod>(`/payments/${paymentMethodId}/set-default`);
      console.log('[PaymentService] Carte définie comme défaut');
      return response.data;
    } catch (error: any) {
      console.warn('[PaymentService] Impossible de définir comme défaut (endpoint non disponible)');
      throw error.response?.data?.message || 'Erreur lors de la mise à jour';
    }
  },

  /**
   * Supprime une méthode de paiement enregistrée
   */
  deletePaymentMethod: async (paymentMethodId: number): Promise<void> => {
    try {
      console.log('[PaymentService] Suppression de la carte', paymentMethodId);
      await api.delete(`/payments/${paymentMethodId}`);
      console.log('[PaymentService] Carte supprimée');
    } catch (error: any) {
      console.warn('[PaymentService] Impossible de supprimer (endpoint non disponible)');
      // Continuer même si l'endpoint n'existe pas
    }
  },

  /**
   * Traite un paiement par nouvelle carte.
   *
   * SÉCURITÉ (PCI-DSS) : envoyer PAN + CVV en clair vers un endpoint maison est
   * proscrit. Tant qu'aucune passerelle de tokenisation n'est intégrée, le
   * paiement par saisie de carte est désactivé — on ne transmet pas de données
   * bancaires brutes.
   */
  processCardPayment: async (_cardDetails: CardPaymentDetails, _amount: number, _orderId?: number): Promise<{ success: boolean; transactionId: string }> => {
    console.warn('[PaymentService] Paiement par nouvelle carte désactivé (aucune passerelle de tokenisation sécurisée).');
    throw 'Le paiement par carte n\'est pas encore disponible. Choisissez un autre mode de paiement.';
  },

  /**
   * Utilise une carte enregistrée pour payer
   */
  processPaymentWithSavedCard: async (paymentMethodId: number, amount: number, orderId?: number): Promise<{ success: boolean; transactionId: string }> => {
    try {
      console.log('[PaymentService] Traitement du paiement avec carte enregistrée');
      console.log('[PaymentService] Carte ID:', paymentMethodId);
      console.log('[PaymentService] Montant:', amount, 'DH');
      console.log('[PaymentService] Commande ID:', orderId);

      const response = await api.post<{ success: boolean; transactionId: string }>('/payments/process-saved', {
        paymentMethodId,
        amount,
        orderId,
      });

      console.log('[PaymentService] Paiement réussi, transaction ID:', response.data.transactionId);
      return response.data;
    } catch (error: any) {
      console.error('[PaymentService] Erreur paiement:', error.message);
      // Le backend est la source de vérité du statut de paiement : on ne
      // fabrique JAMAIS un faux succès. On propage l'échec pour que la
      // commande reste impayée côté caller.
      throw error.response?.data?.message || error.message || 'Le paiement a échoué. Aucun débit n\'a été effectué.';
    }
  },
};
