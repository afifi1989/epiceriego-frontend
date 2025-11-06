import { User } from '../type';
import api from './api';

export const profileService = {
  /**
   * Récupère le profil complet de l'utilisateur connecté
   */
  getMyProfile: async (): Promise<User> => {
    try {
      const response = await api.get<User>('/users/profile');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la récupération du profil';
    }
  },

  /**
   * Met à jour le profil de l'utilisateur
   */
  updateProfile: async (data: Partial<User>): Promise<User> => {
    try {
      const response = await api.put<User>('/users/profile', data);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la mise à jour du profil';
    }
  },
};
