import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import api from './api';

/**
 * Service mobile pour la gestion des fournisseurs (V96).
 *
 * <p>Aligne 1:1 sur le backend
 * {@code com.epiceriego.purchasing.controller.SupplierController}.</p>
 *
 * <p>UI epicier mobile en francais uniquement (cf. EpicierLanguageProvider).</p>
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types alignes sur le backend
// ═══════════════════════════════════════════════════════════════════════════

export type SupplierStatus = 'ACTIVE' | 'ARCHIVED';
export type SupplierType = 'FOOD' | 'BEVERAGE' | 'HOUSEHOLD' | 'OTHER';

export interface Supplier {
  id: number;
  epicerieId: number;
  name: string;
  status: SupplierStatus;
  supplierType?: SupplierType | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  iban?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  attachmentUrl?: string | null;
  /** Renseigne par getById uniquement (vs liste). */
  batchCount?: number | null;
  /** ISO 8601 de la derniere reception ou null. */
  lastReceivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  name: string;
  supplierType?: SupplierType | null;
  contactName?: string;
  phone?: string;
  email?: string;
  iban?: string;
  paymentTerms?: string;
  notes?: string;
}

/** PATCH-like : tous les champs optionnels. "" efface, null/undefined = inchange. */
export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export interface SupplierAutocompleteResult {
  id: number;
  name: string;
  supplierType?: SupplierType | null;
  phone?: string | null;
}

export interface TopSupplierEntry {
  supplierId: number;
  name: string;
  batchCount: number;
  totalSpend: number;
}

export interface SupplierStats {
  activeSuppliersCount: number;
  archivedSuppliersCount: number;
  batchesReceived: number;
  totalSpend: number;
  topSuppliers: TopSupplierEntry[];
}

export interface SupplierBatchSummary {
  batchId: number;
  productUnitId?: number | null;
  quantityInitial?: number | null;
  quantityRemaining?: number | null;
  unitCost?: number | null;
  receivedAt?: string | null;
  expiryDate?: string | null;
  supplierInvoice?: string | null;
}

/** Reponse paginee du backend Spring Data (champs minimaux utilises). */
export interface SupplierBatchPage {
  content: SupplierBatchSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

export const supplierService = {
  // ── CRUD ──────────────────────────────────────────────────────────────

  list: async (status?: SupplierStatus): Promise<Supplier[]> => {
    try {
      const params: Record<string, string> = {};
      if (status) params['status'] = status;
      const response = await api.get<Supplier[]>('/suppliers/my-store', { params });
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur de chargement';
    }
  },

  getById: async (id: number): Promise<Supplier> => {
    try {
      const response = await api.get<Supplier>(`/suppliers/${id}`);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Fournisseur introuvable';
    }
  },

  create: async (req: CreateSupplierRequest): Promise<Supplier> => {
    try {
      const response = await api.post<Supplier>('/suppliers', req);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors de la creation';
    }
  },

  update: async (id: number, req: UpdateSupplierRequest): Promise<Supplier> => {
    try {
      const response = await api.put<Supplier>(`/suppliers/${id}`, req);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors de la mise a jour';
    }
  },

  archive: async (id: number): Promise<Supplier> => {
    try {
      const response = await api.put<Supplier>(`/suppliers/${id}/archive`);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur archivage';
    }
  },

  reactivate: async (id: number): Promise<Supplier> => {
    try {
      const response = await api.put<Supplier>(`/suppliers/${id}/reactivate`);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur reactivation';
    }
  },

  /** DELETE — refus 400 si des batches existent (preferer archive). */
  remove: async (id: number): Promise<void> => {
    try {
      await api.delete(`/suppliers/${id}`);
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur suppression';
    }
  },

  // ── Autocomplete ──────────────────────────────────────────────────────

  /**
   * Recherche par prefixe (insensible a la casse). Filtre ACTIVE uniquement.
   * @param q     prefixe a chercher (vide = liste vide)
   * @param limit defaut 10, max 20
   */
  search: async (q: string, limit = 10): Promise<SupplierAutocompleteResult[]> => {
    if (!q || !q.trim()) return [];
    try {
      const response = await api.get<SupplierAutocompleteResult[]>(
        '/suppliers/search',
        { params: { q, limit } },
      );
      return response.data;
    } catch (error: any) {
      console.warn('[supplierService] search failed', error?.message);
      return [];
    }
  },

  searchByPhone: async (q: string, limit = 10): Promise<SupplierAutocompleteResult[]> => {
    if (!q || !q.trim()) return [];
    try {
      const response = await api.get<SupplierAutocompleteResult[]>(
        '/suppliers/search-by-phone',
        { params: { q, limit } },
      );
      return response.data;
    } catch {
      return [];
    }
  },

  // ── Historique batches ────────────────────────────────────────────────

  getBatches: async (id: number, page = 0, size = 20): Promise<SupplierBatchPage> => {
    try {
      const response = await api.get<SupplierBatchPage>(`/suppliers/${id}/batches`, {
        params: { page, size },
      });
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur historique';
    }
  },

  // ── Stats ─────────────────────────────────────────────────────────────

  /** Stats agregees (defaut: 30 derniers jours). Necessite STATS_VIEW. */
  stats: async (from?: Date, to?: Date): Promise<SupplierStats> => {
    try {
      const params: Record<string, string> = {};
      if (from) params['from'] = from.toISOString().split('T')[0]; // YYYY-MM-DD
      if (to)   params['to']   = to.toISOString().split('T')[0];
      const response = await api.get<SupplierStats>('/suppliers/stats', { params });
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur stats';
    }
  },

  // ── Piece jointe (photo carte visite / RIB) ─────────────────────────

  /**
   * Upload via fetch API — contourne les problemes HTTPS/SSL d'axios+FormData
   * sur React Native (cf. memoire projet "Image upload mobile utilise fetch").
   *
   * @param id       fournisseur cible
   * @param imageUri URI locale de l'image (resultat ImagePicker.launchImageLibraryAsync)
   * @returns Supplier rafraichi avec attachmentUrl mis a jour
   */
  uploadAttachment: async (id: number, imageUri: string): Promise<Supplier> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'attachment.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      // @ts-ignore - FormData supporte les fichiers sur React Native
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: type,
      });

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/suppliers/${id}/attachment`,
        { method: 'POST', headers, body: formData as any },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload echoue: ${response.status} ${errorText}`);
      }
      return await response.json();
    } catch (error: any) {
      throw error?.message ?? 'Erreur upload';
    }
  },

  deleteAttachment: async (id: number): Promise<Supplier> => {
    try {
      const response = await api.delete<Supplier>(`/suppliers/${id}/attachment`);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur suppression piece';
    }
  },
};

/** Mapping FR pour l'affichage des types (UI epicier mobile FR uniquement). */
export const SUPPLIER_TYPE_LABELS_FR: Record<SupplierType, string> = {
  FOOD: 'Alimentaire',
  BEVERAGE: 'Boissons',
  HOUSEHOLD: 'Menager',
  OTHER: 'Autre',
};

export const SUPPLIER_TYPE_EMOJI: Record<SupplierType, string> = {
  FOOD: '🥬',
  BEVERAGE: '🥤',
  HOUSEHOLD: '🧴',
  OTHER: '📦',
};
