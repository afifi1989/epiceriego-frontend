import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import { BarcodeProductResult, Product } from '../type';
import api from './api';

// Cache mémoire pour les produits par épicerie (TTL : 5 minutes) — utilisé par l'ancien endpoint liste
const PRODUCTS_CACHE_TTL = 5 * 60 * 1000;
const productsCache = new Map<number, { data: Product[]; ts: number }>();

export interface ProductPage {
  content: Product[];
  totalElements: number;
  totalPages: number;
  last: boolean;
  number: number; // page actuelle (0-indexé)
  size: number;
}

export const productService = {
  /**
   * Récupère tous les produits
   * Optionnel : Filtre par épicerie
   */
  getAllProducts: async (epicerieId?: number): Promise<Product[]> => {
    try {
      const params = epicerieId ? { epicerieId } : {};
      const response = await api.get<Product[]>('/products', { params });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des produits';
    }
  },

  /**
   * Récupère les produits d'une épicerie spécifique (avec cache 5 min)
   */
  getProductsByEpicerie: async (epicerieId: number, forceRefresh = false, includeUnavailable = false): Promise<Product[]> => {
    try {
      const cached = productsCache.get(epicerieId);
      if (!forceRefresh && cached && Date.now() - cached.ts < PRODUCTS_CACHE_TTL) {
        return cached.data;
      }
      const params: Record<string, any> = {};
      if (includeUnavailable) params.includeUnavailable = 'true';
      const response = await api.get<Product[]>(`/products/epicerie/${epicerieId}`, { params });
      productsCache.set(epicerieId, { data: response.data, ts: Date.now() });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Invalide le cache des produits d'une épicerie (à appeler après ajout/modif/suppression)
   */
  invalidateProductsCache: (epicerieId: number): void => {
    productsCache.delete(epicerieId);
  },

  /**
   * Récupère les produits d'une épicerie avec pagination serveur.
   * Supporte la recherche par nom et le filtre par catégorie.
   * Endpoint : GET /products/epicerie/{id}/paginated
   */
  getProductsByEpiceriePaginated: async (
    epicerieId: number,
    page: number = 0,
    size: number = 20,
    search?: string,
    categoryIds?: number[],
    tagIds?: number[],
  ): Promise<ProductPage> => {
    try {
      const params: Record<string, any> = { page, size };
      if (search && search.trim()) params.search = search.trim();
      if (categoryIds && categoryIds.length > 0) params.categoryIds = categoryIds;
      if (tagIds && tagIds.length > 0) params.tagIds = tagIds;
      const response = await api.get<ProductPage>(
        `/products/epicerie/${epicerieId}/paginated`,
        { params },
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des produits';
    }
  },

  /**
   * Récupère un produit par son ID
   */
  getProductById: async (id: number): Promise<Product> => {
    try {
      const response = await api.get<Product>(`/products/${id}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Produit non trouvé';
    }
  },

  /**
   * Traduit automatiquement un produit du français vers AR / EN / TZ via le LLM.
   * Retourne { fr, ar, en, tz } → { nom, description }
   */
  translateProduct: async (nom: string, description: string): Promise<Record<string, { nom: string; description: string }>> => {
    try {
      const response = await api.post<Record<string, { nom: string; description: string }>>(
        '/products/translate',
        { nom, description }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Traduction automatique indisponible');
    }
  },

  /**
   * Ajoute un nouveau produit (épicier uniquement)
   */
  addProduct: async (productData: Partial<Product>): Promise<Product> => {
    try {
      const response = await api.post<Product>('/products', productData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'ajout du produit';
    }
  },

  /**
   * Ajoute un nouveau produit avec image (multipart/form-data)
   * Utilise fetch API pour contourner les problèmes HTTPS avec FormData
   */
  addProductWithImage: async (formData: FormData): Promise<Product> => {
    try {
      console.log('[ProductService] Envoi du produit avec image...');

      // Récupérer le token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      // Utiliser fetch API directement pour FormData
      // Cela contourne les problèmes HTTPS/SSL avec axios et React Native
      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('[ProductService] Envoi avec fetch...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/products`, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[ProductService] Erreur réponse:', {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        });
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('[ProductService] Produit créé avec succès:', responseData);
      return responseData;
    } catch (error: any) {
      console.error('[ProductService] Erreur création produit:', {
        message: error.message,
        stack: error.stack,
      });
      throw error.message || 'Erreur lors de l\'ajout du produit';
    }
  },

  /**
   * Modifie un produit existant
   */
  updateProduct: async (id: number, productData: Partial<Product>): Promise<Product> => {
    try {
      const response = await api.put<Product>(`/products/${id}`, productData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la modification';
    }
  },

  /**
   * Modifie un produit avec image (multipart/form-data)
   * Utilise fetch API pour contourner les problèmes HTTPS avec FormData
   */
  updateProductWithImage: async (id: number, formData: FormData): Promise<Product> => {
    try {
      console.log('[ProductService] Modification du produit avec image...');

      // Récupérer le token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      // Utiliser fetch API directement pour FormData
      // Cela contourne les problèmes HTTPS/SSL avec axios et React Native
      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('[ProductService] Envoi avec fetch...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[ProductService] Erreur réponse:', {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        });
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('[ProductService] Produit modifié avec succès:', responseData);
      return responseData;
    } catch (error: any) {
      console.error('[ProductService] Erreur modification produit:', {
        message: error.message,
        stack: error.stack,
      });
      throw error.message || 'Erreur lors de la modification du produit';
    }
  },

  /**
   * Active ou désactive la disponibilité d'un produit.
   * Endpoint dédié : PATCH /products/{id}/availability
   */
  toggleAvailability: async (id: number, isAvailable: boolean): Promise<Product> => {
    try {
      const response = await api.patch<Product>(`/products/${id}/availability`, { isAvailable });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du changement de disponibilité';
    }
  },

  /**
   * Supprime un produit (soft delete)
   */
  deleteProduct: async (id: number): Promise<{ message: string }> => {
    try {
      const response = await api.delete<{ message: string }>(`/products/${id}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la suppression';
    }
  },

  /**
   * Récupère les produits tendance
   * TODO: Implémenter la logique côté backend
   */
  getTrendingProducts: async (limit: number = 6): Promise<Product[]> => {
    try {
      // Pour l'instant, retourne les produits les plus récents
      const response = await api.get<Product[]>('/products', {
        params: { limit }
      });
      return response.data.slice(0, limit);
    } catch (error: any) {
      console.log('Erreur getTrendingProducts:', error);
      return [];
    }
  },

  /**
   * Récupère les produits récemment consultés
   * TODO: Implémenter avec AsyncStorage
   */
  getRecentlyViewedProducts: async (limit: number = 4): Promise<Product[]> => {
    try {
      // Pour l'instant, retourne un tableau vide
      // TODO: Implémenter la logique de récupération depuis AsyncStorage
      return [];
    } catch (error: any) {
      console.log('Erreur getRecentlyViewedProducts:', error);
      return [];
    }
  },

  /**
   * Récupère les URLs des images d'un produit
   * TODO: Implémenter si nécessaire
   */
  getImageUrl: async (productId: number): Promise<string[]> => {
    try {
      const product = await productService.getProductById(productId);
      return product.photoUrl ? [product.photoUrl] : [];
    } catch (error: any) {
      console.log('Erreur getImageUrls:', error);
      return [];
    }
  },
  getImageUrls: async (productId: number): Promise<string[]> => {
    try {
      const product = await productService.getProductById(productId);
      return product.photoUrl ? [product.photoUrl] : [];
    } catch (error: any) {
      console.log('Erreur getImageUrls:', error);
      return [];
    }
  },

  /**
   * Recherche un produit par son code-barre (EAN-13, UPC, interne…).
   * Retourne le produit avec matchedUnitId si le barcode est lié à une unité.
   * Endpoint: GET /produits/barcode/{barcode}
   */
  getProductByBarcode: async (barcode: string): Promise<BarcodeProductResult> => {
    try {
      const encoded = encodeURIComponent(barcode.trim());
      const response = await api.get<BarcodeProductResult>(`/produits/barcode/${encoded}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Produit non trouvé pour ce code-barre';
    }
  },
};
