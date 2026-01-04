import api from './api';
import {
  TelecomRechargeOffer,
  TelecomRechargeConfig,
  RechargeTransaction,
  RechargeOrderRequest,
  TelecomOperator
} from '../type';

/**
 * Service pour gérer les recharges téléphoniques
 */
class TelecomRechargeService {

  // =============== ENDPOINTS CLIENT ===============

  /**
   * Obtenir toutes les offres de recharge disponibles pour une épicerie
   */
  async getAvailableOffers(epicerieId: number): Promise<TelecomRechargeOffer[]> {
    const response = await api.get<TelecomRechargeOffer[]>(`/telecom/offers/${epicerieId}`);
    return response.data;
  }

  /**
   * Obtenir les opérateurs disponibles pour une épicerie
   */
  async getAvailableOperators(epicerieId: number): Promise<TelecomOperator[]> {
    const response = await api.get<TelecomOperator[]>(`/telecom/offers/${epicerieId}/operators`);
    return response.data;
  }

  /**
   * Obtenir les offres d'un opérateur spécifique
   */
  async getOffersByOperator(
    epicerieId: number,
    operator: TelecomOperator
  ): Promise<TelecomRechargeOffer[]> {
    const response = await api.get<TelecomRechargeOffer[]>(
      `/telecom/offers/${epicerieId}/operator/${operator}`
    );
    return response.data;
  }

  /**
   * Obtenir une offre spécifique par ID
   */
  async getOfferById(offerId: number): Promise<TelecomRechargeOffer> {
    const response = await api.get<TelecomRechargeOffer>(`/telecom/offer/${offerId}`);
    return response.data;
  }

  /**
   * Effectuer une recharge téléphonique
   */
  async processRecharge(request: RechargeOrderRequest): Promise<RechargeTransaction> {
    const response = await api.post<RechargeTransaction>('/telecom/recharge', request);
    return response.data;
  }

  /**
   * Obtenir le statut d'une transaction par référence
   */
  async getTransactionStatus(reference: string): Promise<RechargeTransaction> {
    const response = await api.get<RechargeTransaction>(`/telecom/transaction/${reference}`);
    return response.data;
  }

  /**
   * Obtenir toutes les transactions d'un OrderItem
   */
  async getTransactionsByOrderItem(orderItemId: number): Promise<RechargeTransaction[]> {
    const response = await api.get<RechargeTransaction[]>(
      `/telecom/transactions/order-item/${orderItemId}`
    );
    return response.data;
  }

  /**
   * Vérifier si le service de recharge est activé pour une épicerie
   */
  async checkRechargeStatus(epicerieId: number): Promise<boolean> {
    const response = await api.get<{ enabled: boolean }>(`/telecom/status/${epicerieId}`);
    return response.data.enabled;
  }

  // =============== ENDPOINTS ÉPICIER ===============

  /**
   * Obtenir la configuration du service de recharge
   */
  async getConfig(): Promise<TelecomRechargeConfig> {
    const response = await api.get<TelecomRechargeConfig>('/epicier/telecom/config');
    return response.data;
  }

  /**
   * Mettre à jour la configuration du service de recharge
   */
  async updateConfig(config: Partial<TelecomRechargeConfig>): Promise<TelecomRechargeConfig> {
    const response = await api.put<TelecomRechargeConfig>('/epicier/telecom/config', config);
    return response.data;
  }

  /**
   * Obtenir toutes les offres (y compris désactivées) pour gestion
   */
  async getAllOffers(): Promise<TelecomRechargeOffer[]> {
    const response = await api.get<TelecomRechargeOffer[]>('/epicier/telecom/offers');
    return response.data;
  }

  /**
   * Créer une nouvelle offre de recharge
   */
  async createOffer(offer: Partial<TelecomRechargeOffer>): Promise<TelecomRechargeOffer> {
    const response = await api.post<TelecomRechargeOffer>('/epicier/telecom/offers', offer);
    return response.data;
  }

  /**
   * Mettre à jour une offre existante
   */
  async updateOffer(
    offerId: number,
    offer: Partial<TelecomRechargeOffer>
  ): Promise<TelecomRechargeOffer> {
    const response = await api.put<TelecomRechargeOffer>(
      `/epicier/telecom/offers/${offerId}`,
      offer
    );
    return response.data;
  }

  /**
   * Supprimer (désactiver) une offre
   */
  async deleteOffer(offerId: number): Promise<void> {
    await api.delete(`/epicier/telecom/offers/${offerId}`);
  }

  /**
   * Obtenir toutes les transactions échouées pouvant être retentées
   */
  async getRetryableTransactions(): Promise<RechargeTransaction[]> {
    const response = await api.get<RechargeTransaction[]>(
      '/epicier/telecom/transactions/retryable'
    );
    return response.data;
  }

  /**
   * Réessayer une transaction échouée
   */
  async retryTransaction(transactionId: number): Promise<RechargeTransaction> {
    const response = await api.post<RechargeTransaction>(
      `/epicier/telecom/transaction/${transactionId}/retry`
    );
    return response.data;
  }

  /**
   * Rembourser une transaction
   */
  async refundTransaction(
    transactionId: number,
    refundAmount: number
  ): Promise<RechargeTransaction> {
    const response = await api.post<RechargeTransaction>(
      `/epicier/telecom/transaction/${transactionId}/refund`,
      { refundAmount }
    );
    return response.data;
  }

  // =============== MÉTHODES UTILITAIRES ===============

  /**
   * Obtenir le nom d'affichage d'un opérateur
   */
  getOperatorDisplayName(operator: TelecomOperator): string {
    const names: Record<TelecomOperator, string> = {
      [TelecomOperator.INWI]: 'Inwi',
      [TelecomOperator.ORANGE]: 'Orange',
      [TelecomOperator.IAM]: 'Maroc Telecom',
      [TelecomOperator.WANA]: 'Wana Corporate'
    };
    return names[operator];
  }

  /**
   * Obtenir la couleur associée à un opérateur
   */
  getOperatorColor(operator: TelecomOperator): string {
    const colors: Record<TelecomOperator, string> = {
      [TelecomOperator.INWI]: '#E60000', // Rouge Inwi
      [TelecomOperator.ORANGE]: '#FF7900', // Orange
      [TelecomOperator.IAM]: '#00A651', // Vert IAM
      [TelecomOperator.WANA]: '#0066CC' // Bleu Wana
    };
    return colors[operator];
  }

  /**
   * Formater un numéro de téléphone marocain
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Supprimer tous les caractères non numériques sauf le +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Si commence par 00212, remplacer par +212
    if (cleaned.startsWith('00212')) {
      cleaned = '+212' + cleaned.substring(5);
    }

    // Si commence par 0 (format local), remplacer par +212
    if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
      cleaned = '+212' + cleaned.substring(1);
    }

    // Si ne commence pas par +212, ajouter le préfixe
    if (!cleaned.startsWith('+212')) {
      cleaned = '+212' + cleaned;
    }

    return cleaned;
  }

  /**
   * Valider un numéro de téléphone marocain
   */
  isValidMoroccanPhoneNumber(phoneNumber: string): boolean {
    const cleaned = this.formatPhoneNumber(phoneNumber);
    // Format: +212 suivi de 5, 6 ou 7, puis 8 chiffres
    const regex = /^\+212[567]\d{8}$/;
    return regex.test(cleaned);
  }
}

export default new TelecomRechargeService();
