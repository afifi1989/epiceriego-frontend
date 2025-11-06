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
    console.log('[usePushNotifications] 🔔 useEffect déclenché - HOOK CHARGÉ');
    console.log('[usePushNotifications] Router disponible:', !!router);

    let isMounted = true;

    const setupPushNotifications = async () => {
      if (!isMounted) {
        console.log('[usePushNotifications] ⚠️ Component unmounted, skipping setup');
        return;
      }

      try {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║ INITIALISATION DES PUSH NOTIFICATIONS                   ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('[usePushNotifications] 🚀 Démarrage complet du setup...');

        // 1. Configurer le handler en avant-plan
        console.log('[usePushNotifications] 1️⃣  Configuration handler avant-plan...');
        try {
          await pushNotificationService.setForegroundNotificationHandler();
          console.log('[usePushNotifications] ✅ Handler configuré');
        } catch (e: any) {
          console.error('[usePushNotifications] ❌ Erreur handler:', e.message);
        }

        // 2. Configurer les catégories
        console.log('[usePushNotifications] 2️⃣  Configuration des catégories...');
        try {
          await pushNotificationService.setupNotificationCategories();
          console.log('[usePushNotifications] ✅ Catégories configurées');
        } catch (e: any) {
          console.error('[usePushNotifications] ❌ Erreur catégories:', e.message);
        }

        // 3. S'enregistrer pour les notifications
        console.log('[usePushNotifications] 3️⃣  S\'enregistrer pour les notifications...');
        let token: string | null = null;
        try {
          token = await pushNotificationService.registerForPushNotifications();
          console.log('[usePushNotifications] Token result:', token);
        } catch (e: any) {
          console.error('[usePushNotifications] ❌ Erreur registration:', e.message);
          console.error('[usePushNotifications] Stack:', e.stack);
        }

        if (token) {
          console.log('[usePushNotifications] ✅ Token obtenu:', token);

          // 4. Envoyer le token au serveur
          console.log('[usePushNotifications] 4️⃣  Envoi du token au serveur...');
          console.log('[usePushNotifications] Token à envoyer:', token);
          let success = false;
          try {
            success = await pushNotificationService.sendTokenToServer(token);
            console.log('[usePushNotifications] Résultat envoi:', success);
          } catch (e: any) {
            console.error('[usePushNotifications] ❌ Erreur envoi:', e.message);
          }

          if (success) {
            console.log('[usePushNotifications] ✅ Token envoyé avec succès au serveur');
          } else {
            console.log('[usePushNotifications] ⚠️  Problème lors de l\'envoi au serveur (token en attente)');
          }

          // 5. Reessayer d'envoyer les tokens en attente
          console.log('[usePushNotifications] 5️⃣  Tentative d\'envoi des tokens en attente...');
          try {
            await pushNotificationService.retryPendingToken();
          } catch (e: any) {
            console.error('[usePushNotifications] ❌ Erreur retry:', e.message);
          }
        } else {
          console.warn('[usePushNotifications] ⚠️  Pas de token obtenu');
        }

        // 6. Configurer les handlers de réception et clic
        if (isMounted && router) {
          console.log('[usePushNotifications] 6️⃣  Configuration des handlers de réception...');
          try {
            const unsubscribe = pushNotificationService.setupNotificationHandlers(router);
            console.log('[usePushNotifications] ✅ Handlers configurés');
          } catch (e: any) {
            console.error('[usePushNotifications] ❌ Erreur handlers:', e.message);
          }
        }

        console.log('');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║ ✅ PUSH NOTIFICATIONS INITIALISÉES AVEC SUCCÈS        ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('');
      } catch (error) {
        console.error('');
        console.error('╔════════════════════════════════════════════════════════╗');
        console.error('║ ❌ ERREUR GÉNÉRALE LORS DE L\'INITIALISATION         ║');
        console.error('╚════════════════════════════════════════════════════════╝');
        console.error('[usePushNotifications] Erreur complète:', error);
        if (error instanceof Error) {
          console.error('[usePushNotifications] Message:', error.message);
          console.error('[usePushNotifications] Stack:', error.stack);
        }
        console.error('');
      }
    };

    // Exécuter directement sans attendre
    setupPushNotifications();

    return () => {
      isMounted = false;
    };
  }, [router]);
};
