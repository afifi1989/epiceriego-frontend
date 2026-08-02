import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationTypeValue } from './notifications';

export interface Notification {
  id: number;
  userId: number;
  titre: string;
  message: string;
  // String (not strict union) so unknown future types from backend don't cause type errors.
  // Resolution is delegated to helpers in src/services/notifications/.
  type: NotificationTypeValue | string;
  isRead: boolean;
  dateCreated: string;
  dateRead?: string;
  data?: {
    orderId?: number;
    epicerieId?: number;
    clientId?: number;
    [key: string]: any;
  } | string;
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
   * Récupère toutes les notifications de l'utilisateur.
   *
   * Comportement erreur réseau :
   *  - Par défaut (silent), on retombe silencieusement sur le cache
   *    AsyncStorage, ou sur `[]` si aucun cache. Ce comportement historique
   *    est conservé pour les appelants qui n'ont pas d'état d'erreur dédié
   *    (badge, écran épicier).
   *  - Avec `{ throwIfNoCache: true }`, on continue de renvoyer le cache s'il
   *    existe (bonne UX offline), MAIS si l'appel réseau échoue ET qu'aucun
   *    cache exploitable n'existe, on **propage l'erreur** pour que l'écran
   *    puisse afficher un état "Réessayer" au lieu d'une liste vide trompeuse.
   *
   * Note : un succès réseau qui renvoie `[]` n'est PAS une erreur (vide
   * légitime) — seul un échec réseau sans cache déclenche le throw.
   */
  getAllNotifications: async (
    page: number = 0,
    size: number = 50,
    options?: { throwIfNoCache?: boolean }
  ): Promise<Notification[]> => {
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
      // Lecture du cache isolée : on ne veut pas qu'un `throw` volontaire
      // (propagation d'erreur réseau) soit repris par le catch du storage.
      let cached: Notification[] | null = null;
      try {
        const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        cached = data != null ? JSON.parse(data) : null;
      } catch (storageError) {
        console.error('[NotificationService] Erreur AsyncStorage:', storageError);
        cached = null;
      }

      // Cache disponible : on le renvoie (offline OK), même s'il est vide.
      if (cached != null) {
        return cached;
      }
      // Pas de cache exploitable + échec réseau : on propage si l'appelant
      // l'exige, pour distinguer "échec" de "vide légitime".
      if (options?.throwIfNoCache) {
        throw error;
      }
      return [];
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
      // throwIfNoCache: un échec réseau sans cache doit remonter à l'écran
      // (état "Réessayer") au lieu d'être masqué en `{}` (faux "vide").
      const notifications = await notificationService.getAllNotifications(0, 200, {
        throwIfNoCache: true,
      });

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
      // On NE masque PLUS l'erreur en renvoyant `{}` (qui serait interprété
      // comme "aucune notification"). On la propage pour que l'écran affiche
      // l'état d'erreur + "Réessayer". Le cache offline reste géré en amont
      // par getAllNotifications (renvoyé sans throw s'il existe).
      console.error('[NotificationService] Erreur groupage:', error);
      throw error;
    }
  },
};
