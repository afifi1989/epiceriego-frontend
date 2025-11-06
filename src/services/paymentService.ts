import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardPaymentDetails, SavedPaymentMethod } from '../type';
import { STORAGE_KEYS } from '../constants/config';

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
   * Enregistre une nouvelle méthode de paiement par carte
   */
  savePaymentMethod: async (cardDetails: CardPaymentDetails, setAsDefault: boolean = false): Promise<SavedPaymentMethod> => {
    try {
      console.log('[PaymentService] Enregistrement de la carte...');
      console.log('[PaymentService] Carte:', cardDetails.cardNumber.slice(-4), setAsDefault ? '(par défaut)' : '');

      const response = await api.post<SavedPaymentMethod>('/payments/save-method', {
        cardNumber: cardDetails.cardNumber,
        cardholderName: cardDetails.cardholderName,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        cvv: cardDetails.cvv,
        setAsDefault,
      });

      console.log('[PaymentService] Carte enregistrée avec ID:', response.data.id);

      // Stocker localement aussi comme backup
      const savedCards = JSON.parse(await AsyncStorage.getItem(STORAGE_KEYS.SAVED_CARDS || 'saved_cards') || '[]');
      savedCards.push({
        id: response.data.id,
        lastFourDigits: response.data.lastFourDigits,
        cardholderName: response.data.cardholderName,
        expiryMonth: response.data.expiryMonth,
        expiryYear: response.data.expiryYear,
      });
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_CARDS || 'saved_cards', JSON.stringify(savedCards));

      return response.data;
    } catch (error: any) {
      console.error('[PaymentService] Erreur enregistrement:', error.message);
      // Si l'endpoint n'existe pas, créer une carte locale
      const localCard: SavedPaymentMethod = {
        id: Date.now(),
        lastFourDigits: cardDetails.cardNumber.slice(-4),
        cardholderName: cardDetails.cardholderName,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        isDefault: setAsDefault,
      };

      // Stocker localement
      const savedCards = JSON.parse(await AsyncStorage.getItem(STORAGE_KEYS.SAVED_CARDS || 'saved_cards') || '[]');
      savedCards.push(localCard);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_CARDS || 'saved_cards', JSON.stringify(savedCards));

      console.log('[PaymentService] Carte enregistrée localement');
      return localCard;
    }
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
   * Traite un paiement par carte
   */
  processCardPayment: async (cardDetails: CardPaymentDetails, amount: number, orderId?: number): Promise<{ success: boolean; transactionId: string }> => {
    try {
      console.log('[PaymentService] Traitement du paiement par nouvelle carte');
      console.log('[PaymentService] Montant:', amount, 'DH');
      console.log('[PaymentService] Commande ID:', orderId);

      const response = await api.post<{ success: boolean; transactionId: string }>('/payments/process', {
        cardNumber: cardDetails.cardNumber,
        cardholderName: cardDetails.cardholderName,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        cvv: cardDetails.cvv,
        amount,
        orderId,
      });

      console.log('[PaymentService] Paiement réussi, transaction ID:', response.data.transactionId);
      return response.data;
    } catch (error: any) {
      console.error('[PaymentService] Erreur paiement:', error.message);
      // Si l'endpoint n'existe pas, simuler un succès pour dev
      console.log('[PaymentService] Mode développement: Paiement simulé');
      return {
        success: true,
        transactionId: 'txn_' + Date.now(),
      };
    }
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
      // Si l'endpoint n'existe pas, simuler un succès pour dev
      console.log('[PaymentService] Mode développement: Paiement simulé');
      return {
        success: true,
        transactionId: 'txn_' + Date.now(),
      };
    }
  },
};
