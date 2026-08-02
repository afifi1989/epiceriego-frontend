import api from './api';
import {
  CreateOrderRequest,
  DeliveryTracking,
  Order,
  OrderCounts,
  OrderListItem,
  SpringPage,
  DeliveryInfo,
  UpdateDeliveryInfoRequest,
  QrTokenResponse,
  QrValidateResponse,
  WhatsAppOutboundLog,
} from '../type';
import * as FileSystem from 'expo-file-system/legacy';
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
   * Cree N commandes en une seule transaction all-or-nothing.
   *
   * <p>Utilise quand le panier contient des produits de plusieurs epiceries :
   * on envoie le tableau au backend qui valide tout dans une transaction
   * unique. Si une commande echoue (stock, epicerie fermee, credit refuse...)
   * <em>aucune</em> n'est creee et le panier reste intact cote UI.</p>
   *
   * <p>Backend : POST /api/orders/batch (max 10 par batch).</p>
   *
   * @returns Liste des Order creees.
   * @throws {BatchOrderError} si une commande echoue (rollback total).
   */
  createOrderBatch: async (orders: CreateOrderRequest[]): Promise<Order[]> => {
    try {
      console.log('[OrderService] Batch de', orders.length, 'commandes envoye');
      const response = await api.post<{ orders: Order[] }>('/orders/batch', orders);
      return response.data.orders ?? [];
    } catch (error: any) {
      const data = error?.response?.data;
      // Backend renvoie { failedIndex, epicerieId, message, [errorCode, availableCredit, orderTotal] }
      // en cas d'echec. Les 3 derniers champs ne sont presents que pour les
      // refus CLIENT_ACCOUNT (cf. CreditErrorResponse cote backend).
      if (typeof data?.failedIndex === 'number') {
        throw new BatchOrderError(
          data.failedIndex,
          data.epicerieId,
          data.message,
          data.errorCode,
          data.availableCredit,
          data.orderTotal
        );
      }
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors du batch';
    }
  },

  /**
   * Accepte N commandes PENDING en une seule requete (epicier).
   *
   * <p>Mode partial-success : chaque commande est traitee independamment.
   * Si une echoue (deja annulee, race condition), les autres passent.
   * Le caller affiche un rapport "N acceptees, X echec(s)".</p>
   */
  acceptBatch: async (orderIds: number[]): Promise<BatchOrderActionResult> => {
    try {
      const response = await api.post<BatchOrderActionResult>('/orders/accept-batch', { orderIds });
      const data = response.data;
      return {
        accepted: data.accepted ?? [],
        rejected: [],
        failed: data.failed ?? [],
      };
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors de l\'acceptation en lot';
    }
  },

  /**
   * Refuse N commandes PENDING en une seule requete (symetrique de acceptBatch).
   */
  rejectBatch: async (orderIds: number[]): Promise<BatchOrderActionResult> => {
    try {
      const response = await api.post<BatchOrderActionResult>('/orders/reject-batch', { orderIds });
      const data = response.data;
      return {
        accepted: [],
        rejected: data.rejected ?? [],
        failed: data.failed ?? [],
      };
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors du refus en lot';
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
   * @deprecated Préférer getActiveEpicerieOrders + getArchiveEpicerieOrders
   * pour éviter de charger toute l'historique à chaque refresh.
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
   * V96 — Commandes actives (PENDING/ACCEPTED/PREPARING/READY/IN_DELIVERY).
   * Liste plate, non paginée (ensemble borné par nature). Polling 15s
   * côté écran.
   */
  getActiveEpicerieOrders: async (backgroundPoll = false): Promise<OrderListItem[]> => {
    try {
      // backgroundPoll : tague la requête pour que l'intercepteur 402 (api.ts)
      // n'ouvre PAS de modal d'upsell sur un poll de fond (sinon empilement).
      const response = await api.get<OrderListItem[]>(
        '/orders/epicerie/my-orders/active',
        backgroundPoll ? ({ __backgroundPoll: true } as any) : undefined,
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * V96 — Page d'archives (DELIVERED/CANCELLED). Backend trie par
   * createdAt desc. Recherche optionnelle sur ID, nom client, téléphone.
   */
  getArchiveEpicerieOrders: async (opts: {
    page: number;
    size: number;
    statuses?: string[];
    q?: string;
  }): Promise<SpringPage<OrderListItem>> => {
    try {
      const params: any = { page: opts.page, size: opts.size };
      if (opts.statuses && opts.statuses.length > 0) {
        params.statuses = opts.statuses.join(',');
      }
      if (opts.q && opts.q.trim()) {
        params.q = opts.q.trim();
      }
      const response = await api.get<SpringPage<OrderListItem>>(
        '/orders/epicerie/my-orders/archive',
        { params }
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /** V96 — Compteurs pour les badges des tabs. */
  getEpicerieOrdersCounts: async (backgroundPoll = false): Promise<OrderCounts> => {
    try {
      const response = await api.get<OrderCounts>(
        '/orders/epicerie/my-orders/counts',
        backgroundPoll ? ({ __backgroundPoll: true } as any) : undefined,
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Historique paginé des commandes d'un client dans l'épicerie courante
   * (épicerie dérivée du token). Même forme paginée `{content: Order[]}`
   * que les autres endpoints `/orders/epicerie/*`. Gardé par ORDER_VIEW.
   *
   * GET /orders/epicerie/clients/{clientId}
   */
  getEpicerieClientOrders: async (
    clientId: number,
    opts?: { page?: number; size?: number }
  ): Promise<SpringPage<Order>> => {
    try {
      const params = { page: opts?.page ?? 0, size: opts?.size ?? 20 };
      const response = await api.get<SpringPage<Order>>(
        `/orders/epicerie/clients/${clientId}`,
        { params }
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Commandes EN COURS (statuts actifs) d'un client dans l'épicerie courante.
   * Liste plate, non paginée (ensemble borné). Gardé par ORDER_VIEW.
   *
   * GET /orders/epicerie/clients/{clientId}/active
   */
  getEpicerieClientActiveOrders: async (clientId: number): Promise<Order[]> => {
    try {
      const response = await api.get<Order[]>(
        `/orders/epicerie/clients/${clientId}/active`
      );
      return response.data ?? [];
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
  updateOrderStatus: async (id: number, status: string, cashCollected?: boolean): Promise<Order> => {
    try {
      // V114 — cashCollected : confirmation d'encaissement espèces quand
      // l'épicier valide une remise (CASH → DELIVERED).
      const response = await api.put<Order>(`/orders/${id}/status`, { status, cashCollected });
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
   * Suivi temps réel de la livraison (position du livreur).
   * Disponible uniquement pour le client propriétaire, pendant IN_DELIVERY.
   * Appelé en polling (~10 s) par l'écran de suivi — pas de cache.
   */
  getDeliveryTracking: async (orderId: number): Promise<DeliveryTracking> => {
    try {
      const response = await api.get<DeliveryTracking>(`/orders/${orderId}/tracking`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Suivi indisponible';
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

  /**
   * Récupère l'historique d'audit d'une commande (timeline).
   */
  getOrderHistory: async (orderId: number): Promise<OrderAuditLog[]> => {
    try {
      const response = await api.get<OrderAuditLog[]>(`/orders/${orderId}/history`);
      return response.data ?? [];
    } catch {
      return [];
    }
  },

  /**
   * WhatsApp — Journal des messages sortants d'une commande (chargé à la
   * demande depuis l'écran de détail, uniquement pour les commandes WHATSAPP).
   *
   * <p>Renvoie la liste chronologique des envois (notifications de statut,
   * réponses conversationnelles, modèles) avec leur état de livraison. Le
   * tableau peut être vide si aucun message n'a été envoyé. L'autorisation
   * (épicier propriétaire) est vérifiée côté serveur : 403/404 possibles —
   * le message d'erreur est propagé au caller pour affichage.</p>
   *
   * GET /orders/{orderId}/whatsapp-log
   */
  getWhatsAppLog: async (orderId: number): Promise<WhatsAppOutboundLog[]> => {
    try {
      const response = await api.get<WhatsAppOutboundLog[]>(`/orders/${orderId}/whatsapp-log`);
      return response.data ?? [];
    } catch (error: any) {
      throw error.response?.data?.message || 'Impossible de charger le journal WhatsApp';
    }
  },
};

export interface OrderAuditLog {
  id: number;
  orderId: number;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  actorId: number | null;
  actorName: string;
  actorRole: string;
  details: string | null;
  createdAt: string;
}

/**
 * Resultat d'un accept-batch ou reject-batch (partial-success).
 * Soit `accepted` est rempli (accept), soit `rejected` (reject), jamais les deux.
 */
export interface BatchOrderActionResult {
  accepted: Order[];
  rejected: Order[];
  failed: { orderId: number; reason: string }[];
}

/**
 * Erreur leve par createOrderBatch quand une commande du lot a echoue.
 * Le backend a rollback toutes les autres commandes — rien n'a ete cree.
 */
export class BatchOrderError extends Error {
  failedIndex: number;
  epicerieId: number | null;
  /** Code typé pour les refus CLIENT_ACCOUNT (cf. CreditErrorResponse backend) */
  errorCode?: string;
  availableCredit?: number;
  orderTotal?: number;
  constructor(
    failedIndex: number,
    epicerieId: number | null,
    message: string,
    errorCode?: string,
    availableCredit?: number,
    orderTotal?: number
  ) {
    super(message);
    this.name = 'BatchOrderError';
    this.failedIndex = failedIndex;
    this.epicerieId = epicerieId;
    this.errorCode = errorCode;
    this.availableCredit = availableCredit;
    this.orderTotal = orderTotal;
  }
}
