import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Notification {
  id: number;
  userId: number;
  titre: string;
  message: string;
  type: 'ORDER' | 'PROMOTION' | 'DELIVERY' | 'ALERT' | 'INFO';
  isRead: boolean;
  dateCreated: string;
  dateRead?: string;
  data?: {
    orderId?: number;
    epicerieId?: number;
    [key: string]: any;
  };
}

export interface NotificationResponse {
  id: number;
  titre: string;
  message: string;
  type: string;
  isRead: boolean;
  dateCreated: string;
  dateRead?: string;
}

const NOTIFICATIONS_STORAGE_KEY = 'notifications_history';
const UNREAD_COUNT_KEY = 'notifications_unread_count';

/**
 * Service pour gérer les notifications de l'utilisateur
 */
export const notificationService = {
  /**
   * Récupère toutes les notifications de l'utilisateur
   */
  getAllNotifications: async (page: number = 0, size: number = 50): Promise<Notification[]> => {
    try {
      console.log('[NotificationService] Récupération des notifications, page:', page);
      const response = await api.get<Notification[]>('/notifications', {
        params: { page, size }
      });
      console.log('[NotificationService] Notifications récupérées:', response.data.length);

      // Sauvegarder localement aussi
      await notificationService.saveNotificationsLocal(response.data);

      return response.data;
    } catch (error: any) {
      console.warn('[NotificationService] Fallback sur AsyncStorage:', error.message);
      try {
        const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch (storageError) {
        console.error('[NotificationService] Erreur AsyncStorage:', storageError);
        return [];
      }
    }
  },

  /**
   * Récupère les notifications non lues
   */
  getUnreadNotifications: async (): Promise<Notification[]> => {
    try {
      console.log('[NotificationService] Récupération des notifications non lues');
      const response = await api.get<Notification[]>('/notifications/unread');
      console.log('[NotificationService] Notifications non lues:', response.data.length);
      return response.data;
    } catch (error: any) {
      console.warn('[NotificationService] Fallback sur AsyncStorage:', error.message);
      try {
        const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        const notifications = data ? JSON.parse(data) : [];
        return notifications.filter((n: Notification) => !n.isRead);
      } catch (storageError) {
        console.error('[NotificationService] Erreur AsyncStorage:', storageError);
        return [];
      }
    }
  },

  /**
   * Marque une notification comme lue
   */
  markAsRead: async (notificationId: number): Promise<boolean> => {
    try {
      console.log('[NotificationService] Marquage comme lu:', notificationId);
      await api.put(`/notifications/${notificationId}/read`, {});
      console.log('[NotificationService] Notification marquée comme lue');
      return true;
    } catch (error: any) {
      console.warn('[NotificationService] Fallback sur AsyncStorage:', error.message);
      try {
        const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        let notifications = data ? JSON.parse(data) : [];

        notifications = notifications.map((n: Notification) =>
          n.id === notificationId
            ? { ...n, isRead: true, dateRead: new Date().toISOString() }
            : n
        );

        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
        console.log('[NotificationService] Notification marquée comme lue localement');
        return true;
      } catch (storageError) {
        console.error('[NotificationService] Erreur marquage local:', storageError);
        return false;
      }
    }
  },

  /**
   * Marque toutes les notifications comme lues
   */
  markAllAsRead: async (): Promise<boolean> => {
    try {
      console.log('[NotificationService] Marquage de toutes les notifications comme lues');
      await api.put('/notifications/mark-all-read', {});
      console.log('[NotificationService] Toutes les notifications marquées comme lues');
      return true;
    } catch (error: any) {
      console.warn('[NotificationService] Fallback sur AsyncStorage:', error.message);
      try {
        const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        let notifications = data ? JSON.parse(data) : [];

        notifications = notifications.map((n: Notification) => ({
          ...n,
          isRead: true,
          dateRead: new Date().toISOString()
        }));

        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
        console.log('[NotificationService] Toutes les notifications marquées comme lues localement');
        return true;
      } catch (storageError) {
        console.error('[NotificationService] Erreur marquage global local:', storageError);
        return false;
      }
    }
  },

  /**
   * Supprime une notification
   */
  deleteNotification: async (notificationId: number): Promise<boolean> => {
    try {
      console.log('[NotificationService] Suppression de notification:', notificationId);
      await api.delete(`/notifications/${notificationId}`);
      console.log('[NotificationService] Notification supprimée');
      return true;
    } catch (error: any) {
      console.warn('[NotificationService] Fallback sur AsyncStorage:', error.message);
      try {
        const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        let notifications = data ? JSON.parse(data) : [];

        notifications = notifications.filter((n: Notification) => n.id !== notificationId);

        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
        console.log('[NotificationService] Notification supprimée localement');
        return true;
      } catch (storageError) {
        console.error('[NotificationService] Erreur suppression locale:', storageError);
        return false;
      }
    }
  },

  /**
   * Obtient le nombre de notifications non lues
   */
  getUnreadCount: async (): Promise<number> => {
    try {
      console.log('[NotificationService] Récupération du nombre non lues');
      const response = await api.get<{ count: number }>('/notifications/unread/count');
      console.log('[NotificationService] Nombre non lues:', response.data.count);

      // Sauvegarder localement
      await AsyncStorage.setItem(UNREAD_COUNT_KEY, response.data.count.toString());

      return response.data.count;
    } catch (error: any) {
      console.warn('[NotificationService] Fallback sur AsyncStorage:', error.message);
      try {
        const unread = await notificationService.getUnreadNotifications();
        return unread.length;
      } catch (storageError) {
        console.error('[NotificationService] Erreur récupération count:', storageError);
        return 0;
      }
    }
  },

  /**
   * Sauvegarde les notifications localement
   */
  saveNotificationsLocal: async (notifications: Notification[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
      console.log('[NotificationService] Notifications sauvegardées localement');
    } catch (error) {
      console.error('[NotificationService] Erreur sauvegarde locale:', error);
    }
  },

  /**
   * Efface l'historique des notifications (pour le logout)
   */
  clearNotifications: async (): Promise<void> => {
    try {
      console.log('[NotificationService] Effacement des notifications');
      await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      await AsyncStorage.removeItem(UNREAD_COUNT_KEY);
      console.log('[NotificationService] Notifications effacées');
    } catch (error) {
      console.error('[NotificationService] Erreur effacement:', error);
    }
  },

  /**
   * Obtient les notifications groupées par date
   */
  getNotificationsGroupedByDate: async (): Promise<{ [key: string]: Notification[] }> => {
    try {
      const notifications = await notificationService.getAllNotifications(0, 200);

      const grouped: { [key: string]: Notification[] } = {};

      notifications.forEach(notification => {
        const date = new Date(notification.dateCreated);
        const dateKey = date.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(notification);
      });

      // Trier par date décroissante
      const sorted: { [key: string]: Notification[] } = {};
      Object.keys(grouped)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .forEach(date => {
          sorted[date] = grouped[date];
        });

      return sorted;
    } catch (error) {
      console.error('[NotificationService] Erreur groupage:', error);
      return {};
    }
  },
};
