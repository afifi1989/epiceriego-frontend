import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import { cacheService, CacheNamespace } from './offline/cacheService';
import { authFeedbackBus } from './auth/authFeedbackBus';

// ---------------------------------------------------------------------------
// Helpers pour le cache automatique des réponses GET
// ---------------------------------------------------------------------------

/** Détermine le namespace de cache à partir de l'URL */
function resolveNamespace(url: string): CacheNamespace | null {
  // Position temps réel du livreur : volatile par nature — ni mise en cache,
  // ni fallback hors-ligne (une position périmée passerait pour fraîche).
  if (url.includes('/tracking') || url.includes('/livreurs/location')) return null;
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

// ── Feedback erreurs reseau / backend down ──────────────────────────────
// Throttle a 1 Alert toutes les 5 secondes pour eviter le spam quand plusieurs
// requetes echouent en cascade (typique d'un ecran avec 3-4 fetchs au mount).
let lastBackendErrorAt = 0;
const BACKEND_ERROR_THROTTLE_MS = 5000;

/** Libelle humain des codes plan (mirror FeaturePlanMappingService.humanPlanName). */
function planHumanName(planCode: string): string {
  switch (planCode) {
    case 'DECOUVERTE': return 'Découverte';
    case 'ESSENTIEL':  return 'Essentiel';
    case 'PRO':        return 'Pro';
    case 'PREMIUM':    return 'Premium';
    default:           return planCode;
  }
}

function showBackendErrorOnce(kind: 'network' | 'timeout' | 'server'): void {
  const now = Date.now();
  if (now - lastBackendErrorAt < BACKEND_ERROR_THROTTLE_MS) return;
  lastBackendErrorAt = now;
  try {
    const { Alert } = require('react-native');
    let title: string;
    let message: string;
    if (kind === 'network') {
      title = 'Pas de connexion';
      message = "Verifiez votre connexion Internet (Wi-Fi ou donnees mobiles) puis reessayez.";
    } else if (kind === 'timeout') {
      title = 'Le serveur est lent';
      message = 'Le serveur met du temps a repondre. Reessayez dans quelques instants.';
    } else {
      title = 'Service indisponible';
      message = 'Le serveur rencontre un probleme. Reessayez dans quelques instants — nous travaillons a remettre tout en ordre.';
    }
    Alert.alert(title, message);
  } catch (e) {
    console.warn('[API] showBackendErrorOnce echec:', e);
  }
}

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

/**
 * Variante "soft" : ne purge que les tokens, conserve le USER + ROLE.
 * Utilisee quand on declenche le modal de reauth — l'email du user doit
 * rester accessible pour pre-remplir le formulaire. Le clear complet
 * est differe jusqu'a ce que l'utilisateur annule explicitement.
 */
async function clearTokensOnly(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
  ]);
}

