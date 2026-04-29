/**
 * Service de gestion des mouvements de stock — branché sur l'API backend.
 *
 * Sprint 2 : remplace l'historique en mémoire par des appels REST :
 *   POST /api/epiceries/{epicerieId}/stock/movements
 *   GET  /api/epiceries/{epicerieId}/stock/movements?productId|productUnitId=…
 *
 * Le backend applique atomiquement l'ajustement du stock ET l'écriture du
 * mouvement. La réponse contient {@code stockAfter} que l'appelant utilise
 * pour synchroniser sa ProductUnit locale.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import { ProductUnit } from '../type';
import api from './api';

// ── Types ────────────────────────────────────────────────────────────────

export type StockMovementType = 'ENTREE' | 'SORTIE';

export type StockAdjustmentReason =
  | 'RECEPTION'
  | 'INVENTAIRE'
  | 'CASSE'
  | 'EXPIRATION'
  | 'PERTE'
  | 'RETOUR'
  | 'VENTE'
  | 'AUTRE';

export const STOCK_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  RECEPTION:  'Réception marchandise',
  INVENTAIRE: 'Correction inventaire',
  CASSE:      'Casse / Détérioration',
  EXPIRATION: 'Produit expiré',
  PERTE:      'Perte',
  RETOUR:     'Retour client',
  VENTE:      'Vente',
  AUTRE:      'Autre'
};

/**
 * Raisons proposées dans les formulaires d'ajustement manuel.
 * VENTE est exclue — générée automatiquement par le backend.
 */
export const MANUAL_ADJUSTMENT_REASONS: StockAdjustmentReason[] = [
  'RECEPTION', 'INVENTAIRE', 'CASSE', 'EXPIRATION', 'PERTE', 'RETOUR', 'AUTRE'
];

/** Vue de sortie de l'API (POST + GET). */
export interface StockMovementResponse {
  id: number;
  productUnitId: number;
  epicerieId: number;
  userId: number;
  movementType: StockMovementType;
  reason: StockAdjustmentReason;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  notes?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  createdAt: string;
}

// ── Lots (DLC) — Sprint 3 ────────────────────────────────────────────────

export interface StockBatchResponse {
  id: number;
  productUnitId: number;
  epicerieId: number;
  quantityInitial: number;
  quantityRemaining: number;
  expiryDate?: string | null;
  receivedAt: string;
  unitCost?: number | null;
  supplierName?: string | null;
  supplierInvoice?: string | null;
  notes?: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  daysUntilExpiry?: number | null;
}

export interface ReceiveBatchRequest {
  productUnitId: number;
  quantity: number;
  expiryDate?: string | null;
  receivedAt?: string | null;
  unitCost?: number | null;
  supplierName?: string | null;
  supplierInvoice?: string | null;
  notes?: string | null;
}

export type BatchReduceReason = 'CASSE' | 'EXPIRATION' | 'PERTE' | 'INVENTAIRE';

export const BATCH_REDUCE_REASONS: BatchReduceReason[] = [
  'CASSE', 'EXPIRATION', 'PERTE', 'INVENTAIRE'
];

export interface ReduceBatchRequest {
  quantity: number;
  reason: BatchReduceReason;
  notes?: string | null;
}

// ── Alertes stock (S4) ────────────────────────────────────────────────

export interface RuptureAlert {
  productUnitId: number;
  unitLabel: string;
  productId: number;
  productNom: string;
  effectiveThreshold: number;
}

export interface LowStockAlertItem {
  productUnitId: number;
  unitLabel: string;
  productId: number;
  productNom: string;
  stock: number;
  effectiveThreshold: number;
  unitsUntilRupture: number;
}

export interface PredictedRuptureAlert {
  productUnitId: number;
  unitLabel: string;
  productId: number;
  productNom: string;
  currentStock: number;
  velocityPerDay: number;
  estimatedDaysLeft: number;
  suggestedReorderQuantity: number;
}

