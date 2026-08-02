/**
 * Sessions POS persistantes — Axe POS.
 *
 * Persistance serveur des paniers avec idempotence par {@code clientUuid}.
 * Online-only : toutes les écritures/lectures sont des appels directs au
 * backend (temps réel). Le backend dé-doublonne via {@code clientUuid}.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import api from './api';

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

/** Résultat de {@code upsert}. Online-only : {@code online} vaut toujours true. */
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

/** Identifiant côté client — dé-doublonnage via UNIQUE(client_uuid). */
export const generateClientUuid = (): string =>
  `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const posSessionService = {
  /**
   * Upsert — POST direct, retourne la réponse serveur (avec serverId).
   * L'appelant doit toujours fournir {@code clientUuid} pour l'idempotence.
   */
  async upsert(request: PosSessionRequest): Promise<UpsertResult> {
    if (!request.clientUuid) {
      throw new Error('clientUuid est requis pour l\'idempotence');
    }
    const epicerieId = await getEpicerieId();
    const response = await api.post<PosSessionResponse>(
      `/epiceries/${epicerieId}/pos-sessions`, request
    );
    return { online: true, data: response.data };
  },

  /** Appel direct — réponse serveur immédiate (ex. hydratation au démarrage). */
  async createOrUpdate(request: PosSessionRequest): Promise<PosSessionResponse> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<PosSessionResponse>(
      `/epiceries/${epicerieId}/pos-sessions`, request
    );
    return response.data;
  },

  /** Sessions ACTIVE/PARKED de l'épicerie. */
  async listOpen(deviceId?: string): Promise<PosSessionResponse[]> {
    const epicerieId = await getEpicerieId();
    const params: Record<string, string> = {};
    if (deviceId) params['deviceId'] = deviceId;
    const response = await api.get<PosSessionResponse[]>(
      `/epiceries/${epicerieId}/pos-sessions/open`, { params }
    );
    return response.data ?? [];
  },

  async park(sessionId: number): Promise<UpsertResult> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<PosSessionResponse>(
      `/epiceries/${epicerieId}/pos-sessions/${sessionId}/park`, {}
    );
    return { online: true, data: response.data };
  },

  async abandon(sessionId: number): Promise<UpsertResult> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<PosSessionResponse>(
      `/epiceries/${epicerieId}/pos-sessions/${sessionId}/abandon`, {}
    );
    return { online: true, data: response.data };
  },

  async markCheckedOut(sessionId: number, orderId: number): Promise<UpsertResult> {
    const epicerieId = await getEpicerieId();
    const response = await api.post<PosSessionResponse>(
      `/epiceries/${epicerieId}/pos-sessions/${sessionId}/checked-out?orderId=${orderId}`, {}
    );
    return { online: true, data: response.data };
  }
};
