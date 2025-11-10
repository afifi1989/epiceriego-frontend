import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { STORAGE_KEYS } from '../constants/config';
import api from './api';

/**
 * Service pour gérer les push notifications
 * Inscription au service de notifications
 * Gestion des deep links quand on clique sur une notification
 */
export const pushNotificationService = {
  /**
   * Récupère le token push pour la connexion
   * Fonction simplifiée appelée au moment du login
   * Gère les emulateurs/simulateurs gracieusement
   */
  getTokenForLogin: async (): Promise<string | null> => {
    try {
      console.log('[PushNotificationService] 📱 Récupération du token pour la connexion...');

      // Vérifier si on est sur un dispositif physique
      if (!Device.isDevice) {
        console.log('[PushNotificationService] ⚠️ Emulateur/Simulator détecté - Token généré pour test');
        const testToken = `ExponentPushToken[TEST_${Date.now()}]`;
        return testToken;
      }

      console.log('[PushNotificationService] ✅ Dispositif physique détecté');

      // Vérifier les permissions
      const permResult = await Notifications.getPermissionsAsync();
      if (permResult.status !== 'granted') {
        console.log('[PushNotificationService] 🔔 Demande de permission pour les notifications...');
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[PushNotificationService] ⚠️ Permissions refusées - Pas de token');
          return null;
        }
      }

      // Récupérer le ProjectId
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.error('[PushNotificationService] ❌ ProjectId manquant');
        return null;
      }

      // Récupérer le token Expo
      const token = await Notifications.getExpoPushTokenAsync({
        projectId
      });

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

  /**
   * Enregistre le dispositif pour les notifications push
   * Récupère le token d'exposition
   */
  registerForPushNotifications: async (): Promise<string | null> => {
    try {
      console.log('[PushNotificationService] ========== ENREGISTREMENT PUSH ==========');
      console.log('[PushNotificationService] Enregistrement aux notifications push...');

      // Vérifier si on est sur un dispositif
      console.log('[PushNotificationService] Device.isDevice:', Device.isDevice);
      console.log('[PushNotificationService] Device.osBuildId:', Device.osBuildId);
      console.log('[PushNotificationService] Device.osVersion:', Device.osVersion);
      console.log('[PushNotificationService] Device.modelName:', Device.modelName);

      if (!Device.isDevice) {
        console.warn('[PushNotificationService] ⚠️ Non sur un dispositif physique - Skip pour emulateur/simulator');
        // Sur emulateur, on peut générer un token simulé pour tester
        console.log('[PushNotificationService] Génération d\'un token de test...');
        const testToken = `ExponentPushToken[TEST_${Date.now()}]`;
        return testToken;
      }

      // Vérifier les permissions
      console.log('[PushNotificationService] ✅ Dispositif physique détecté - Vérification des permissions...');
      let existingStatus;
      try {
        const permResult = await Notifications.getPermissionsAsync();
        existingStatus = permResult.status;
        console.log('[PushNotificationService] Statut permission actuel:', existingStatus);
      } catch (permError: any) {
        console.error('[PushNotificationService] ❌ Erreur lors de getPermissionsAsync:', permError.message);
        return null;
      }

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('[PushNotificationService] Demande de permission...');
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          console.log('[PushNotificationService] Résultat permission:', status);
          finalStatus = status;
        } catch (reqError: any) {
          console.error('[PushNotificationService] ❌ Erreur lors de requestPermissionsAsync:', reqError.message);
          return null;
        }
      }

      if (finalStatus !== 'granted') {
        console.error('[PushNotificationService] ❌ PERMISSIONS REFUSÉES - Token non obtenu');
        console.error('[PushNotificationService] Status final:', finalStatus);
        return null;
      }

      console.log('[PushNotificationService] ✅ Permissions accordées');

      // Récupérer le token d'exposition
      console.log('[PushNotificationService] Récupération du token Expo...');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('[PushNotificationService] ProjectId:', projectId);

      if (!projectId) {
        console.error('[PushNotificationService] ❌ ERREUR: ProjectId EST VIDE!');
        console.error('[PushNotificationService] Constants.expoConfig:', JSON.stringify(Constants.expoConfig, null, 2));
        return null;
      }

      let token;
      try {
        token = await Notifications.getExpoPushTokenAsync({
          projectId
        });
        console.log('[PushNotificationService] ✅ Token reçu:', token.data);
      } catch (tokenError: any) {
        console.error('[PushNotificationService] ❌ Erreur lors de getExpoPushTokenAsync:', tokenError.message);
        console.error('[PushNotificationService] Stack:', tokenError.stack);
        return null;
      }

      console.log('[PushNotificationService] ========== ENREGISTREMENT RÉUSSI ==========');

      return token.data;
    } catch (error: any) {
      console.error('[PushNotificationService] ❌ ERREUR GÉNÉRALE enregistrement:', error.message);
      console.error('[PushNotificationService] Full error:', error);
      console.error('[PushNotificationService] Stack:', error.stack);
      return null;
    }
  },

  /**
   * Envoie le token au serveur
   * NOTE: Le token devrait être envoyé lors de la connexion via /auth/login
   * Cette fonction est un fallback pour mettre à jour le token après la connexion
   */
  sendTokenToServer: async (token: string): Promise<boolean> => {
    try {
      console.log('[PushNotificationService] ========== ENVOI TOKEN AU SERVEUR ==========');
      console.log('[PushNotificationService] Token push:', token.substring(0, 40) + '...');

      // Vérifier le JWT token avant d'envoyer
      const jwtToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      console.log('[PushNotificationService] JWT Token présent?:', !!jwtToken);
      if (!jwtToken) {
        console.error('[PushNotificationService] ⚠️ AUCUN JWT TOKEN EN AsyncStorage');
        console.error('[PushNotificationService] 💡 Note: Le token push est normalement envoyé lors de /auth/login');
        return false;
      }

      console.log('[PushNotificationService] JWT Token: OK');

      const payload = {
        expoPushToken: token,
        deviceType: Device.osVersion || 'Unknown',
        platform: Device.modelName || 'Unknown'
      };

      console.log('[PushNotificationService] Payload:', JSON.stringify(payload, null, 2));

      // Appeler l'endpoint backend qui existe
      const endpoint = '/notifications/register-device';

      try {
        console.log(`[PushNotificationService] 📡 Appel de l'endpoint: ${endpoint}`);
        const response = await api.post(endpoint, payload);
        console.log('[PushNotificationService] ✅ Succès! Status:', response.status);
        console.log('[PushNotificationService] Réponse:', response.data);
        console.log('[PushNotificationService] ========== ENVOI RÉUSSI ==========');
        return true;
      } catch (error: any) {
        console.error('[PushNotificationService] ❌ Erreur lors de l\'envoi');
        console.error('[PushNotificationService] Status HTTP:', error.response?.status);
        console.error('[PushNotificationService] Message:', error.response?.data?.message || error.message);
        console.error('[PushNotificationService] Données complètes:', error.response?.data);
        return false;
      }
    } catch (error: any) {
      console.error('[PushNotificationService] ❌ Erreur:', error.message);
      return false;
    }
  },

  /**
   * Configure les handlers pour les notifications
   * Quand on reçoit une notification
   * Quand on clique sur une notification
   */
  setupNotificationHandlers: (router: any) => {
    console.log('[PushNotificationService] Configuration des handlers...');

    // Quand on reçoit une notification en avant-plan (app ouverte)
    const notificationReceivedSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[PushNotificationService] Notification cliquée:', response.notification.request.content);

        // Extraire les données de la notification
        const data = response.notification.request.content.data;

        // Rediriger selon le type
        pushNotificationService.handleNotificationPress(data, router);
      }
    );

    // Quand on reçoit une notification en arrière-plan
    // Cette notification est gérée automatiquement par Expo
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[PushNotificationService] Notification reçue en arrière-plan:', notification.request.content);
      }
    );

    return () => {
      notificationReceivedSubscription.remove();
      notificationSubscription.remove();
    };
  },

  /**
   * Gère le clic sur une notification (deep link)
   * Vérifie si l'utilisateur est connecté
   * Redirige vers la page appropriée
   */
  handleNotificationPress: async (data: any, router: any): Promise<void> => {
    try {
      console.log('[PushNotificationService] Gestion du clic notification:', data);

      // Vérifier si l'utilisateur est connecté
      const isAuthenticated = await pushNotificationService.checkAuthentication();

      if (!isAuthenticated) {
        console.log('[PushNotificationService] Utilisateur non connecté, redirection vers login');
        // Attendre un peu avant de rediriger pour laisser l'app se charger
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 500);
        return;
      }

      // Rediriger selon le type de notification
      const notificationType = data.type || data.notificationType;

      // Attendre un peu pour laisser l'app se charger
      setTimeout(() => {
        switch (notificationType) {
          case 'NOTIFICATION':
          case 'ORDER':
          case 'PROMOTION':
          case 'DELIVERY':
          case 'ALERT':
          case 'INFO':
            console.log('[PushNotificationService] Redirection vers notifications');
            router.push('/(client)/notifications');
            break;

          case 'ORDER_DETAIL':
            const orderId = data.orderId;
            if (orderId) {
              console.log('[PushNotificationService] Redirection vers commande:', orderId);
              router.push(`/(client)/(commandes)/${orderId}`);
            } else {
              router.push('/(client)/(commandes)');
            }
            break;

          case 'EPICERIE':
            const epicerieId = data.epicerieId;
            if (epicerieId) {
              console.log('[PushNotificationService] Redirection vers épicerie:', epicerieId);
              router.push(`/(client)/(epicerie)/${epicerieId}`);
            } else {
              router.push('/(client)/epiceries');
            }
            break;

          case 'PROMO':
            const promoEpicerieId = data.epicerieId;
            if (promoEpicerieId) {
              console.log('[PushNotificationService] Redirection vers épicerie promo:', promoEpicerieId);
              router.push(`/(client)/(epicerie)/${promoEpicerieId}`);
            } else {
              router.push('/(client)/epiceries');
            }
            break;

          default:
            console.log('[PushNotificationService] Type inconnu, redirection vers notifications');
            router.push('/(client)/notifications');
        }
      }, 500);
    } catch (error) {
      console.error('[PushNotificationService] Erreur gestion notification:', error);
      // En cas d'erreur, rediriger vers les notifications
      router.push('/(client)/notifications');
    }
  },

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  checkAuthentication: async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      console.log('[PushNotificationService] Vérification auth, token:', token ? 'présent' : 'absent');
      return !!token;
    } catch (error) {
      console.error('[PushNotificationService] Erreur vérification auth:', error);
      return false;
    }
  },

  /**
   * Reessayer d'envoyer le token en attente
   */
  retryPendingToken: async (): Promise<void> => {
    try {
      const pendingToken = await AsyncStorage.getItem('pending_push_token');

      if (pendingToken) {
        console.log('[PushNotificationService] Tentative d\'envoi du token en attente');
        const success = await pushNotificationService.sendTokenToServer(pendingToken);

        if (success) {
          await AsyncStorage.removeItem('pending_push_token');
          console.log('[PushNotificationService] Token en attente envoyé');
        }
      }
    } catch (error) {
      console.error('[PushNotificationService] Erreur retry token:', error);
    }
  },

  /**
   * Configure les catégories de notifications (actions)
   */
  setupNotificationCategories: async () => {
    try {
      console.log('[PushNotificationService] Configuration des catégories...');

      // Définir les catégories de notifications avec des actions
      await Notifications.setNotificationCategoryAsync('ORDER_NOTIFICATION', [
        {
          identifier: 'VIEW_ORDER',
          buttonTitle: 'Voir la commande',
          options: {
            opensAppToForeground: true
          }
        },
        {
          identifier: 'CANCEL_ORDER',
          buttonTitle: 'Annuler',
          options: {
            opensAppToForeground: false
          }
        }
      ]);

      console.log('[PushNotificationService] Catégories configurées');
    } catch (error) {
      console.error('[PushNotificationService] Erreur configuration catégories:', error);
    }
  },

  /**
   * Définis le comportement des notifications en avant-plan
   */
  setForegroundNotificationHandler: async () => {
    try {
      console.log('[PushNotificationService] Configuration du handler avant-plan');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      console.log('[PushNotificationService] Handler configuré');
    } catch (error) {
      console.error('[PushNotificationService] Erreur configuration handler:', error);
    }
  }
};
