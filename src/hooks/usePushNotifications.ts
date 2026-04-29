import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { pushNotificationService } from '../services/pushNotificationService';

console.log('[usePushNotifications.ts] Module chargé au démarrage');

/**
 * Hook personnalisé pour gérer les push notifications
 * À utiliser dans le composant racine de l'application
 */
export const usePushNotifications = () => {
  console.log('[usePushNotifications] Hook appelé (fonction exécutée)');
  const router = useRouter();

  useEffect(() => {
    console.log('[usePushNotifications] 🔔 useEffect déclenché');

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupPushNotifications = async () => {
      if (!isMounted) return;

      try {
        await pushNotificationService.setForegroundNotificationHandler();

        const token = await pushNotificationService.registerForPushNotifications();

        if (token) {
          await pushNotificationService.sendTokenToServer(token);
          await pushNotificationService.retryPendingToken();
        }

        if (isMounted && router) {
          unsubscribe = pushNotificationService.setupNotificationHandlers(router);
          await pushNotificationService.handleColdStartResponse(router);
        }
      } catch (error) {
        console.error('[usePushNotifications] Erreur init:', error);
      }
    };

    setupPushNotifications();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, [router]);
};
