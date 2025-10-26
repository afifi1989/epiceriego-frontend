import api from './api';

export interface Category {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
  subCategories?: SubCategory[];
}

export interface SubCategory {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
  categoryId: number;
  displayOrder: number;
  isActive: boolean;
}

export const categoryService = {
  /**
   * Récupère toutes les catégories actives avec leurs sous-catégories
   */
  getActiveCategories: async (): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>('/categories/active');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * Récupère toutes les catégories (actives et inactives)
   */
  getAllCategories: async (): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>('/categories');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * Récupère une catégorie par son ID
   */
  getCategoryById: async (id: number): Promise<Category> => {
    try {
      const response = await api.get<Category>(`/categories/${id}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Catégorie non trouvée';
    }
  },

  /**
   * Récupère les sous-catégories d'une catégorie
   */
  getSubCategories: async (categoryId: number): Promise<SubCategory[]> => {
    try {
      const response = await api.get<SubCategory[]>(`/categories/${categoryId}/sub-categories`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des sous-catégories';
    }
  },

  /**
   * Récupère les sous-catégories actives d'une catégorie
   */
  getActiveSubCategories: async (categoryId: number): Promise<SubCategory[]> => {
    try {
      const response = await api.get<SubCategory[]>(`/categories/${categoryId}/sub-categories/active`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des sous-catégories';
    }
  },

  /**
   * Récupère une sous-catégorie par son ID
   */
  getSubCategoryById: async (id: number): Promise<SubCategory> => {
    try {
      const response = await api.get<SubCategory>(`/categories/sub-categories/${id}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Sous-catégorie non trouvée';
    }
  },
};