export interface StockAlertsResponse {
  epicerieId: number;
  generatedAt: string;
  expiringHorizonDays: number;
  predictionHorizonDays: number;
  ruptures: RuptureAlert[];
  lowStock: LowStockAlertItem[];
  expiringSoon: StockBatchResponse[];
  predictedRuptures: PredictedRuptureAlert[];
}

export interface VelocityInfo {
  productUnitId: number;
  windowDays: number;
  totalOut: number;
  velocityPerDay: number;
  currentStock: number;
  estimatedDaysLeft: number | null;
}

// ── Inventaire (S5) ────────────────────────────────────────────────────

export type InventoryStatus = 'IN_PROGRESS' | 'VALIDATED' | 'CANCELLED';
export type InventoryScope = 'FULL' | 'CATEGORY' | 'CUSTOM' | 'TAG';

export const INVENTORY_SCOPE_LABELS: Record<InventoryScope, string> = {
  FULL:     'Toute la boutique',
  CATEGORY: 'Une catégorie',
  CUSTOM:   'Sélection manuelle',
  TAG:      'Un tag'
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  IN_PROGRESS: 'En cours',
  VALIDATED:   'Validé',
  CANCELLED:   'Annulé'
};

export interface CreateInventorySessionRequest {
  scope: InventoryScope;
  scopeRef?: number | null;
  customUnitIds?: number[] | null;
  name?: string | null;
  notes?: string | null;
}

export interface CountLineRequest {
  stockCounted: number | null;
  note?: string | null;
}

export interface InventorySessionResponse {
  id: number;
  epicerieId: number;
  startedBy: number;
  status: InventoryStatus;
  scope: InventoryScope;
  scopeRef?: number | null;
  name?: string | null;
  notes?: string | null;
  totalItems: number;
  countedItems: number;
  totalEcartValue?: number | null;
  startedAt: string;
  validatedAt?: string | null;
  cancelledAt?: string | null;
  validatedBy?: number | null;
  progressPercent: number;
}

export interface InventoryLineResponse {
  id: number;
  sessionId: number;
  productUnitId: number;
  productId?: number | null;
  productNom?: string | null;
  unitLabel?: string | null;
  unitCostAtSnapshot?: number | null;
  stockTheoretical: number;
  stockCounted?: number | null;
  ecart?: number | null;
  ecartValue?: number | null;
  note?: string | null;
  countedAt?: string | null;
  countedBy?: number | null;
  counted: boolean;
}

export type ExpiryLevel = 'none' | 'ok' | 'soon' | 'urgent' | 'expired';

export function getExpiryLevel(daysUntilExpiry?: number | null): ExpiryLevel {
  if (daysUntilExpiry == null) return 'none';
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 3) return 'urgent';
  if (daysUntilExpiry <= 7) return 'soon';
  return 'ok';
}

/** Format Spring Page<T>. */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
}

