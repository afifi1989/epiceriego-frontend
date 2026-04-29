import api, { registerAuthClearedHandler } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/config';
import { RegisterRequest, LoginResponse, RegistrationVerificationResponse, TokenRefreshResponse } from '../type';
import { cartService } from './cartService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveDeviceInfo() {
  return {
    deviceType: `${Platform.OS} ${Device.osVersion || ''}`.trim(),
    platform: Device.modelName || Platform.OS,
  };
}

async function persistSession(data: LoginResponse): Promise<void> {
  const entries: [string, string][] = [
    [STORAGE_KEYS.TOKEN, data.token],
    [STORAGE_KEYS.USER, JSON.stringify(data)],
    [STORAGE_KEYS.ROLE, data.role],
  ];
  if (data.refreshToken) {
    entries.push([STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken]);
  }
  await AsyncStorage.multiSet(entries);

  if (data.epicerieName) {
    await AsyncStorage.setItem('epicerieName', data.epicerieName);
  }

  // Sync langue préférée (priorité au choix manuel local)
  const localLang = await AsyncStorage.getItem('app_language');
  if (!localLang && data.preferredLanguage) {
    await AsyncStorage.setItem('app_language', data.preferredLanguage);
  }
}

async function wipeLocalSession(): Promise<void> {
  await cartService.clearCart().catch(() => {});
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.ROLE,
    'epicerieName',
  ]);
}

// L'intercepteur api.ts appelle ce handler quand il a clearé le storage
// après un refresh échoué — on en profite pour vider aussi le panier.
registerAuthClearedHandler(async () => {
  try { await cartService.clearCart(); } catch { /* noop */ }
});

// ── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /** Inscription d'un nouvel utilisateur (pas de token — vérification requise). */
  register: async (userData: RegisterRequest, fcmToken: string | null = null): Promise<RegistrationVerificationResponse> => {
    try {
      const payload = fcmToken ? { ...userData, fcmToken } : userData;
      const response = await api.post<RegistrationVerificationResponse>('/auth/register', payload);
      console.log('[authService.register] Inscription réussie, vérification requise');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'inscription';
    }
  },

  /**
   * Connexion. Accepte email (CLIENT/LIVREUR) ou identifiant ALXXXXX (EPICIER).
   * Stocke access token + refresh token + rôle en AsyncStorage.
   *
   * @param expectedRole Si fourni ("CLIENT" | "EPICIER" | "LIVREUR"), le backend
   *                     refuse la connexion avec le même message neutre qu'un
   *                     mauvais mot de passe si le rôle réel ne correspond pas.
   */
  login: async (
    login: string,
    password: string,
    fcmToken: string | null = null,
    expectedRole?: string | null
  ): Promise<LoginResponse> => {
    try {
      console.log('[authService.login] Tentative de connexion:', {
        login,
        hasPassword: !!password,
        expectedRole: expectedRole || null,
      });

      const { deviceType, platform } = deriveDeviceInfo();
      const response = await api.post<LoginResponse>('/auth/login', {
        login,
        password,
        fcmToken,
        deviceType,
        platform,
        ...(expectedRole ? { expectedRole } : {}),
      });

      console.log('[authService.login] Réponse:', {
        status: response.status,
        hasToken: !!response.data.token,
        hasRefreshToken: !!response.data.refreshToken,
        role: response.data.role,
      });

      if (response.data.token) {
        await persistSession(response.data);
      }

      return response.data;
    } catch (error: any) {
      console.error('[authService.login] Erreur:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      });

      // Compte non vérifié (email/tél)
      if (error.response?.status === 403 && error.response?.data?.verified === false) {
        throw {
          isUnverified: true,
          email: error.response.data.email,
          message: error.response.data.message,
        };
      }

      throw error.response?.data?.message || 'Identifiants invalides';
    }
  },

  /**
   * Déconnexion : best-effort côté backend (revoke refresh token) puis wipe local.
   * Ne jette jamais — si le backend est down, on efface quand même le storage local.
   */
  logout: async (): Promise<void> => {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(err => {
          console.warn('[authService.logout] Backend logout échoué (ignoré):', err?.message);
        });
      }
    } finally {
      await wipeLocalSession();
      console.log('[authService.logout] Session locale effacée');
    }
  },

  /** Logout global : révoque toutes les sessions du user (tous appareils). */
  logoutAll: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', { revokeAll: true }).catch(err => {
        console.warn('[authService.logoutAll] Backend logoutAll échoué (ignoré):', err?.message);
      });
    } finally {
      await wipeLocalSession();
    }
  },

  /** Vrai si un access token est présent (ne vérifie pas sa validité côté serveur). */
  isAuthenticated: async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      return !!token;
    } catch {
      return false;
    }
  },

  getCurrentUser: async (): Promise<LoginResponse | null> => {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  getUserRole: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
    } catch {
      return null;
    }
  },

  /**
   * Change le mot de passe. Le backend révoque toutes les sessions et émet
   * un nouveau couple access+refresh pour cet appareil — on reste connecté ici.
   */
  changePassword: async (newPassword: string): Promise<void> => {
    const { data } = await api.post<TokenRefreshResponse>('/auth/change-password', { newPassword });

    const updates: [string, string][] = [];
    if (data?.accessToken) updates.push([STORAGE_KEYS.TOKEN, data.accessToken]);
    if (data?.refreshToken) updates.push([STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken]);
    if (updates.length > 0) await AsyncStorage.multiSet(updates);

    const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      const user = JSON.parse(userStr);
      user.mustChangePassword = false;
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  },
};
