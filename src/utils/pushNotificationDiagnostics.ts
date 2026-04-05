/**
 * Service de Diagnostic - Push Notifications
 *
 * Outil de debugging SANS impact sur l'application
 * À utiliser pour identifier pourquoi l'enregistrement du token ne fonctionne pas
 * sur téléphone physique
 *
 * ✅ N'appelle rien
 * ✅ Ne modifie rien
 * ✅ Affiche seulement les diagnostics en console
 * ✅ Peut être appelé manuellement pour debug
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

export const pushNotificationDiagnostics = {
  /**
   * Affiche les infos du device
   */
  logDeviceInfo: () => {
    console.log('\n========== 📱 INFOS DEVICE ==========');
    console.log('Device.isDevice:', Device.isDevice);
    console.log('Device.osVersion:', Device.osVersion);
    console.log('Device.osBuildId:', Device.osBuildId);
    console.log('Device.modelName:', Device.modelName);
    console.log('Device.brand:', Device.brand);
    console.log('Device.manufacturer:', Device.manufacturer);
    console.log('======================================\n');
  },

  /**
   * Affiche la config Expo
   */
  logExpoConfig: () => {
    console.log('\n========== ⚙️ EXPO CONFIG ==========');
    console.log('expoConfig:', JSON.stringify(Constants.expoConfig, null, 2));
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('ProjectId:', projectId ? '✅ PRÉSENT' : '❌ MANQUANT');
    if (projectId) {
      console.log('ProjectId value:', projectId.substring(0, 20) + '...');
    }
    console.log('=====================================\n');
  },

  /**
   * Affiche le statut des permissions de notification
   */
  logNotificationPermissions: async () => {
    try {
      console.log('\n========== 🔔 PERMISSIONS NOTIFICATIONS ==========');
      const permissions = await Notifications.getPermissionsAsync();
      console.log('Permissions status:', permissions.status);
      console.log('canAskAgain:', permissions.canAskAgain);
      console.log('Statut détaillé:');
      console.log('  - denied:', (permissions as any).denied);
      console.log('  - granted:', permissions.granted);
      console.log('  - ios.expires:', (permissions.ios as any)?.expires);

      if (permissions.status === 'granted') {
        console.log('✅ Permissions ACCORDÉES');
      } else if (permissions.status === 'denied') {
        console.log('❌ Permissions REFUSÉES');
        if (permissions.canAskAgain) {
          console.log('💡 SOLUTION: Peut demander les permissions à nouveau');
        } else {
          console.log('⚠️ PROBLÈME: Permissions refusées définitivement');
          console.log('💡 SOLUTION: Aller dans Paramètres > Notifications > Autoriser');
        }
      }
      console.log('===================================================\n');
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des permissions:', error);
    }
  },

  /**
   * Affiche le statut de l'authentification JWT
   */
  logAuthenticationStatus: async () => {
    try {
      console.log('\n========== 🔐 AUTHENTIFICATION ==========');
      const jwtToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      console.log('JWT Token présent?:', jwtToken ? '✅ OUI' : '❌ NON');
      if (jwtToken) {
        console.log('JWT Token length:', jwtToken.length);
        console.log('JWT Token (first 50 chars):', jwtToken.substring(0, 50) + '...');
      } else {
        console.log('⚠️ PROBLÈME: Pas de JWT Token en AsyncStorage');
        console.log('💡 NOTE: Le token push ne peut pas être enregistré sans authentification');
      }
      console.log('=========================================\n');
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de l\'authentification:', error);
    }
  },

  /**
   * Affiche le diagnostic complet du problème d'enregistrement du token
   */
  fullDiagnostics: async () => {
    console.log('\n\n🔍 ========== DIAGNOSTIC COMPLET - PUSH NOTIFICATIONS ==========\n');

    pushNotificationDiagnostics.logDeviceInfo();
    pushNotificationDiagnostics.logExpoConfig();
    await pushNotificationDiagnostics.logNotificationPermissions();
    await pushNotificationDiagnostics.logAuthenticationStatus();

    console.log('========== RECOMMANDATIONS ==========\n');

    const isDevice = Device.isDevice;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const permissions = await Notifications.getPermissionsAsync();
    const jwtToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!isDevice) {
      console.log('❌ Vous êtes sur un ÉMULATEUR/SIMULATOR');
      console.log('💡 SOLUTION: Utilisez un téléphone physique pour les push notifications');
      console.log('   Les tokens de test sont générés mais ne fonctionneront pas réellement\n');
    } else {
      console.log('✅ Vous êtes sur un TÉLÉPHONE PHYSIQUE\n');
    }

    if (!projectId) {
      console.log('❌ ProjectId MANQUANT dans app.json');
      console.log('💡 SOLUTION: Ajouter à app.json:');
      console.log(`
  "extra": {
    "eas": {
      "projectId": "votre-projet-id"
    }
  }
      `);
    } else {
      console.log('✅ ProjectId PRÉSENT\n');
    }

    if (permissions.status !== 'granted') {
      console.log(`❌ Permissions REFUSÉES (statut: ${permissions.status})`);
      console.log('💡 SOLUTION: ');
      if (permissions.canAskAgain) {
        console.log('   1. Relancer l\'app');
        console.log('   2. Accorder les permissions quand demandé\n');
      } else {
        console.log('   1. Aller dans Paramètres du téléphone');
        console.log('   2. Notifications > AbridGO');
        console.log('   3. Activer les notifications\n');
      }
    } else {
      console.log('✅ Permissions ACCORDÉES\n');
    }

    if (!jwtToken) {
      console.log('❌ Pas de JWT Token');
      console.log('💡 SOLUTION: Se connecter à l\'app d\'abord\n');
    } else {
      console.log('✅ JWT Token PRÉSENT\n');
    }

    console.log('========== FIN DIAGNOSTIC ==========\n');
  },

  /**
   * Affiche les logs du problème courant identifié
   */
  identifyProblem: async () => {
    const isDevice = Device.isDevice;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const permissions = await Notifications.getPermissionsAsync();
    const jwtToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

    console.log('\n🔍 ========== IDENTIFICATION DU PROBLÈME ==========\n');

    let problemFound = false;

    if (!isDevice) {
      console.log('🔴 PROBLÈME 1: Vous êtes sur émulateur/simulator');
      console.log('   Push notifications ne fonctionnent que sur téléphone physique');
      problemFound = true;
    }

    if (!projectId) {
      console.log('🔴 PROBLÈME 2: ProjectId manquant dans app.json');
      console.log('   Impossible d\'obtenir un token Expo sans ProjectId');
      problemFound = true;
    }

    if (permissions.status !== 'granted') {
      console.log(`🔴 PROBLÈME 3: Permissions refusées (${permissions.status})`);
      console.log('   L\'app ne peut pas accéder aux notifications');
      problemFound = true;
    }

    if (!jwtToken) {
      console.log('🟡 PROBLÈME 4: Pas de JWT Token');
      console.log('   L\'utilisateur n\'est pas connecté');
      console.log('   NOTE: C\'est normal si pas connecté');
      problemFound = true;
    }

    if (!problemFound) {
      console.log('✅ Aucun problème détecté!');
      console.log('🤔 Le problème est peut-être côté backend');
      console.log('   Vérifier que:');
      console.log('   1. Le backend reçoit le fcmToken lors de /auth/login');
      console.log('   2. La base de données enregistre le token');
      console.log('   3. Aucune erreur 500 côté backend');
    }

    console.log('\n================================================\n');
  },
};

/**
 * Fonction helper pour appeler le diagnostic
 * À ajouter dans un écran de debug ou appeler manuellement
 *
 * Exemple dans un composant:
 *
 *   const debugPushNotifications = async () => {
 *     await pushNotificationDiagnostics.fullDiagnostics();
 *     await pushNotificationDiagnostics.identifyProblem();
 *   };
 *
 * Ou dans la console React Native:
 *
 *   import { pushNotificationDiagnostics } from './src/utils/pushNotificationDiagnostics';
 *   pushNotificationDiagnostics.fullDiagnostics();
 */
