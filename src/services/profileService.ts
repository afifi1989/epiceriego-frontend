import { SupportedLanguage, User } from '../type';
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

  /**
   * Upload une photo de profil
   */
  uploadProfilePhoto: async (imageUri: string): Promise<{ photoUrl: string }> => {
    try {
      // Créer un FormData pour l'upload
      const formData = new FormData();
      
      // Extraire le nom et l'extension du fichier
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // Ajouter l'image au FormData
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: type,
      } as any);

      console.log('[ProfileService] Uploading photo:', filename, type);

      const response = await api.post<{ photoUrl: string }>('/users/profile/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[ProfileService] Photo uploaded successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[ProfileService] Upload error:', error);
      throw error.response?.data?.message || 'Erreur lors de l\'upload de la photo';
    }
  },

  /**
   * Met à jour la langue préférée de l'utilisateur en base de données.
   * Appelé silencieusement depuis LanguageContext lors d'un changement de langue.
   * Best-effort : l'échec n'empêche pas l'utilisation de l'app.
   */
  updateLanguage: async (language: SupportedLanguage): Promise<void> => {
    await api.put('/users/profile/language', { language });
  },

  /**
   * Change le mot de passe de l'utilisateur connecté (requiert l'ancien mot de passe)
   * Endpoint backend : PUT /users/password
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await api.put('/users/password', {
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
      });
    } catch (error: any) {
      throw error.response?.data?.message || 'Impossible de modifier le mot de passe';
    }
  },

  /**
   * Supprime la photo de profil
   */
  deleteProfilePhoto: async (): Promise<void> => {
    try {
      await api.delete('/users/profile/photo');
      console.log('[ProfileService] Photo deleted successfully');
    } catch (error: any) {
      console.error('[ProfileService] Delete photo error:', error);
      throw error.response?.data?.message || 'Erreur lors de la suppression de la photo';
    }
  },
};
