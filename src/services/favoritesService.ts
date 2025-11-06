import { Epicerie } from '../type';
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_STORAGE_KEY = 'favorites_epiceries';

/**
 * Service pour gérer les épiceries favorites de l'utilisateur
 * Fonctionne avec fallback sur AsyncStorage si l'API n'est pas disponible
 */
export const favoritesService = {
  /**
   * Récupère toutes les épiceries favorites de l'utilisateur
   */
  getFavoriteEpiceries: async (): Promise<Epicerie[]> => {
    try {
      console.log('[FavoritesService] Récupération des épiceries favorites...');
      const response = await api.get<Epicerie[]>('/favorites/epiceries');
      console.log('[FavoritesService] Épiceries favorites récupérées:', response.data);
      return response.data;
    } catch (error: any) {
      console.warn('[FavoritesService] Fallback sur AsyncStorage - Récupération des favoris locaux:', error.message);
      try {
        const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch (storageError) {
        console.error('[FavoritesService] Erreur AsyncStorage:', storageError);
        return [];
      }
    }
  },

  /**
   * Ajoute une épicerie aux favoris
   * @param epicerieId - ID de l'épicerie à ajouter
   */
  addFavorite: async (epicerieId: number): Promise<boolean> => {
    try {
      console.log('[FavoritesService] Ajout aux favoris:', epicerieId);
      await api.post(`/favorites/epiceries/${epicerieId}`, {});
      console.log('[FavoritesService] Épicerie ajoutée aux favoris');
      return true;
    } catch (error: any) {
      console.warn('[FavoritesService] Fallback sur AsyncStorage - Ajout local:', error.message);
      try {
        // Mode développement: stockage local
        const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        const favorites = data ? JSON.parse(data) : [];

        // Vérifier que l'ID n'existe pas déjà
        if (!favorites.some((fav: any) => fav.id === epicerieId)) {
          // Récupérer l'épicerie complète si possible
          // Pour l'instant, on stocke juste l'ID
          favorites.push({ id: epicerieId });
          await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
          console.log('[FavoritesService] Épicerie ajoutée localement');
        }
        return true;
      } catch (storageError) {
        console.error('[FavoritesService] Erreur ajout local:', storageError);
        return false;
      }
    }
  },

  /**
   * Supprime une épicerie des favoris
   * @param epicerieId - ID de l'épicerie à supprimer
   */
  removeFavorite: async (epicerieId: number): Promise<boolean> => {
    try {
      console.log('[FavoritesService] Suppression des favoris:', epicerieId);
      await api.delete(`/favorites/epiceries/${epicerieId}`);
      console.log('[FavoritesService] Épicerie supprimée des favoris');
      return true;
    } catch (error: any) {
      console.warn('[FavoritesService] Fallback sur AsyncStorage - Suppression locale:', error.message);
      try {
        // Mode développement: suppression locale
        const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        let favorites = data ? JSON.parse(data) : [];

        // Filtrer pour supprimer l'épicerie
        favorites = favorites.filter((fav: any) => fav.id !== epicerieId);
        await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        console.log('[FavoritesService] Épicerie supprimée localement');
        return true;
      } catch (storageError) {
        console.error('[FavoritesService] Erreur suppression locale:', storageError);
        return false;
      }
    }
  },

  /**
   * Vérifie si une épicerie est dans les favoris
   * @param epicerieId - ID de l'épicerie à vérifier
   */
  isFavorite: async (epicerieId: number): Promise<boolean> => {
    try {
      console.log('[FavoritesService] Vérification si favori:', epicerieId);
      const response = await api.get<{ isFavorite: boolean }>(
        `/favorites/epiceries/${epicerieId}/is-favorite`
      );
      console.log('[FavoritesService] Résultat:', response.data.isFavorite);
      return response.data.isFavorite;
    } catch (error: any) {
      console.warn('[FavoritesService] Fallback sur AsyncStorage - Vérification locale:', error.message);
      try {
        // Mode développement: vérification locale
        const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        const favorites = data ? JSON.parse(data) : [];
        const isFav = favorites.some((fav: any) => fav.id === epicerieId);
        console.log('[FavoritesService] Résultat local:', isFav);
        return isFav;
      } catch (storageError) {
        console.error('[FavoritesService] Erreur vérification locale:', storageError);
        return false;
      }
    }
  },

  /**
   * Récupère les IDs des épiceries favorites
   * Utile pour les vérifications rapides
   */
  getFavoriteIds: async (): Promise<number[]> => {
    try {
      const favorites = await favoritesService.getFavoriteEpiceries();
      return favorites.map(fav => fav.id);
    } catch (error) {
      console.error('[FavoritesService] Erreur récupération IDs:', error);
      return [];
    }
  },

  /**
   * Bascule le statut favori d'une épicerie
   * @param epicerieId - ID de l'épicerie
   * @param isFavorite - État actuel du statut favori
   */
  toggleFavorite: async (epicerieId: number, isFavorite: boolean): Promise<boolean> => {
    if (isFavorite) {
      return favoritesService.removeFavorite(epicerieId);
    } else {
      return favoritesService.addFavorite(epicerieId);
    }
  },

  /**
   * Efface tous les favoris de l'utilisateur (pour le logout)
   */
  clearFavorites: async (): Promise<void> => {
    try {
      console.log('[FavoritesService] Effacement des favoris');
      await AsyncStorage.removeItem(FAVORITES_STORAGE_KEY);
      console.log('[FavoritesService] Favoris effacés');
    } catch (error) {
      console.error('[FavoritesService] Erreur effacement favoris:', error);
    }
  },
};
