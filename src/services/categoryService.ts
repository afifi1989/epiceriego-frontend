import api from './api';

/**
 * Interface Category - Structure hiérarchique
 * Une catégorie peut avoir un parent et des enfants (récursif)
 */
export interface Category {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
  parentId?: number | null;        // ID du parent (null = catégorie racine)
  level?: number;                  // Niveau dans l'arborescence (0=root, 1=child, etc.)
  children?: Category[];           // Enfants (récursif)
  path?: Category[];              // Chemin complet (pour breadcrumb)
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface pour créer/modifier une catégorie
 */
export interface CategoryRequest {
  name: string;
  description?: string;
  iconUrl?: string;
  parentId?: number | null;
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * @deprecated Interface obsolète - Utilisez Category avec parentId
 * Conservée temporairement pour compatibilité
 */
export interface SubCategory extends Category {
  categoryId?: number; // Mappé sur parentId
}

export const categoryService = {
  /**
   * Récupère toutes les catégories avec leur hiérarchie complète
   * ✨ NOUVEAU - Un seul appel pour tout l'arbre
   */
  getCategoriesTree: async (): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>('/categories/tree');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * Récupère toutes les catégories (liste plate sans hiérarchie)
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
   * Récupère toutes les catégories actives avec leur hiérarchie
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
   * Récupère une catégorie par son ID avec ses enfants et son chemin
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
   * ✨ NOUVEAU - Récupère les catégories racines d'une épicerie
   */
  getCategoriesByEpicerie: async (epicerieId: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/epicerie/${epicerieId}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * ✨ NOUVEAU - Récupère les catégories actives d'une épicerie
   */
  getActiveCategoriesByEpicerie: async (epicerieId: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/epicerie/${epicerieId}/available`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * ✨ NOUVEAU - Récupère l'arbre complet des catégories d'une épicerie
   */
  getCategoriesTreeByEpicerie: async (epicerieId: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/epicerie/${epicerieId}/tree`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * ✨ NOUVEAU - Récupère l'arbre complet des catégories actives d'une épicerie
   */
  getActiveTreeByEpicerie: async (epicerieId: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/epicerie/${epicerieId}/tree/available`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des catégories';
    }
  },

  /**
   * ✨ NOUVEAU - Récupère les enfants d'une catégorie pour une épicerie spécifique
   */
  getCategoryChildrenByEpicerie: async (categoryId: number, epicerieId: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/${categoryId}/epicerie/${epicerieId}/children`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des enfants';
    }
  },

  /**
   * ✨ NOUVEAU - Récupère les enfants actifs d'une catégorie pour une épicerie spécifique
   */
  getActiveCategoryChildrenByEpicerie: async (categoryId: number, epicerieId: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/${categoryId}/epicerie/${epicerieId}/children/available`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des enfants';
    }
  },

  getCategoryPath: async (id: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/${id}/path`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement du chemin';
    }
  },

  /**
   * ✨ NOUVEAU - Récupère les enfants directs d'une catégorie
   */
  getCategoryChildren: async (id: number): Promise<Category[]> => {
    try {
      const response = await api.get<Category[]>(`/categories/${id}/children`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des enfants';
    }
  },

  /**
   * Crée une nouvelle catégorie
   * @param data - Données de la catégorie (parentId = null pour catégorie racine)
   */
  createCategory: async (data: CategoryRequest): Promise<Category> => {
    try {
      const response = await api.post<Category>('/categories', {
        parentId: null,
        displayOrder: 0,
        isActive: true,
        ...data
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la création de la catégorie';
    }
  },

  /**
   * Met à jour une catégorie
   */
  updateCategory: async (id: number, data: CategoryRequest): Promise<Category> => {
    try {
      const response = await api.put<Category>(`/categories/${id}`, data);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la mise à jour de la catégorie';
    }
  },

  /**
   * Supprime une catégorie (et tous ses enfants en cascade)
   * ⚠️ ATTENTION: Supprime aussi tous les enfants récursivement
   */
  deleteCategory: async (id: number): Promise<void> => {
    try {
      await api.delete(`/categories/${id}`);
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la suppression de la catégorie';
    }
  },

  // ============================================
  // MÉTHODES DE COMPATIBILITÉ (DEPRECATED)
  // ============================================

  /**
   * @deprecated Utilisez getCategoryChildren à la place
   * Récupère les "sous-catégories" (enfants) d'une catégorie
   */
  getSubCategories: async (categoryId: number): Promise<Category[]> => {
    console.warn('⚠️ getSubCategories est obsolète, utilisez getCategoryChildren');
    return categoryService.getCategoryChildren(categoryId);
  },

  /**
   * @deprecated Utilisez getCategoryChildren avec filtrage isActive à la place
   * Récupère les sous-catégories actives d'une catégorie
   */
  getActiveSubCategories: async (categoryId: number): Promise<Category[]> => {
    console.warn('⚠️ getActiveSubCategories est obsolète, utilisez getCategoryChildren');
    const children = await categoryService.getCategoryChildren(categoryId);
    return children.filter(cat => cat.isActive);
  },

  /**
   * @deprecated Utilisez getCategoryById à la place
   * Récupère une sous-catégorie par son ID
   */
  getSubCategoryById: async (id: number): Promise<Category> => {
    console.warn('⚠️ getSubCategoryById est obsolète, utilisez getCategoryById');
    return categoryService.getCategoryById(id);
  },

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Aplatit l'arborescence des catégories en liste plate
   * Utile pour les selects/dropdowns
   */
  flattenCategories: (categories: Category[], level: number = 0): Category[] => {
    const result: Category[] = [];
    
    for (const category of categories) {
      result.push({ ...category, level });
      
      if (category.children && category.children.length > 0) {
        result.push(...categoryService.flattenCategories(category.children, level + 1));
      }
    }
    
    return result;
  },

  /**
   * Génère un texte de breadcrumb à partir du chemin
   */
  generateBreadcrumb: (path: Category[], separator: string = ' > '): string => {
    return path.map(cat => cat.name).join(separator);
  },

  /**
   * Trouve une catégorie dans l'arborescence par son ID
   */
  findCategoryInTree: (categories: Category[], id: number): Category | null => {
    for (const category of categories) {
      if (category.id === id) {
        return category;
      }
      
      if (category.children && category.children.length > 0) {
        const found = categoryService.findCategoryInTree(category.children, id);
        if (found) return found;
      }
    }
    
    return null;
  },

  /**
   * Génère un label avec indentation pour affichage dans un select
   */
  getLabelWithIndentation: (category: Category, indentChar: string = '—'): string => {
    const indent = indentChar.repeat(category.level || 0);
    return indent ? `${indent} ${category.name}` : category.name;
  }
};
