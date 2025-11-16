import { Epicerie } from '../type';
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

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

  /**
   * Upload la photo de profil de l'épicerie
   * Utilise fetch API pour supporter les FormData avec les images
   */
  uploadProfilePhoto: async (imageUri: string, base64?: string): Promise<Epicerie> => {
    try {
      console.log('[EpicerieService] Envoi de la photo de profil...');

      // Récupérer le token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      // Créer FormData pour l'upload
      const formData = new FormData();

      // Ajouter l'image
      if (base64) {
        // Si on a le base64, utiliser un Blob
        const blob = base64ToBlob(base64, 'image/jpeg');
        formData.append('photo', blob, 'profile.jpg');
      } else {
        // Sinon, utiliser l'URI directe
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('photo', blob, 'profile.jpg');
      }

      console.log('[EpicerieService] Envoi avec fetch...');

      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uploadResponse = await fetch(
        `${API_CONFIG.BASE_URL}/epiceries/my-epicerie/photo`,
        {
          method: 'POST',
          headers: headers,
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('[EpicerieService] Erreur upload:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body: errorData,
        });
        throw new Error(
          `Erreur HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`
        );
      }

      const responseData = await uploadResponse.json();
      console.log('[EpicerieService] Photo uploadée avec succès');
      return responseData;
    } catch (error: any) {
      console.error('[EpicerieService] Erreur upload photo:', {
        message: error.message,
        stack: error.stack,
      });
      throw error.message || 'Erreur lors de l\'upload de la photo';
    }
  },

  /**
   * Upload la photo de présentation (bannière) de l'épicerie
   * Utilise fetch API pour supporter les FormData avec les images
   */
  uploadPresentationPhoto: async (epicerieId: number, imageUri: string, base64?: string): Promise<Epicerie> => {
    try {
      console.log('[EpicerieService] Envoi de la photo de présentation...');

      // Récupérer le token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      // Créer FormData pour l'upload
      const formData = new FormData();

      // Ajouter l'image
      if (base64) {
        // Si on a le base64, utiliser un Blob
        const blob = base64ToBlob(base64, 'image/jpeg');
        formData.append('photo', blob, 'presentation.jpg');
      } else {
        // Sinon, utiliser l'URI directe
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('photo', blob, 'presentation.jpg');
      }

      console.log('[EpicerieService] Envoi avec fetch...');

      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uploadResponse = await fetch(
        `${API_CONFIG.BASE_URL}/epiceries/${epicerieId}/presentation-photo`,
        {
          method: 'POST',
          headers: headers,
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('[EpicerieService] Erreur upload:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body: errorData,
        });
        throw new Error(
          `Erreur HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`
        );
      }

      const responseData = await uploadResponse.json();
      console.log('[EpicerieService] Photo de présentation uploadée avec succès');
      return responseData;
    } catch (error: any) {
      console.error('[EpicerieService] Erreur upload photo de présentation:', {
        message: error.message,
        stack: error.stack,
      });
      throw error.message || 'Erreur lors de l\'upload de la photo de présentation';
    }
  },

  /**
   * Met à jour la photo de présentation (bannière) de l'épicerie
   */
  updatePresentationPhoto: async (epicerieId: number, imageUri: string, base64?: string): Promise<Epicerie> => {
    try {
      console.log('[EpicerieService] Mise à jour de la photo de présentation...');

      // Récupérer le token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      // Créer FormData pour l'upload
      const formData = new FormData();

      // Ajouter l'image
      if (base64) {
        const blob = base64ToBlob(base64, 'image/jpeg');
        formData.append('photo', blob, 'presentation.jpg');
      } else {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('photo', blob, 'presentation.jpg');
      }

      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uploadResponse = await fetch(
        `${API_CONFIG.BASE_URL}/epiceries/${epicerieId}/presentation-photo`,
        {
          method: 'PUT',
          headers: headers,
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('[EpicerieService] Erreur update:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body: errorData,
        });
        throw new Error(
          `Erreur HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`
        );
      }

      const responseData = await uploadResponse.json();
      console.log('[EpicerieService] Photo de présentation mise à jour avec succès');
      return responseData;
    } catch (error: any) {
      console.error('[EpicerieService] Erreur update photo de présentation:', {
        message: error.message,
        stack: error.stack,
      });
      throw error.message || 'Erreur lors de la mise à jour de la photo de présentation';
    }
  },

  /**
   * Supprime la photo de présentation (bannière) de l'épicerie
   */
  deletePresentationPhoto: async (epicerieId: number): Promise<any> => {
    try {
      console.log('[EpicerieService] Suppression de la photo de présentation...');

      // Récupérer le token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const deleteResponse = await fetch(
        `${API_CONFIG.BASE_URL}/epiceries/${epicerieId}/presentation-photo`,
        {
          method: 'DELETE',
          headers: headers,
        }
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.text();
        console.error('[EpicerieService] Erreur suppression:', {
          status: deleteResponse.status,
          statusText: deleteResponse.statusText,
          body: errorData,
        });
        throw new Error(
          `Erreur HTTP ${deleteResponse.status}: ${deleteResponse.statusText}`
        );
      }

      const responseData = await deleteResponse.json();
      console.log('[EpicerieService] Photo de présentation supprimée avec succès');
      return responseData;
    } catch (error: any) {
      console.error('[EpicerieService] Erreur suppression photo de présentation:', {
        message: error.message,
        stack: error.stack,
      });
      throw error.message || 'Erreur lors de la suppression de la photo de présentation';
    }
  },
};

/**
 * Convertit une chaîne base64 en Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