/** Lit l'email du user persiste (peut etre null si storage corrompu). */
async function getStoredUserEmail(): Promise<string | undefined> {
  try {
    const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (!userStr) return undefined;
    const user = JSON.parse(userStr);
    return typeof user?.email === 'string' ? user.email : undefined;
  } catch {
    return undefined;
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

    // Le backend ré-émet permissions[] et collaboratorRole à chaque refresh :
    // on aligne le user persisté pour que usePermissions voie tout changement
    // de rôle côté serveur sans nécessiter un re-login complet.
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (userStr) {
        const user = JSON.parse(userStr);
        let changed = false;
        if (data?.permissions !== undefined) { user.permissions = data.permissions; changed = true; }
        if (data?.collaboratorRole !== undefined) { user.collaboratorRole = data.collaboratorRole; changed = true; }
        if (data?.role) { user.role = data.role; changed = true; }
        if (changed) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          // Notifie PermissionGate sans attendre un re-mount
          try {
            const { setCachedUser } = require('../hooks/useCurrentUser');
            setCachedUser(user);
          } catch { /* hook pas encore charge, ignore */ }
        }
      }
    } catch {
      // user storage corrompu ou JSON invalide : on n'écrase pas
    }

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
    // - TOKEN_INVALID : refresh impossible (token forge/altere) → logout direct
    //   sans solliciter le serveur de refresh inutilement.
    if (
      error.response?.status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !isAuthUrl(originalConfig.url)
    ) {
      originalConfig._retry = true;

      // Le backend renvoie maintenant un body { code, message } cf AuthErrorResponse.
      // TOKEN_INVALID = signature/format casse → pas la peine de tenter le refresh.
      // On declenche directement le modal de reauth (l'utilisateur va resaisir
      // son mot de passe ; le re-login donnera un token frais valide).
      const errorCode: string | undefined = (error.response.data as any)?.code;
      if (errorCode === 'TOKEN_INVALID' || errorCode === 'TOKEN_MISSING') {
        const email = await getStoredUserEmail();
        await clearTokensOnly();
        authFeedbackBus.emit('refresh:failed', { code: errorCode });
        authFeedbackBus.emit('reauth:required', { email, reason: errorCode });
        return Promise.reject(error);
      }

      // Plusieurs requêtes concurrentes qui tombent en 401 : on ne refresh qu'une fois
      if (isRefreshing) {
        const newToken = await new Promise<string | null>(resolve => queueWaiter(resolve));
        if (!newToken) return Promise.reject(error);
        if (originalConfig.headers) {
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalConfig);
      }

      // Premier 401 du cycle : on emit refresh:start (UI montre le toast).
      // Les requetes concurrentes qui suivront passeront par le queueWaiter
      // au-dessus et n'emettront pas a nouveau.
      isRefreshing = true;
      authFeedbackBus.emit('refresh:start');
      const newToken = await performRefresh();
      isRefreshing = false;
      flushWaiters(newToken);

      if (newToken) {
        authFeedbackBus.emit('refresh:success');
        if (originalConfig.headers) {
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalConfig);
      }

      // Refresh impossible → ne pas purger le user encore : on declenche le modal
      // de reauth qui va permettre a l'utilisateur de resaisir son mot de passe
      // sans perdre son contexte (ecran courant, etat formulaire, etc.).
      // Le hard-clear ne se fera que si l'utilisateur annule explicitement.
      const email = await getStoredUserEmail();
      await clearTokensOnly();
      authFeedbackBus.emit('refresh:failed', { code: errorCode });
      authFeedbackBus.emit('reauth:required', { email, reason: errorCode ?? 'REFRESH_FAILED' });
      return Promise.reject(error);
    }

    // ── Backend down / timeout / pas de reseau ────────────────────────
    // Le caller (ecran) catch deja et peut afficher son propre message,
    // mais beaucoup de boutons silencieux dans l'app ne reagissent pas.
    // On affiche ici un Alert global *throttle* pour rassurer l'utilisateur
    // ("rien ne se passe quand je clique" → "ah il y a un probleme reseau").
    //
    // Skip si :
    //   - on est sur un endpoint /auth/* (login gere son propre toast)
    //   - on a deja servi du cache pour ce GET (fallback reussi plus haut)
    //   - un autre Alert reseau est deja sorti il y a moins de 5s
    //   - c'est un 4xx attendu (404, 400, 422...) que l'ecran va gerer
    {
      const status = error.response?.status;
      const code = error.code;
      const isNetworkError = code === 'ERR_NETWORK' || !error.response;
      const isTimeout = code === 'ECONNABORTED';
      const isServerDown = typeof status === 'number' && status >= 500;

      if ((isNetworkError || isTimeout || isServerDown) && !isAuthUrl(originalConfig?.url)) {
        showBackendErrorOnce(isServerDown ? 'server' : isTimeout ? 'timeout' : 'network');
      }
    }

    // ── 402 Payment Required : feature d'abonnement manquante ───────────
    // Le backend renvoie SubscriptionGateResponse { type, feature,
    // currentPlan, requiredPlan, message, upgradeUrl } depuis l'aspect
    // SubscriptionFeatureAspect. On affiche un Alert avec CTA vers la
    // page Mon abonnement pour que l'epicier puisse upgrade en un tap.
    // Throttle implicite : l'epicier doit dismiss le precedent Alert avant
    // qu'un nouveau s'affiche, donc pas besoin de gestion specifique.
    if (error.response?.status === 402) {
      const data: any = error.response.data;
      const message: string | undefined = data?.message;
      const requiredPlan: string | undefined = data?.requiredPlan;
      try {
        const { Alert } = require('react-native');
        const { router } = require('expo-router');
        const planLabel = requiredPlan ? planHumanName(requiredPlan) : 'supérieur';
        const body = message
          ?? `Cette fonctionnalité nécessite le plan ${planLabel} ou supérieur. Souhaitez-vous voir les offres ?`;
        Alert.alert(
          '🔒 Fonctionnalité bloquée',
          body,
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: 'Voir les offres',
              onPress: () => {
                try { router.push('/(epicier)/mon-abonnement'); } catch (e) {
                  console.warn('[API] redirect mon-abonnement failed:', e);
                }
              },
            },
          ],
        );
      } catch (e) {
        console.warn('[API] 402 modal impossible:', e);
      }
      // Tagger l'erreur pour que les ecrans en aval (catch + Alert.alert
      // generique "Sauvegarde impossible") puissent l'ignorer.
      (error as any).__subscriptionGateHandled = true;
    }

    // ── 403 enrichi : permission manquante identifiee ────────────────────
    // Le backend (V97+) renvoie PermissionDeniedResponse {message, requiredPermission}
    // depuis l'aspect EpicierPermissionAspect. On affiche un Alert contextualise
    // une seule fois plutot que de laisser chaque ecran improviser son propre
    // "Erreur" generique.
    if (error.response?.status === 403) {
      const data: any = error.response.data;
      const requiredPermission: string | undefined = data?.requiredPermission;
      if (requiredPermission) {
        try {
          const { Alert } = require('react-native');
          const { labelForPermission, COLLABORATOR_ROLE_LABELS_FR } = require('../constants/permissionLabels');
          const cached = (() => {
            try { return require('../hooks/useCurrentUser').getCachedUser(); } catch { return null; }
          })();
          const collabRole: string | undefined = cached?.collaboratorRole;
          const roleLabel = collabRole
            ? (COLLABORATOR_ROLE_LABELS_FR[collabRole] ?? collabRole)
            : null;
          const featureLabel = labelForPermission(requiredPermission);
          const detail = roleLabel
            ? `L'action « ${featureLabel} » n'est pas disponible pour le rôle ${roleLabel}.`
            : `L'action « ${featureLabel} » n'est pas autorisée.`;
          Alert.alert('Accès refusé', detail);
        } catch (e) {
          console.warn('[API] 403 toast impossible:', e);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
