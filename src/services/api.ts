import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import { cacheService, CacheNamespace } from './offline/cacheService';

// ---------------------------------------------------------------------------
// Helpers pour le cache automatique des réponses GET
// ---------------------------------------------------------------------------

/** Détermine le namespace de cache à partir de l'URL */
function resolveNamespace(url: string): CacheNamespace | null {
  if (url.includes('/pos-sessions') || url.includes('/cash-sessions')) return 'pos';
  if (url.includes('/products') || url.includes('/produits')) return 'products';
  if (url.includes('/orders')) return 'orders';
  if (url.includes('/clients')) return 'clients';
  if (url.includes('/invoices')) return 'invoices';
  if (url.includes('/epiceries')) return 'epicerie';
  if (url.includes('/categories')) return 'categories';
  if (url.includes('/tags')) return 'tags';
  if (url.includes('/livreurs')) return 'livreurs';
  if (url.includes('/collaborat')) return 'collaborateurs';
  if (url.includes('/stats')) return 'stats';
  if (url.includes('/notifications')) return 'notifications';
  if (url.includes('/geo/') || url.includes('/currencies')) return 'geo';
  return null;
}

/** Génère une clé de cache stable à partir de la config de requête.
 *  La langue est préfixée pour isoler les caches i18n (catégories, produits, tags…) :
 *  un changement de langue n'écrase pas le cache de l'autre langue. */
function buildCacheKey(url: string, params?: Record<string, unknown>, lang?: string): string {
  const paramStr = params ? JSON.stringify(params) : '';
  const langPrefix = lang ? `${lang}:` : '';
  return `${langPrefix}${url}${paramStr ? ':' + paramStr : ''}`;
}

/** URLs d'auth où on ne tente pas de refresh ni de clear storage sur 401. */
function isAuthUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login')
      || url.includes('/auth/register')
      || url.includes('/auth/refresh')
      || url.includes('/auth/logout')
      || url.includes('/auth/forgot-password')
      || url.includes('/auth/verify-')
      || url.includes('/auth/reset-password')
      || url.includes('/auth/initiate-registration-verification')
      || url.includes('/auth/resend-verification-codes');
}

console.log('========================================');
console.log('[API] ✅ Configuration initialisée');
console.log('========================================');
console.log('[API] URL de base:', API_CONFIG.BASE_URL);
console.log('[API] Timeout:', API_CONFIG.TIMEOUT + 'ms');
console.log('========================================');

const api: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  paramsSerializer: { indexes: null },
});

/**
 * Instance dédiée pour le refresh — n'a PAS les intercepteurs, sinon un 401 du
 * refresh déclencherait un refresh récursif.
 */
const refreshClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Refresh flow — un seul refresh à la fois, les requêtes concurrentes attendent.
// ---------------------------------------------------------------------------

type Waiter = (newAccessToken: string | null) => void;

let isRefreshing = false;
let waiters: Waiter[] = [];

function queueWaiter(w: Waiter) { waiters.push(w); }
function flushWaiters(newToken: string | null) {
  const q = waiters;
  waiters = [];
  q.forEach(cb => cb(newToken));
}

/** Callback injectée par authService pour éviter l'import circulaire. */
let onAuthCleared: (() => Promise<void> | void) | null = null;
export function registerAuthClearedHandler(handler: () => Promise<void> | void) {
  onAuthCleared = handler;
}

async function clearAuthStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.ROLE,
  ]);
  if (onAuthCleared) {
    try { await onAuthCleared(); } catch { /* noop */ }
  }
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;

  const deviceType = `${Platform.OS} ${Device.osVersion || ''}`.trim();
  const platform = Device.modelName || Platform.OS;

  try {
    const { data } = await refreshClient.post('/auth/refresh', {
      refreshToken,
      deviceType,
      platform,
    });

    const newAccess: string | undefined = data?.accessToken;
    const newRefresh: string | undefined = data?.refreshToken;

    if (!newAccess || !newRefresh) return null;

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.TOKEN, newAccess],
      [STORAGE_KEYS.REFRESH_TOKEN, newRefresh],
    ]);

    console.log('[API] 🔄 Refresh token rotated');
    return newAccess;
  } catch (err: any) {
    console.warn('[API] 🔴 Refresh échoué:', err?.response?.status, err?.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Intercepteurs
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  async (config) => {
    const [token, lang, role] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.getItem('app_language'),
      AsyncStorage.getItem(STORAGE_KEYS.ROLE),
    ]);

    const isFormData = config.data instanceof FormData;
    // L'épicier gère toujours en français
    const resolvedLang = role === 'EPICIER' ? 'fr' : (lang ?? 'fr');

    console.log('[API] Requête vers:', config.url, {
      method: config.method,
      hasToken: !!token,
      isFormData,
      lang: resolvedLang,
    });

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.headers && !config.headers['Accept-Language']) {
      config.headers['Accept-Language'] = resolvedLang;
    }

    if (isFormData) {
      delete (config.headers as any)['Content-Type'];
      console.log('[API] FormData détecté - Content-Type supprimé pour axios');
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('[API] Erreur requête:', error.message);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  async (response) => {
    console.log('[API] Réponse reçue:', {
      url: response.config.url,
      status: response.status,
      dataKeys: Object.keys(response.data || {})
    });

    // Cache automatique des réponses GET réussies
    if (response.config.method?.toUpperCase() === 'GET' && response.config.url) {
      const namespace = resolveNamespace(response.config.url);
      if (namespace) {
        const lang = (response.config.headers?.['Accept-Language'] as string | undefined) ?? undefined;
        const key = buildCacheKey(response.config.url, response.config.params, lang);
        cacheService.set(namespace, key, response.data).catch(() => {});
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalConfig = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    console.error('[API] ❌ ERREUR:', originalConfig?.url, error.code, error.response?.status);

    // ── Fallback cache pour GET hors-ligne ─────────────────────────────
    if (
      (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') &&
      originalConfig?.method?.toUpperCase() === 'GET' &&
      originalConfig?.url
    ) {
      const namespace = resolveNamespace(originalConfig.url);
      if (namespace) {
        const lang = (originalConfig.headers?.['Accept-Language'] as string | undefined) ?? undefined;
        const key = buildCacheKey(originalConfig.url, originalConfig.params, lang);
        const cached = await cacheService.get(namespace, key, { ignoreExpiry: true });
        if (cached !== null) {
          console.log(`[API] 📦 Fallback cache pour ${originalConfig.url}`);
          return { data: cached, status: 200, config: originalConfig, headers: {}, statusText: 'OK (cache)' } as any;
        }
      }
      console.error('[API] 🔴 Hors-ligne, pas de cache disponible pour:', originalConfig?.url);
    }

    // ── 401 : tentative de refresh ──────────────────────────────────────
    // - Jamais sur les endpoints /auth/* (login/refresh eux-mêmes)
    // - Jamais en retry infini (_retry flag)
    if (
      error.response?.status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !isAuthUrl(originalConfig.url)
    ) {
      originalConfig._retry = true;

      // Plusieurs requêtes concurrentes qui tombent en 401 : on ne refresh qu'une fois
      if (isRefreshing) {
        const newToken = await new Promise<string | null>(resolve => queueWaiter(resolve));
        if (!newToken) return Promise.reject(error);
        if (originalConfig.headers) {
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalConfig);
      }

      isRefreshing = true;
      const newToken = await performRefresh();
      isRefreshing = false;
      flushWaiters(newToken);

      if (newToken) {
        if (originalConfig.headers) {
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalConfig);
      }

      // Refresh impossible → déconnexion propre
      await clearAuthStorage();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
