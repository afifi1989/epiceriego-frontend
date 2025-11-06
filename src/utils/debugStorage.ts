/**
 * Utilitaires de débogage pour AsyncStorage
 * Utile pour tester et nettoyer les données en développement
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

export const debugStorage = {
  /**
   * Affiche l'état complet d'AsyncStorage
   */
  printAll: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('[DebugStorage] Toutes les clés:', allKeys);

      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`[DebugStorage] ${key}:`, value);
      }
    } catch (error) {
      console.error('[DebugStorage] Erreur lors de la lecture:', error);
    }
  },

  /**
   * Nettoie TOUTES les données d'authentification
   */
  clearAllAuth: async () => {
    try {
      console.log('[DebugStorage] 🗑️  Suppression de toutes les données d\'auth...');
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.ROLE,
        STORAGE_KEYS.SAVED_CARDS,
      ]);
      console.log('[DebugStorage] ✅ Données d\'auth supprimées');
    } catch (error) {
      console.error('[DebugStorage] ❌ Erreur lors de la suppression:', error);
    }
  },

  /**
   * Nettoie TOUT ce qui est dans AsyncStorage
   */
  clearEverything: async () => {
    try {
      console.log('[DebugStorage] 🗑️  Suppression COMPLÈTE d\'AsyncStorage...');
      await AsyncStorage.clear();
      console.log('[DebugStorage] ✅ AsyncStorage complètement vidé');
    } catch (error) {
      console.error('[DebugStorage] ❌ Erreur lors de la suppression complète:', error);
    }
  },

  /**
   * Affiche les clés d'authentification spécifiques
   */
  printAuthKeys: async () => {
    try {
      console.log('[DebugStorage] ===== CLÉS D\'AUTH =====');
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const user = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);

      console.log('[DebugStorage] TOKEN:', token ? '✅ Présent' : '❌ Absent');
      console.log('[DebugStorage] USER:', user ? '✅ Présent' : '❌ Absent');
      console.log('[DebugStorage] ROLE:', role || '❌ Absent');
    } catch (error) {
      console.error('[DebugStorage] Erreur:', error);
    }
  },

  /**
   * Simule une connexion de test avec des données fictives
   */
  setTestUser: async (role: 'CLIENT' | 'EPICIER' | 'LIVREUR') => {
    try {
      const testToken = `test-token-${Date.now()}`;
      const testUser = {
        id: 'test-user-1',
        email: `test-${role.toLowerCase()}@example.com`,
        name: `Test ${role}`,
        role: role,
      };

      console.log('[DebugStorage] 📝 Ajout d\'utilisateur de test...');
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, testToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(testUser));
      await AsyncStorage.setItem(STORAGE_KEYS.ROLE, role);

      console.log('[DebugStorage] ✅ Utilisateur de test ajouté:', role);
    } catch (error) {
      console.error('[DebugStorage] ❌ Erreur:', error);
    }
  },
};

// Expose globalement pour accès depuis la console dev
if (typeof globalThis !== 'undefined') {
  (globalThis as any).debugStorage = debugStorage;
}
