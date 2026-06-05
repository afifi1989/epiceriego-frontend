/**
 * bundleOfferService — Service CRUD des Bundle Offers (paniers groupes) cote
 * mobile epicier. Miroir du {@code BundleOfferController} backend.
 *
 * Endpoints utilises :
 *   GET    /bundle-offers/my-store           — liste de l'epicier connecte
 *   GET    /bundle-offers/{id}               — detail
 *   POST   /bundle-offers                    — creer (gated BUNDLE_OFFERS)
 *   PUT    /bundle-offers/{id}               — modifier (gated)
 *   PATCH  /bundle-offers/{id}/status        — DRAFT/ACTIVE/INACTIVE
 *   PATCH  /bundle-offers/{id}/featured      — toggle featured
 *   DELETE /bundle-offers/{id}               — supprimer
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

// ─── Types miroir du backend ────────────────────────────────────────────────

export type BundleOfferStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface BundleOfferItem {
  id?: number;
  productId: number;
  productName?: string;
  productPhotoUrl?: string | null;
  productUnitId?: number | null;
  unitLabel?: string | null;
  unitPrice?: number | null;
  quantity: number;
  displayOrder?: number;
}

export interface BundleOfferTranslation {
  language: 'fr' | 'ar' | 'en' | 'tz';
  name: string;
  description?: string | null;
}

export interface BundleOffer {
  id: number;
  epicerieId: number;
  epicerieName?: string;
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  price: number;
  currencyCode: string;
  status: BundleOfferStatus;
  validFrom?: string | null;
  validTo?: string | null;
  displayOrder: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  items: BundleOfferItem[];
  translations: BundleOfferTranslation[];
  /** Calcules par le backend pour eviter au front de refaire la somme. */
  computedSavings?: number;
  savingsPercent?: number;
  available?: boolean;
  maxAvailableQuantity?: number;
}

export interface CreateBundleOfferPayload {
  name: string;
  description?: string;
  photoUrl?: string;
  price: number;
  currencyCode?: string;
  validFrom?: string | null;
  validTo?: string | null;
  displayOrder?: number;
  items: Array<{
    productId: number;
    productUnitId?: number | null;
    quantity: number;
    displayOrder?: number;
  }>;
  translations?: BundleOfferTranslation[];
}

export type UpdateBundleOfferPayload = Partial<CreateBundleOfferPayload>;

// ─── Service ────────────────────────────────────────────────────────────────

const bundleOfferService = {
  async listMyStore(): Promise<BundleOffer[]> {
    const resp = await api.get<BundleOffer[]>('/bundle-offers/my-store');
    return resp.data;
  },

  async getById(id: number): Promise<BundleOffer> {
    const resp = await api.get<BundleOffer>(`/bundle-offers/${id}`);
    return resp.data;
  },

  async create(payload: CreateBundleOfferPayload): Promise<BundleOffer> {
    const resp = await api.post<BundleOffer>('/bundle-offers', payload);
    return resp.data;
  },

  async update(id: number, payload: UpdateBundleOfferPayload): Promise<BundleOffer> {
    const resp = await api.put<BundleOffer>(`/bundle-offers/${id}`, payload);
    return resp.data;
  },

  async changeStatus(id: number, status: BundleOfferStatus): Promise<BundleOffer> {
    const resp = await api.patch<BundleOffer>(`/bundle-offers/${id}/status`, { status });
    return resp.data;
  },

  async setFeatured(id: number, featured: boolean): Promise<BundleOffer> {
    const resp = await api.patch<BundleOffer>(`/bundle-offers/${id}/featured`, { featured });
    return resp.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/bundle-offers/${id}`);
  },

  /**
   * Upload de la photo de couverture (multipart). Comme pour les produits, on
   * passe par `fetch` (pas axios) a cause du contournement SSL/HTTPS React
   * Native. Le backend stocke un nom de fichier relatif et renvoie le bundle
   * avec son `photoUrl` resolu en URL absolue.
   *
   * @param asset asset ImagePicker (au moins `uri`)
   */
  async uploadPhoto(id: number, asset: { uri: string }): Promise<BundleOffer> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    const formData = new FormData();
    formData.append('image', {
      uri: asset.uri,
      type: 'image/jpeg',
      name: `bundle-${Date.now()}.jpg`,
    } as any);

    const resp = await fetch(`${API_CONFIG.BASE_URL}/bundle-offers/${id}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!resp.ok) throw new Error(`Upload HTTP ${resp.status}`);
    return resp.json();
  },

  /** Retire la photo de couverture du bundle. */
  async clearPhoto(id: number): Promise<BundleOffer> {
    const resp = await api.delete<BundleOffer>(`/bundle-offers/${id}/photo`);
    return resp.data;
  },

  // ─── Endpoints publics (clients / chatbot / WhatsApp) ────────────────────

  /**
   * Liste des bundles disponibles dans une epicerie pour les clients.
   * Backend filtre : ACTIVE + dans validity window + au moins 1 item en stock.
   * Public — pas besoin d'auth, le client peut consulter une boutique avant
   * de s'inscrire.
   */
  async listAvailableForEpicerie(epicerieId: number): Promise<BundleOffer[]> {
    const resp = await api.get<BundleOffer[]>(`/epiceries/${epicerieId}/bundle-offers/available`);
    return resp.data;
  },

  /**
   * Bundles featured cross-epicerie pour la home client (carousel "Offres
   * mises en avant"). Backend cap a 20 max.
   */
  async listFeatured(limit = 8): Promise<BundleOffer[]> {
    const resp = await api.get<BundleOffer[]>('/bundle-offers/featured', {
      params: { limit },
    });
    return resp.data;
  },

  /**
   * Detail public d'un bundle (deep link / chatbot). 404 si non-ACTIVE
   * ou hors validity window — strict pour empecher le scraping de DRAFT.
   */
  async getPublic(id: number): Promise<BundleOffer> {
    const resp = await api.get<BundleOffer>(`/bundle-offers/public/${id}`);
    return resp.data;
  },
};

export default bundleOfferService;
