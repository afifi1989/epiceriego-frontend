import { Epicerie } from '../type';
import api from './api';

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
   * Recherche des épiceries par proximité
   * @param lat - Latitude
   * @param lon - Longitude
   * @param radius - Rayon de recherche en km (défaut: 5)
   * @param page - Numéro de page (défaut: 0)
   * @param size - Nombre d'éléments par page (défaut: 20)
   */
  searchByProximity: async (
    lat: number,
    lon: number,
    radius: number = 5,
    page: number = 0,
    size: number = 20
  ): Promise<Epicerie[]> => {
    try {
      const response = await api.get<any>('/epiceries/search/proximity', {
        params: { lat, lon, radius, page, size }
      });
      // L'API retourne un objet paginé avec la propriété 'content'
      return response.data.content || [];
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la recherche par proximité';
    }
  },

  /**
   * Recherche des épiceries par nom
   * @param name - Nom de l'épicerie
   * @param page - Numéro de page (défaut: 0)
   * @param size - Nombre d'éléments par page (défaut: 20)
   */
  searchByName: async (
    name: string,
    page: number = 0,
    size: number = 20
  ): Promise<Epicerie[]> => {
    try {
      const response = await api.get<any>('/epiceries/search/name', {
        params: { name, page, size }
      });
      // L'API retourne un objet paginé avec la propriété 'content'
      return response.data.content || [];
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la recherche par nom';
    }
  },

  /**
   * Recherche combinée par proximité et nom
   * @param lat - Latitude
   * @param lon - Longitude
   * @param name - Nom de l'épicerie
   * @param radius - Rayon de recherche en km (défaut: 3)
   * @param page - Numéro de page (défaut: 0)
   * @param size - Nombre d'éléments par page (défaut: 10)
   */
  searchByProximityAndName: async (
    lat: number,
    lon: number,
    name: string,
    radius: number = 3,
    page: number = 0,
    size: number = 10
  ): Promise<Epicerie[]> => {
    try {
      const response = await api.get<any>('/epiceries/search/proximity-name', {
        params: { lat, lon, name, radius, page, size }
      });
      // L'API retourne un objet paginé avec la propriété 'content'
      return response.data.content || [];
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la recherche combinée';
    }
  },

  /**
   * Recherche des épiceries par adresse/zone
   * @param address - Adresse ou zone de recherche
   * @param page - Numéro de page (défaut: 0)
   * @param size - Nombre d'éléments par page (défaut: 20)
   */
  searchByAddress: async (
    address: string,
    page: number = 0,
    size: number = 20
  ): Promise<Epicerie[]> => {
    try {
      const response = await api.get<any>('/epiceries/search/address', {
        params: { address, page, size }
      });
      // L'API retourne un objet paginé avec la propriété 'content'
      return response.data.content || [];
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la recherche par adresse';
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
