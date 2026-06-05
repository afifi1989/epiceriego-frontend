import api, { registerAuthClearedHandler } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/config';
import {
  RegisterRequest,
  LoginResponse,
  RegistrationVerificationResponse,
  TokenRefreshResponse,
  DeviceVerificationRequiredResponse,
  LoginOutcome,
  PhoneOtpRequestResponse,
  UserDeviceItem,
} from '../type';
import { cartService } from './cartService';
import { getDeviceContext } from './deviceService';
import { setCachedUser } from '../hooks/useCurrentUser';
import { pushNotificationService } from './pushNotificationService';

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

  // Notifie PermissionGate & co.
  setCachedUser(data);

  // Empeche la redirection automatique vers /notifications apres login.
  // Le layout client va remonter et appeler handleColdStartResponse qui,
  // sans ce marqueur, redirigerait l'utilisateur vers la cible de la
  // derniere notif — moche apres un login manuel.
  // Awaité (pas fire-and-forget) pour garantir que le flag de suppression est
  // bien écrit AVANT que le layout client n'appelle handleColdStartResponse.
  await pushNotificationService.markColdStartHandled().catch(() => {});
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
  setCachedUser(null);
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
   * Stocke access token + refresh token + rôle en AsyncStorage si auth complète.
   *
   * Retourne un discriminated union :
   *  - { kind: 'authenticated', data: LoginResponse } → tokens reçus, session persistée
   *  - { kind: 'deviceVerificationRequired', data } → 202, le mobile doit naviguer vers
   *    l'écran verify-device avec le verificationToken
   *
   * @param expectedRole Si fourni, le backend refuse avec un message neutre
   *                     si le rôle réel ne correspond pas.
   */
  login: async (
    login: string,
    password: string,
    fcmToken: string | null = null,
    expectedRole?: string | null
  ): Promise<LoginOutcome> => {
    try {
      console.log('[authService.login] Tentative de connexion:', {
        login,
        hasPassword: !!password,
        expectedRole: expectedRole || null,
      });

      const { deviceType, platform } = deriveDeviceInfo();
      const ctx = await getDeviceContext();
      const response = await api.post('/auth/login', {
        login,
        password,
        fcmToken,
        deviceType,
        platform,
        // Champs device-bound auth (CLIENT seulement côté backend)
        deviceId: ctx.deviceId,
        deviceLabel: ctx.deviceLabel,
        osVersion: ctx.osVersion,
        appVersion: ctx.appVersion,
        ...(expectedRole ? { expectedRole } : {}),
      });

      console.log('[authService.login] Réponse:', {
        status: response.status,
        hasToken: !!response.data.token,
        hasRefreshToken: !!response.data.refreshToken,
        requiresDeviceVerification: !!response.data.requiresDeviceVerification,
      });

      // 202 Accepted : device pas trusted, validation OTP requise
      if (response.status === 202 || response.data?.requiresDeviceVerification) {
        return {
          kind: 'deviceVerificationRequired',
          data: response.data as DeviceVerificationRequiredResponse,
        };
      }

      // 200 OK : tokens reçus
      const data = response.data as LoginResponse;
      if (data.token) {
        await persistSession(data);
      }
      return { kind: 'authenticated', data };

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
   * Connexion via Google Sign-In. L'idToken doit avoir été obtenu via la lib
   * @react-native-google-signin/google-signin (cf. googleAuthService.ts).
   * Le backend find-or-create un user CLIENT — pas besoin de register séparé.
   */
  loginWithGoogle: async (idToken: string, fcmToken: string | null = null): Promise<LoginOutcome> => {
    try {
      const { deviceType, platform } = deriveDeviceInfo();
      const ctx = await getDeviceContext();
      const response = await api.post('/auth/login-google', {
        idToken,
        deviceId: ctx.deviceId,
        deviceLabel: ctx.deviceLabel,
        platform: ctx.platform,
        osVersion: ctx.osVersion,
        appVersion: ctx.appVersion,
        fcmToken,
        deviceType,
      });

      if (response.status === 202 || response.data?.requiresDeviceVerification) {
        return {
          kind: 'deviceVerificationRequired',
          data: response.data as DeviceVerificationRequiredResponse,
        };
      }

      const data = response.data as LoginResponse;
      if (data.token) {
        await persistSession(data);
      }
      return { kind: 'authenticated', data };

    } catch (error: any) {
      console.error('[authService.loginWithGoogle] Erreur:', {
        status: error.response?.status,
        data: error.response?.data,
      });
      if (error.response?.status === 503) {
        throw 'Google Sign-In indisponible côté serveur';
      }
      throw error.response?.data?.message || 'Erreur Google Sign-In';
    }
  },

  /**
   * Demande l'envoi d'un code SMS pour le login par téléphone.
   * Réponse neutre côté backend : on retourne toujours success=true même si
   * le compte n'existe pas (anti-énumération).
   */
  loginPhoneOtpRequest: async (telephone: string): Promise<PhoneOtpRequestResponse> => {
    try {
      const response = await api.post<PhoneOtpRequestResponse>('/auth/login-phone-otp/request', {
        telephone,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'envoi du code';
    }
  },

  /**
   * Valide le code SMS reçu pour le login par téléphone.
   * Le `token` est celui retourné par loginPhoneOtpRequest.
   */
  loginPhoneOtpVerify: async (
    publicToken: string,
    code: string,
    fcmToken: string | null = null
  ): Promise<LoginOutcome> => {
    try {
      const { deviceType, platform } = deriveDeviceInfo();
      const ctx = await getDeviceContext();
      const response = await api.post('/auth/login-phone-otp/verify', {
        token: publicToken,
        code,
        deviceId: ctx.deviceId,
        deviceLabel: ctx.deviceLabel,
        platform: ctx.platform,
        osVersion: ctx.osVersion,
        appVersion: ctx.appVersion,
        fcmToken,
        deviceType,
      });

      if (response.status === 202 || response.data?.requiresDeviceVerification) {
        return {
          kind: 'deviceVerificationRequired',
          data: response.data as DeviceVerificationRequiredResponse,
        };
      }

      const data = response.data as LoginResponse;
      if (data.token) {
        await persistSession(data);
      }
      return { kind: 'authenticated', data };

    } catch (error: any) {
      throw error.response?.data?.message || 'Code SMS invalide';
    }
  },

  /**
   * Demande au backend d'envoyer le code OTP email pour valider un nouveau device.
   * Cooldown 60s côté backend — peut renvoyer 429 si retry trop rapide.
   */
  sendDeviceEmailOtp: async (verificationToken: string): Promise<{ maskedEmail?: string; expiryMinutes?: number }> => {
    try {
      const response = await api.post(`/auth/devices/${verificationToken}/send-email-otp`, {});
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw error.response?.data?.message || 'Patientez avant de redemander un code';
      }
      throw error.response?.data?.message || 'Erreur envoi code email';
    }
  },

  /**
   * Valide le code OTP email pour le device. En succès, persiste la session
   * (LoginResponse complète) — l'utilisateur est connecté.
   */
  verifyDeviceOtp: async (
    verificationToken: string,
    code: string,
    fcmToken: string | null = null
  ): Promise<LoginResponse> => {
    try {
      const { deviceType, platform } = deriveDeviceInfo();
      const response = await api.post<LoginResponse>(
        `/auth/devices/${verificationToken}/verify`,
        { code, fcmToken, deviceType, platform }
      );
      if (response.data.token) {
        await persistSession(response.data);
      }
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Code email invalide';
    }
  },

  /** Liste les devices trusted (pour l'écran "Mes appareils" du profil). */
  listMyDevices: async (): Promise<UserDeviceItem[]> => {
    try {
      const response = await api.get<{ devices: UserDeviceItem[] }>('/auth/devices');
      return response.data.devices || [];
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur récupération appareils';
    }
  },

  /** Révoque un device (ne pourra plus servir de login sans nouvelle validation OTP). */
  revokeDevice: async (deviceId: number): Promise<void> => {
    try {
      await api.delete(`/auth/devices/${deviceId}`);
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur révocation';
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
      if (data?.permissions !== undefined) user.permissions = data.permissions;
      if (data?.collaboratorRole !== undefined) user.collaboratorRole = data.collaboratorRole;
      if (data?.role) user.role = data.role;
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      setCachedUser(user);
    }
  },
};