/** Modèle client enrichi utilisé par les écrans. */
export interface StockMovement {
  id: string;
  productId: number;
  unitId: number;
  unitLabel: string;
  type: StockMovementType;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: StockAdjustmentReason;
  notes?: string;
  date: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const getEpicerieId = async (): Promise<number> => {
  const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  if (!userData) throw new Error('Non connecté');
  const user = JSON.parse(userData);
  if (!user.epicerieId) throw new Error('Épicerie introuvable');
  return user.epicerieId;
};

const toClientModel = (r: StockMovementResponse): StockMovement => ({
  id:            String(r.id),
  productId:     0,
  unitId:        r.productUnitId,
  unitLabel:     '',
  type:          r.movementType,
  delta:         r.movementType === 'ENTREE' ? r.quantity : -r.quantity,
  previousStock: r.stockBefore,
  newStock:      r.stockAfter,
  reason:        r.reason,
  notes:         r.notes ?? undefined,
  date:          new Date(r.createdAt)
});

// ── API ──────────────────────────────────────────────────────────────────

export const stockService = {
  /**
   * Enregistre un mouvement de stock.
   *
   * @returns le nouveau stock de la variante (depuis la réponse serveur).
   */
  async adjustStock(
    productId: number,
    unit: ProductUnit,
    delta: number,
    reason: StockAdjustmentReason,
    notes?: string
  ): Promise<number> {
    const epicerieId = await getEpicerieId();
    const type: StockMovementType = delta >= 0 ? 'ENTREE' : 'SORTIE';

    const response = await api.post<StockMovementResponse>(
      `/epiceries/${epicerieId}/stock/movements`,
      {
        productUnitId: unit.id,
        movementType:  type,
        reason,
        quantity:      Math.abs(delta),
        notes:         notes ?? null
      }
    );

    // Sync stock local avec le serveur (source de vérité).
    unit.stock = response.data.stockAfter;
    return response.data.stockAfter;
  },

  /** Historique d'un produit, paginé. */
  async getProductHistory(
    productId: number,
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<StockMovement>> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<PageResponse<StockMovementResponse>>(
      `/epiceries/${epicerieId}/stock/movements`,
      { params: { productId, page, size } }
    );
    return { ...response.data, content: response.data.content.map(toClientModel) };
  },

  /** Historique d'une variante spécifique, paginé. */
  async getUnitHistory(
    productUnitId: number,
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<StockMovement>> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<PageResponse<StockMovementResponse>>(
      `/epiceries/${epicerieId}/stock/movements`,
      { params: { productUnitId, page, size } }
    );
    return { ...response.data, content: response.data.content.map(toClientModel) };
  },

  /** Historique global de l'épicerie, paginé. */
  async getEpicerieHistory(
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<StockMovement>> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<PageResponse<StockMovementResponse>>(
      `/epiceries/${epicerieId}/stock/movements`,
      { params: { page, size } }
    );
    return { ...response.data, content: response.data.content.map(toClientModel) };
  },

  // ── Lots (DLC) — Sprint 3 ──────────────────────────────────────────────

  /** Enregistre une réception de marchandise — crée un lot. */
  async receiveBatch(request: ReceiveBatchRequest): Promise<StockBatchResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<StockBatchResponse>(
      `/epiceries/${epicerieId}/stock/batches`,
      request
    );
    return response.data;
  },

