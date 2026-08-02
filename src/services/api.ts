import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import { authFeedbackBus } from './auth/authFeedbackBus';
import { subscriptionUpsellBus } from './subscriptionUpsellBus';
import { translate, type Language } from '../i18n/translations';

/**
 * Langue courante mise en cache (mise à jour à chaque requête via l'intercepteur,
 * qui lit déjà `app_language`). Permet aux Alert des intercepteurs de réponse —
 * qui n'ont pas de contexte React — de se traduire dans les 4 langues.
 */
let currentLang: Language = 'fr';

/**
 * Rôle courant mis en cache (mis à jour à chaque requête via l'intercepteur,
 * qui lit déjà `@abridgo_role`). Permet aux intercepteurs de réponse — sans
 * contexte React — de savoir si l'utilisateur est un EPICIER avant de déclencher
 * une modal/redirection propre à l'espace épicier (cf gate abonnement 402).
 */
let currentRole: string | null = null;

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

function showBackendErrorOnce(kind: 'network' | 'timeout' | 'server'): void {
  const now = Date.now();
  if (now - lastBackendErrorAt < BACKEND_ERROR_THROTTLE_MS) return;
  lastBackendErrorAt = now;
  try {
    const { Alert } = require('react-native');
    let title: string;
    let message: string;
    if (kind === 'network') {
      title = translate(currentLang, 'apiErrors.networkTitle');
      message = translate(currentLang, 'apiErrors.networkMessage');
    } else if (kind === 'timeout') {
      title = translate(currentLang, 'apiErrors.timeoutTitle');
      message = translate(currentLang, 'apiErrors.timeoutMessage');
    } else {
      title = translate(currentLang, 'apiErrors.serverTitle');
      message = translate(currentLang, 'apiErrors.serverMessage');
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
    // Mémorise la langue pour les Alert des intercepteurs de réponse (M10).
    currentLang = resolvedLang as Language;
    // Mémorise le rôle pour la garde du gate abonnement 402 (M11).
    currentRole = role;

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

    return response;
  },
  async (error: AxiosError) => {
    const originalConfig = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    console.error('[API] ❌ ERREUR:', originalConfig?.url, error.code, error.response?.status);

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
    // Garde (M11) : la modal + redirection vers /(epicier)/mon-abonnement ne
    // concernent QUE l'espace épicier. On ne la déclenche donc que si :
    //   - l'utilisateur est un EPICIER (rôle mémorisé dans l'intercepteur), et
    //   - la requête n'est PAS un polling de fond (un poll toutes les ~10 s
    //     empilerait sinon les Alert et redirigerait l'épicier en boucle).
    //     Les appels de fond peuvent s'exclure via `config.__backgroundPoll = true`
    //     ou l'en-tête `X-Background-Poll`.
    // Pour un CLIENT, l'erreur 402 est simplement propagée sans redirection.
    const isBackgroundPoll =
      (originalConfig as any)?.__backgroundPoll === true ||
      (originalConfig?.headers as any)?.['X-Background-Poll'] != null;
    if (error.response?.status === 402 && currentRole === 'EPICIER' && !isBackgroundPoll) {
      const data: any = error.response.data;
      // On délègue l'affichage à la modal riche UpsellModal (montée au niveau
      // racine sous LanguageProvider) via un event bus — l'intercepteur n'est
      // pas un composant React et ne peut pas afficher une modal contextuelle.
      // On transmet le SubscriptionGateResponse tel quel (feature, currentPlan,
      // requiredPlan, message) ; le libellé du plan et l'i18n sont résolus
      // côté composant.
      try {
        subscriptionUpsellBus.emit({
          feature: data?.feature,
          currentPlan: data?.currentPlan,
          requiredPlan: data?.requiredPlan,
          message: data?.message,
        });
      } catch (e) {
        console.warn('[API] 402 upsell emit impossible:', e);
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
            ? translate(currentLang, 'apiErrors.actionNotAvailableForRole', { feature: featureLabel, role: roleLabel })
            : translate(currentLang, 'apiErrors.actionNotAllowed', { feature: featureLabel });
          Alert.alert(translate(currentLang, 'apiErrors.accessDeniedTitle'), detail);
        } catch (e) {
          console.warn('[API] 403 toast impossible:', e);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
