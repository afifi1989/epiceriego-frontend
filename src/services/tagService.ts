import { Tag } from '../type';
import api from './api';

export const tagService = {
  /** Liste tous les tags actifs (optionnel: filtrer par scope PRODUCT|CATEGORY) */
  getAll: async (scope?: string, lang?: string): Promise<Tag[]> => {
    const params: Record<string, string> = {};
    if (scope) params.scope = scope;
    const headers: Record<string, string> = {};
    if (lang) headers['Accept-Language'] = lang;
    const response = await api.get<Tag[]>('/tags', { params, headers });
    return response.data;
  },

  /** Tags applicables aux produits (langue du client — Accept-Language de l'intercepteur) */
  getForProducts: async (): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags', { params: { scope: 'PRODUCT' } });
    return response.data;
  },

  /** Tags pour l'épicier — toujours en français */
  getForProductsFr: async (): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags', {
      params: { scope: 'PRODUCT' },
      headers: { 'Accept-Language': 'fr' },
    });
    return response.data;
  },

  /** Tags utilisés dans une épicerie donnée (langue du client) */
  getByEpicerie: async (epicerieId: number): Promise<Tag[]> => {
    const response = await api.get<Tag[]>(`/tags/epicerie/${epicerieId}`);
    return response.data;
  },

  /** Recherche de tags par nom */
  search: async (query: string): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags/search', { params: { q: query } });
    return response.data;
  },

  /** Associer des tags à un produit (remplace les tags existants) */
  setProductTags: async (productId: number, tagIds: number[]): Promise<void> => {
    await api.post(`/tags/products/${productId}`, tagIds);
  },

  /** Retirer un tag d'un produit */
  removeProductTag: async (productId: number, tagId: number): Promise<void> => {
    await api.delete(`/tags/products/${productId}/${tagId}`);
  },
};
