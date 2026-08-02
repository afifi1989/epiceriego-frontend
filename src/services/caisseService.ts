import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

// ── Types (multi-caisse) ─────────────────────────────────────────────────────
export interface Caisse {
  id: number;
  epicerieId: number;
  nom: string;
  code?: string | null;
  defaultCaisse: boolean;
  active: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

export interface CreateCaisseRequest {
  nom: string;
  code?: string | null;
  makeDefault?: boolean;
  notes?: string | null;
}

export interface UpdateCaisseRequest {
  nom?: string;
  code?: string | null;
  notes?: string | null;
  active?: boolean;
}

const getEpicerieId = async (): Promise<number> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) throw new Error('Non connecté');
  const user = JSON.parse(raw);
  if (!user.epicerieId) throw new Error('Épicerie introuvable');
  return user.epicerieId;
};

export const caisseService = {

  list: async (includeArchived = false): Promise<Caisse[]> => {
    const eid = await getEpicerieId();
    const response = await api.get<Caisse[]>(`/epiceries/${eid}/caisses`, {
      params: includeArchived ? { includeArchived: true } : {},
    });
    return response.data;
  },

  get: async (id: number): Promise<Caisse> => {
    const eid = await getEpicerieId();
    const response = await api.get<Caisse>(`/epiceries/${eid}/caisses/${id}`);
    return response.data;
  },

  create: async (request: CreateCaisseRequest): Promise<Caisse> => {
    const eid = await getEpicerieId();
    const response = await api.post<Caisse>(`/epiceries/${eid}/caisses`, request);
    return response.data;
  },

  update: async (id: number, request: UpdateCaisseRequest): Promise<Caisse> => {
    const eid = await getEpicerieId();
    const response = await api.put<Caisse>(`/epiceries/${eid}/caisses/${id}`, request);
    return response.data;
  },

  setDefault: async (id: number): Promise<Caisse> => {
    const eid = await getEpicerieId();
    const response = await api.put<Caisse>(`/epiceries/${eid}/caisses/${id}/default`, {});
    return response.data;
  },

  archive: async (id: number): Promise<void> => {
    const eid = await getEpicerieId();
    await api.delete(`/epiceries/${eid}/caisses/${id}`);
  },
};
