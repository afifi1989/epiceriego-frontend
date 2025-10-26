import api from './api';
import { Epicerie } from '../type';

export const epicerieService = {
  /**
   * Récupère toutes les épiceries
   * Optionnel : Filtre par proximité géographique
   */
  getAllEpiceries: async (
    lat?: number, 
    lon?: number, 
    radius: number = 10
  ): Promise<Epicerie[]> => {
    try {
      const params: any = {};
      if (lat && lon) {
        params.lat = lat;
        params.lon = lon;
        params.radius = radius;
      }
      
      const response = await api.get<Epicerie[]>('/epiceries', { params });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des épiceries';
    }
  },

  /**
   * Récupère une épicerie par son ID
   */
  getEpicerieById: async (id: number): Promise<Epicerie> => {
    try {
      const response = await api.get<Epicerie>(`/epiceries/${id}`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Épicerie non trouvée';
    }
  },

  /**
   * Récupère l'épicerie de l'épicier connecté
   */
  getMyEpicerie: async (): Promise<Epicerie> => {
    try {
      const response = await api.get<Epicerie>('/epiceries/my-epicerie');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Met à jour l'épicerie de l'épicier connecté
   */
  updateMyEpicerie: async (data: Partial<Epicerie>): Promise<Epicerie> => {
    try {
      const response = await api.put<Epicerie>('/epiceries/my-epicerie', data);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la mise à jour';
    }
  },
};