  /** Lots actifs d'un produit (toutes variantes). */
  async getProductBatches(
    productId: number,
    activeOnly: boolean = true,
    page: number = 0,
    size: number = 50
  ): Promise<PageResponse<StockBatchResponse>> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<PageResponse<StockBatchResponse>>(
      `/epiceries/${epicerieId}/stock/batches`,
      { params: { productId, activeOnly, page, size } }
    );
    return response.data;
  },

  /** Lots actifs d'une variante. */
  async getUnitBatches(
    productUnitId: number,
    activeOnly: boolean = true,
    page: number = 0,
    size: number = 50
  ): Promise<PageResponse<StockBatchResponse>> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<PageResponse<StockBatchResponse>>(
      `/epiceries/${epicerieId}/stock/batches`,
      { params: { productUnitId, activeOnly, page, size } }
    );
    return response.data;
  },

  /** Réduit un lot (casse / expiration / perte / correction inventaire). */
  async reduceBatch(
    batchId: number,
    request: ReduceBatchRequest
  ): Promise<StockBatchResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.patch<StockBatchResponse>(
      `/epiceries/${epicerieId}/stock/batches/${batchId}/reduce`,
      request
    );
    return response.data;
  },

  /** Lots actifs dont DLC ≤ aujourd'hui + withinDays (alertes dashboard). */
  async getExpiring(
    withinDays: number = 7,
    page: number = 0,
    size: number = 50
  ): Promise<PageResponse<StockBatchResponse>> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<PageResponse<StockBatchResponse>>(
      `/epiceries/${epicerieId}/stock/expiring`,
      { params: { withinDays, page, size } }
    );
    return response.data;
  },

  // ── Alertes stock (S4) ─────────────────────────────────────────────────

  /** Vue agrégée 4-catégories des alertes stock. */
  async getAlerts(
    expiringHorizonDays?: number,
    predictionHorizonDays?: number
  ): Promise<StockAlertsResponse> {
    const epicerieId = await getEpicerieId();
    const params: Record<string, number> = {};
    if (expiringHorizonDays   != null) params['expiringHorizonDays'] = expiringHorizonDays;
    if (predictionHorizonDays != null) params['predictionHorizonDays'] = predictionHorizonDays;
    const response = await api.get<StockAlertsResponse>(
      `/epiceries/${epicerieId}/stock/alerts`,
      { params }
    );
    return response.data;
  },

  /** Vélocité d'une variante sur N jours. */
  async getVelocity(
    productUnitId: number,
    days: number = 30
  ): Promise<VelocityInfo> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<VelocityInfo>(
      `/epiceries/${epicerieId}/stock/velocity`,
      { params: { productUnitId, days } }
    );
    return response.data;
  },

  // ── Inventaire (S5) ────────────────────────────────────────────────────

  async createInventorySession(request: CreateInventorySessionRequest): Promise<InventorySessionResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<InventorySessionResponse>(
      `/epiceries/${epicerieId}/stock/inventory/sessions`, request
    );
    return response.data;
  },

  async listInventorySessions(
    status?: InventoryStatus,
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<InventorySessionResponse>> {
    const epicerieId = await getEpicerieId();
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    const response = await api.get<PageResponse<InventorySessionResponse>>(
      `/epiceries/${epicerieId}/stock/inventory/sessions`, { params }
    );
    return response.data;
  },

  async getInventorySession(sessionId: number): Promise<InventorySessionResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.get<InventorySessionResponse>(
      `/epiceries/${epicerieId}/stock/inventory/sessions/${sessionId}`
    );
    return response.data;
  },

  async listInventoryLines(
    sessionId: number,
    counted?: boolean,
    page: number = 0,
    size: number = 200
  ): Promise<PageResponse<InventoryLineResponse>> {
    const epicerieId = await getEpicerieId();
    const params: Record<string, string | number | boolean> = { page, size };
    if (counted !== undefined) params['counted'] = counted;
    const response = await api.get<PageResponse<InventoryLineResponse>>(
      `/epiceries/${epicerieId}/stock/inventory/sessions/${sessionId}/lines`,
      { params }
    );
    return response.data;
  },

  async countInventoryLine(
    sessionId: number, lineId: number, request: CountLineRequest
  ): Promise<InventoryLineResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.patch<InventoryLineResponse>(
      `/epiceries/${epicerieId}/stock/inventory/sessions/${sessionId}/lines/${lineId}`,
      request
    );
    return response.data;
  },

  async validateInventorySession(sessionId: number): Promise<InventorySessionResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<InventorySessionResponse>(
      `/epiceries/${epicerieId}/stock/inventory/sessions/${sessionId}/validate`, {}
    );
    return response.data;
  },

  async cancelInventorySession(sessionId: number): Promise<InventorySessionResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<InventorySessionResponse>(
      `/epiceries/${epicerieId}/stock/inventory/sessions/${sessionId}/cancel`, {}
    );
    return response.data;
  },

  /**
   * Télécharge le PDF / CSV d'une session d'inventaire et retourne l'URI
   * local — l'appelant peut ensuite utiliser {@code expo-sharing} pour
   * proposer le partage WhatsApp / Mail / Imprimante.
   */
  async downloadInventoryExport(
    sessionId: number,
    format: 'pdf' | 'csv' = 'pdf'
  ): Promise<string> {
    const epicerieId = await getEpicerieId();
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) throw new Error('Non authentifié');

    const ext = format === 'pdf' ? 'pdf' : 'csv';
    const fileUri = (FileSystem as any).documentDirectory
        + `inventaire-${sessionId}-${Date.now()}.${ext}`;

    const result = await FileSystem.downloadAsync(
      `${API_CONFIG.BASE_URL}/epiceries/${epicerieId}/stock/inventory/sessions/${sessionId}/export?format=${format}`,
      fileUri,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!result || result.status !== 200) {
      throw new Error('Impossible de télécharger le document');
    }
    return result.uri;
  }
};
