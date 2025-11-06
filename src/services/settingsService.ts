import api from './api';
import {
  NotificationSettings,
  UserPreferences,
  ChangePasswordRequest,
  DeleteAccountRequest,
} from '../type';

// Valeurs par défaut
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  pushNotifications: true,
  emailNotifications: true,
  orderNotifications: true,
  promoNotifications: true,
  deliveryNotifications: true,
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: 'fr',
  darkMode: false,
  currency: 'EUR',
  timezone: 'Europe/Paris',
};

export const settingsService = {
  /**
   * Récupère les préférences de notifications
   */
  getNotificationSettings: async (): Promise<NotificationSettings> => {
    try {
      console.log('[settingsService] Récupération des préférences notifications...');
      const response = await api.get<NotificationSettings>('/users/settings/notifications');
      console.log('[settingsService] ✅ Préférences notifications récupérées:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur récupération notifications:', error);
      // Retourner les valeurs par défaut en cas d'erreur
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  },

  /**
   * Met à jour les préférences de notifications
   */
  updateNotificationSettings: async (
    settings: NotificationSettings
  ): Promise<NotificationSettings> => {
    try {
      console.log('[settingsService] Mise à jour des préférences notifications...');
      const response = await api.put<{ message: string; data: NotificationSettings }>(
        '/users/settings/notifications',
        settings
      );
      console.log('[settingsService] ✅ Préférences notifications mises à jour:', response.data.data);
      return response.data.data;
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur mise à jour notifications:', error);
      throw error.response?.data?.message || 'Erreur lors de la mise à jour des notifications';
    }
  },

  /**
   * Récupère les préférences utilisateur
   */
  getUserPreferences: async (): Promise<UserPreferences> => {
    try {
      console.log('[settingsService] Récupération des préférences utilisateur...');
      const response = await api.get<UserPreferences>('/users/settings/preferences');
      console.log('[settingsService] ✅ Préférences utilisateur récupérées:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur récupération préférences:', error);
      // Retourner les valeurs par défaut en cas d'erreur
      return DEFAULT_USER_PREFERENCES;
    }
  },

  /**
   * Met à jour les préférences utilisateur
   */
  updateUserPreferences: async (
    preferences: UserPreferences
  ): Promise<UserPreferences> => {
    try {
      console.log('[settingsService] Mise à jour des préférences utilisateur...');
      const response = await api.put<{ message: string; data: UserPreferences }>(
        '/users/settings/preferences',
        preferences
      );
      console.log('[settingsService] ✅ Préférences utilisateur mises à jour:', response.data.data);
      return response.data.data;
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur mise à jour préférences:', error);
      throw error.response?.data?.message || 'Erreur lors de la mise à jour des préférences';
    }
  },

  /**
   * Change le mot de passe utilisateur
   */
  changePassword: async (passwordData: ChangePasswordRequest): Promise<void> => {
    try {
      console.log('[settingsService] Changement du mot de passe...');
      await api.put<{ message: string }>('/users/password', passwordData);
      console.log('[settingsService] ✅ Mot de passe changé avec succès');
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur changement mot de passe:', error);
      throw error.response?.data?.message || 'Erreur lors du changement du mot de passe';
    }
  },

  /**
   * Supprime le compte utilisateur
   */
  deleteAccount: async (deleteData: DeleteAccountRequest): Promise<void> => {
    try {
      console.log('[settingsService] Suppression du compte...');
      await api.delete<{ message: string }>('/users/account', {
        data: deleteData,
      });
      console.log('[settingsService] ✅ Compte supprimé avec succès');
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur suppression compte:', error);
      throw error.response?.data?.message || 'Erreur lors de la suppression du compte';
    }
  },

  /**
   * Récupère toutes les settings (notifications + préférences)
   */
  getAllSettings: async (): Promise<{
    notifications: NotificationSettings;
    preferences: UserPreferences;
  }> => {
    try {
      console.log('[settingsService] Récupération de toutes les settings...');
      const [notifications, preferences] = await Promise.all([
        settingsService.getNotificationSettings(),
        settingsService.getUserPreferences(),
      ]);
      console.log('[settingsService] ✅ Toutes les settings récupérées');
      return { notifications, preferences };
    } catch (error: any) {
      console.error('[settingsService] ❌ Erreur récupération settings:', error);
      return {
        notifications: DEFAULT_NOTIFICATION_SETTINGS,
        preferences: DEFAULT_USER_PREFERENCES,
      };
    }
  },
};
