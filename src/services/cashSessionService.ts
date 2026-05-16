/**
 * Sessions de caisse (cash drawer) — Axe POS / Sprint 2.
 *
 * Endpoints :
 *   POST /epiceries/{eid}/cash-sessions/open
 *   GET  /epiceries/{eid}/cash-sessions/current       (204 si aucune)
 *   GET  /epiceries/{eid}/cash-sessions[?status=]
 *   GET  /epiceries/{eid}/cash-sessions/{id}
 *   GET  /epiceries/{eid}/cash-sessions/{id}/x-report
 *   POST /epiceries/{eid}/cash-sessions/{id}/close
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import api from './api';

export type CashDrawerStatus = 'OPEN' | 'CLOSED';

export interface CashDrawerSessionResponse {
  id: number;
  epicerieId: number;
  openedBy: number;
  closedBy?: number | null;
  status: CashDrawerStatus;

  openingFloat: number;
  expectedCash?: number | null;
  countedCash?: number | null;
  cashVariance?: number | null;
  varianceNote?: string | null;

  totalSales?: number | null;
  totalCash?: number | null;
  totalCard?: number | null;
  totalAccount?: number | null;
  totalRefunds?: number | null;
  orderCount?: number | null;

  /** S4 — numéro Z attribué à la clôture. Null si OPEN. */
  zNumber?: string | null;
  zSequence?: number | null;

  notes?: string | null;
  openedAt: string;
  closedAt?: string | null;
}

export interface XReportResponse {
  cashSessionId: number;
  epicerieId: number;
  openedAt: string;
  snapshotAt: string;
  openingFloat: number;
  orderCount: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalAccount: number;
  totalOther: number;
  expectedCash: number;
}

export interface OpenCashSessionRequest {
  openingFloat: number;
  notes?: string | null;
}

export interface CloseCashSessionRequest {
  countedCash: number;
  varianceNote?: string | null;
}

const getEpicerieId = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) throw new Error('Non connecté');
  const user = JSON.parse(raw);
  if (!user.epicerieId) throw new Error('Épicerie introuvable');
  return user.epicerieId;
};

export const cashSessionService = {
  async open(request: OpenCashSessionRequest): Promise<CashDrawerSessionResponse> {
    const eid = await getEpicerieId();
    const response = await api.post<CashDrawerSessionResponse>(
      `/epiceries/${eid}/cash-sessions/open`, request
    );
    return response.data;
  },

  /** Retourne null si aucune session ouverte. */
  async getCurrent(): Promise<CashDrawerSessionResponse | null> {
    const eid = await getEpicerieId();
    try {
      const response = await api.get<CashDrawerSessionResponse>(
        `/epiceries/${eid}/cash-sessions/current`
      );
      return response.status === 204 ? null : response.data;
    } catch (e: any) {
      if (e?.response?.status === 204 || e?.response?.status === 404) return null;
      throw e;
    }
  },

  async xReport(sessionId: number): Promise<XReportResponse> {
    const eid = await getEpicerieId();
    const response = await api.get<XReportResponse>(
      `/epiceries/${eid}/cash-sessions/${sessionId}/x-report`
    );
    return response.data;
  },

  async close(sessionId: number, request: CloseCashSessionRequest)
      : Promise<CashDrawerSessionResponse> {
    const eid = await getEpicerieId();
    const response = await api.post<CashDrawerSessionResponse>(
      `/epiceries/${eid}/cash-sessions/${sessionId}/close`, request
    );
    return response.data;
  },

  async list(status?: CashDrawerStatus, page = 0, size = 20): Promise<{
    content: CashDrawerSessionResponse[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    last: boolean;
  }> {
    const eid = await getEpicerieId();
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    const response = await api.get(`/epiceries/${eid}/cash-sessions`, { params });
    return response.data;
  },

  // ── S4 — Z report ──────────────────────────────────────────────────────

  /**
   * Télécharge le rapport Z au format PDF d'une session clôturée et
   * retourne l'URI local (à partager via expo-sharing).
   */
  async downloadZReportPdf(sessionId: number): Promise<string> {
    const eid = await getEpicerieId();
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) throw new Error('Non authentifié');

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = (FileSystem as any).documentDirectory
        + `z-report-${sessionId}-${Date.now()}.pdf`;

    const result = await FileSystem.downloadAsync(
      `${API_CONFIG.BASE_URL}/epiceries/${eid}/cash-sessions/${sessionId}/z-report.pdf`,
      fileUri,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!result || result.status !== 200) {
      throw new Error('Impossible de télécharger le rapport Z');
    }
    return result.uri;
  }
};
