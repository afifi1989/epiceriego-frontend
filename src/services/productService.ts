import { Product } from '../type';
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

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
   * Récupère les produits d'une épicerie spécifique
   */
  getProductsByEpicerie: async (epicerieId: number): Promise<Product[]> => {
    try {
      const response = await api.get<Product[]>(`/products/epicerie/${epicerieId}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
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
};
