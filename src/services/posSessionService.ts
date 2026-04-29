/**
 * Sessions POS persistantes — Axe POS.
 *
 * <h3>S1 (baseline)</h3>
 * Persistance serveur des paniers avec idempotence par {@code clientUuid}.
 *
 * <h3>S6 (offline complet)</h3>
 * Toutes les écritures passent par {@link offlineService.writeOrQueue} :
 *   - En ligne → POST direct + invalidation du cache {@code pos}
 *   - Hors ligne → queuée, rejouée à la reconnexion
 *   - Rétro-upsert : toujours POST {@code /pos-sessions} (le backend
 *     dé-doublonne via {@code clientUuid}) — plus de distinction create/update
 * Les lectures passent par {@link offlineService.fetchWithCache}.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import api from './api';
import { offlineService } from './offline';

export type PosSessionStatus = 'ACTIVE' | 'PARKED' | 'CHECKED_OUT' | 'ABANDONED';

export interface PosSessionResponse {
  id: number;
  clientUuid?: string | null;
  epicerieId: number;
  createdBy: number;
  clientId?: number | null;
  cashDrawerSessionId?: number | null;
  status: PosSessionStatus;
  name?: string | null;
  notes?: string | null;
  deviceId?: string | null;
  cartJson: string;
  totalAmount?: number | null;
  itemCount?: number | null;
  orderId?: number | null;
  createdAt: string;
  updatedAt: string;
  checkedOutAt?: string | null;
  abandonedAt?: string | null;
}

export interface PosSessionRequest {
  clientUuid?: string | null;
  clientId?: number | null;
  name?: string | null;
  notes?: string | null;
  deviceId?: string | null;
  cartJson: string;
  totalAmount?: number | null;
  itemCount?: number | null;
  status?: PosSessionStatus | null;
}

/** Résultat de {@code upsert} — expose online/offline au caller. */
export interface UpsertResult {
  online: boolean;
  data: PosSessionResponse | null;
}

const getEpicerieId = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) throw new Error('Non connecté');
  const user = JSON.parse(raw);
  if (!user.epicerieId) throw new Error('Épicerie introuvable');
  return user.epicerieId;
};

/** Identifiant côté client — offline-first, dé-doublonnage via UNIQUE(client_uuid). */
export const generateClientUuid = (): string =>
  `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const posSessionService = {
  /**
   * Upsert — offline-first via writeOrQueue.
   * Si en ligne, retourne la réponse serveur (avec serverId).
   * Si hors ligne, la requête est queuée et data=null.
   *
   * L'appelant doit toujours fournir {@code clientUuid} pour l'idempotence.
   */
  async upsert(request: PosSessionRequest): Promise<UpsertResult> {
    if (!request.clientUuid) {
      throw new Error('clientUuid est requis pour la persistance offline-first');
    }
    const epicerieId = await getEpicerieId();
    const result = await offlineService.writeOrQueue<PosSessionResponse>({
      domain: 'pos',
      method: 'POST',
      endpoint: `/epiceries/${epicerieId}/pos-sessions`,
      payload: request,
      invalidateCache: ['pos'],
      description: `Session POS ${request.clientUuid.slice(0, 12)}…`
    });
    return { online: result.online, data: result.data };
  },

  /**
   * Appel direct (sans queue) — utilisé uniquement quand on VEUT
   * une réponse serveur immédiate (ex. hydratation au démarrage).
   */
  async createOrUpdate(request: PosSessionRequest): Promise<PosSessionResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<PosSessionResponse>(
      `/epiceries/${epicerieId}/pos-sessions`, request
    );
    return response.data;
  },

  /** Sessions ACTIVE/PARKED de l'épicerie — lecture cache-first. */
  async listOpen(deviceId?: string): Promise<PosSessionResponse[]> {
    const epicerieId = await getEpicerieId();
    const params: Record<string, string> = {};
    if (deviceId) params['deviceId'] = deviceId;

    const endpoint = `/epiceries/${epicerieId}/pos-sessions/open`;
    const cacheKey = deviceId ? `open:${deviceId}` : 'open:any';

    const result = await offlineService.fetchWithCache<PosSessionResponse[]>({
      namespace: 'pos',
      key: cacheKey,
      fetcher: async () => {
        const response = await api.get<PosSessionResponse[]>(endpoint, { params });
        return response.data;
      }
    });
    return result ?? [];
  },

  async park(sessionId: number): Promise<UpsertResult> {
    const epicerieId = await getEpicerieId();
    const result = await offlineService.writeOrQueue<PosSessionResponse>({
      domain: 'pos',
      method: 'POST',
      endpoint: `/epiceries/${epicerieId}/pos-sessions/${sessionId}/park`,
      invalidateCache: ['pos'],
      description: `Park session POS #${sessionId}`
    });
    return { online: result.online, data: result.data };
  },

  async abandon(sessionId: number): Promise<UpsertResult> {
    const epicerieId = await getEpicerieId();
    const result = await offlineService.writeOrQueue<PosSessionResponse>({
      domain: 'pos',
      method: 'POST',
      endpoint: `/epiceries/${epicerieId}/pos-sessions/${sessionId}/abandon`,
      invalidateCache: ['pos'],
      description: `Abandon session POS #${sessionId}`
    });
    return { online: result.online, data: result.data };
  },

  async markCheckedOut(sessionId: number, orderId: number): Promise<UpsertResult> {
    const epicerieId = await getEpicerieId();
    const result = await offlineService.writeOrQueue<PosSessionResponse>({
      domain: 'pos',
      method: 'POST',
      endpoint: `/epiceries/${epicerieId}/pos-sessions/${sessionId}/checked-out?orderId=${orderId}`,
      invalidateCache: ['pos'],
      description: `Checkout session POS #${sessionId} → order #${orderId}`
    });
    return { online: result.online, data: result.data };
  }
};
