import { Product } from '../type';
import api from './api';

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
   */
  addProductWithImage: async (formData: FormData): Promise<Product> => {
    try {
      const response = await api.post<Product>('/products', formData, {
        headers: {
          // Ne pas définir Content-Type manuellement - laisser axios le gérer
          // Cela permet à axios de générer correctement la boundary pour le multipart
        },
        timeout: 30000, // Augmenter le timeout pour les uploads d'image
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'ajout du produit';
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
   */
  updateProductWithImage: async (id: number, formData: FormData): Promise<Product> => {
    try {
      const response = await api.put<Product>(`/products/${id}`, formData, {
        headers: {
          // Ne pas définir Content-Type manuellement - laisser axios le gérer
          // Cela permet à axios de générer correctement la boundary pour le multipart
        },
        timeout: 30000, // Augmenter le timeout pour les uploads d'image
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la modification du produit';
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
