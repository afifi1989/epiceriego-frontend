import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { STORAGE_KEYS } from '../constants/config';
import api from './api';
import { parseNotificationData, resolveRoute, setupAndroidChannels } from './notifications';

/**
 * Push notification service.
 *
 * Type/channel/route logic lives in `./notifications/*` modules so they can
 * evolve independently and be reused (e.g. epicier app, future microservice).
 *
 * This file is in charge of: Expo SDK glue, token lifecycle, listener setup,
 * cold-start handling.
 */
export const pushNotificationService = {
  getTokenForLogin: async (): Promise<string | null> => {
    try {
      console.log('[PushNotificationService] 📱 Récupération du token pour la connexion...');

      if (!Device.isDevice) {
        console.log('[PushNotificationService] ⚠️ Emulateur/Simulator détecté - Token généré pour test');
        const testToken = `ExponentPushToken[TEST_${Date.now()}]`;
        return testToken;
      }

      console.log('[PushNotificationService] ✅ Dispositif physique détecté');

      const permResult = await Notifications.getPermissionsAsync();
      if (permResult.status !== 'granted') {
        console.log('[PushNotificationService] 🔔 Demande de permission pour les notifications...');
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[PushNotificationService] ⚠️ Permissions refusées - Pas de token');
          return null;
        }
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.error('[PushNotificationService] ❌ ProjectId manquant');
        return null;
      }

      let token;
      try {
        token = await Notifications.getExpoPushTokenAsync({ projectId });
      } catch (e: any) {
        console.error('[PushNotificationService] ❌ getExpoPushTokenAsync a levé:', e?.code, e?.message);
        console.error('[PushNotificationService] 💡 Vérifier google-services.json + FCM V1 credentials chez Expo');
        return null;
      }

      if (!token?.data) {
        console.error('[PushNotificationService] ❌ Aucun token reçu de Expo.');
        return null;
      }

      console.log('[PushNotificationService] ✅ Token obtenu pour la connexion:', token.data.substring(0, 30) + '...');
      return token.data;
    } catch (error: any) {
      console.error('[PushNotificationService] ❌ Erreur lors de getTokenForLogin:', error.message);
      return null;
    }
  },

  registerForPushNotifications: async (): Promise<string | null> => {
    try {
      console.log('[PushNotificationService] ========== ENREGISTREMENT PUSH ==========');

      if (!Device.isDevice) {
        console.warn('[PushNotificationService] ⚠️ Non sur un dispositif physique - Skip pour emulateur/simulator');
        const testToken = `ExponentPushToken[TEST_${Date.now()}]`;
        return testToken;
      }

      let existingStatus;
      try {
        const permResult = await Notifications.getPermissionsAsync();
        existingStatus = permResult.status;
      } catch (permError: any) {
        console.error('[PushNotificationService] ❌ Erreur lors de getPermissionsAsync:', permError.message);
        return null;
      }

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        } catch (reqError: any) {
          console.error('[PushNotificationService] ❌ Erreur lors de requestPermissionsAsync:', reqError.message);
          return null;
        }
      }

      if (finalStatus !== 'granted') {
        console.error('[PushNotificationService] ❌ PERMISSIONS REFUSÉES - Token non obtenu');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('[PushNotificationService] ❌ ERREUR: ProjectId EST VIDE!');
        return null;
      }

      let token;
      try {
        token = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log('[PushNotificationService] ✅ Token reçu:', token.data);
      } catch (tokenError: any) {
        console.error('[PushNotificationService] ❌ Erreur lors de getExpoPushTokenAsync:', tokenError.message);
        return null;
      }

      console.log('[PushNotificationService] ========== ENREGISTREMENT RÉUSSI ==========');
      return token.data;
    } catch (error: any) {
      console.error('[PushNotificationService] ❌ ERREUR GÉNÉRALE enregistrement:', error.message);
      return null;
    }
  },

  sendTokenToServer: async (token: string): Promise<boolean> => {
    try {
      const jwtToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!jwtToken) {
        console.error('[PushNotificationService] ⚠️ AUCUN JWT TOKEN EN AsyncStorage');
        return false;
      }

      const payload = {
        expoPushToken: token,
        deviceType: Device.osVersion || 'Unknown',
        platform: Device.modelName || 'Unknown',
      };

      try {
        const response = await api.post('/notifications/register-device', payload);
        console.log('[PushNotificationService] ✅ Token envoyé au serveur, status:', response.status);
        return true;
      } catch (error: any) {
        console.error('[PushNotificationService] ❌ Erreur envoi token:', error.response?.status, error.response?.data?.message || error.message);

        try {
          await AsyncStorage.setItem('pending_push_token', token);
        } catch {}

        return false;
      }
    } catch (error: any) {
      console.error('[PushNotificationService] ❌ Erreur:', error.message);
      return false;
    }
  },

  /**
   * Configure global listeners for incoming notifications & taps.
   * @returns unsubscribe function — caller MUST invoke on cleanup to avoid leaks.
   */
  setupNotificationHandlers: (router: any): (() => void) => {
    console.log('[PushNotificationService] Configuration des handlers...');

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PushNotificationService] Notification cliquée:', response.notification.request.content);
      const data = response.notification.request.content.data;
      pushNotificationService.handleNotificationPress(data, router);
    });

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[PushNotificationService] Notification reçue:', notification.request.content);
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  },

  /**
   * Handle the case where the app is launched (cold start) by tapping a
   * notification. Expo doesn't fire `addNotificationResponseReceivedListener`
   * for the initial response — we have to query it explicitly.
   */
  handleColdStartResponse: async (router: any): Promise<void> => {
    try {
      const initial = await Notifications.getLastNotificationResponseAsync();
      if (!initial) return;

      const data = initial.notification.request.content.data;
      console.log('[PushNotificationService] Cold start notification:', data);
      await pushNotificationService.handleNotificationPress(data, router);
    } catch (error) {
      console.error('[PushNotificationService] Erreur cold start:', error);
    }
  },

  handleNotificationPress: async (data: any, router: any): Promise<void> => {
    try {
      const isAuthenticated = await pushNotificationService.checkAuthentication();

      if (!isAuthenticated) {
        console.log('[PushNotificationService] Utilisateur non connecté, redirection vers login');
        setTimeout(() => router.replace('/(auth)/login'), 500);
        return;
      }

      // The deep-link routing in routing.ts is 100% client-centric (paths
      // start with /(client)/...). Routing an EPICIER or LIVREUR there would
      // bounce them through the client layout's auth guard and effectively
      // log them out. Skip the navigation for non-client roles — they'll
      // land on their default tab which is what they want.
      const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
      if (role !== 'CLIENT') {
        console.log(`[PushNotificationService] Role=${role}, skip client-only routing`);
        return;
      }

      const parsedData = parseNotificationData(data);
      const type = parsedData.type || parsedData.notificationType;
      const route = resolveRoute(type, parsedData);

      console.log(`[PushNotificationService] Route résolue: ${type} → ${route}`);

      setTimeout(() => {
        try {
          router.push(route);
        } catch (e) {
          console.error('[PushNotificationService] Erreur navigation:', e);
          // Fallback also stays inside the client space — only reachable here
          // because the role guard above passed.
          router.push('/(client)/notifications');
        }
      }, 500);
    } catch (error) {
      console.error('[PushNotificationService] Erreur gestion notification:', error);
      // Don't auto-redirect on errors — could land us in a layout the user
      // doesn't have access to. Just log and let the app continue.
    }
  },

  checkAuthentication: async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      return !!token;
    } catch (error) {
      console.error('[PushNotificationService] Erreur vérification auth:', error);
      return false;
    }
  },

  retryPendingToken: async (): Promise<void> => {
    try {
      const pendingToken = await AsyncStorage.getItem('pending_push_token');
      if (pendingToken) {
        console.log('[PushNotificationService] Tentative d\'envoi du token en attente');
        const success = await pushNotificationService.sendTokenToServer(pendingToken);
        if (success) {
          await AsyncStorage.removeItem('pending_push_token');
        }
      }
    } catch (error) {
      console.error('[PushNotificationService] Erreur retry token:', error);
    }
  },

  /**
   * @deprecated iOS categories — kept for backward compatibility.
   * Was configuring VIEW_ORDER/CANCEL_ORDER actions but action handling was
   * never implemented. Now a no-op. Implement action handling in
   * `setupNotificationHandlers` if iOS interactive actions are needed.
   */
  setupNotificationCategories: async (): Promise<void> => {
    // intentionally empty — action identifiers were configured but never
    // wired to handlers, so the buttons did nothing in production
  },

  /**
   * Initialize Android notification channels and the foreground display
   * handler. Call once at app startup before requesting tokens.
   */
  setForegroundNotificationHandler: async (): Promise<void> => {
    try {
      await setupAndroidChannels();

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      console.log('[PushNotificationService] Handler + channels configurés');
    } catch (error) {
      console.error('[PushNotificationService] Erreur configuration handler:', error);
    }
  },
};
