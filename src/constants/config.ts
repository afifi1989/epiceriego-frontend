export const API_CONFIG = {
  // URL du serveur backend
  // PRODUCTION: https://afifi-mostafa.com/api (nécessite SSL configuré)
  // DEVELOPMENT: http://afifi-mostafa.com/api (temporaire, non sécurisé)
  BASE_URL: 'https://afifi-mostafa.com/api',
  // Increased timeout for AI chatbot (Ollama can be slow)
  TIMEOUT: 180000, // 3 minutes
} as const;
export const STORAGE_KEYS = {
  TOKEN: '@abridgo_token',
  REFRESH_TOKEN: '@abridgo_refresh_token',
  USER: '@abridgo_user',
  ROLE: '@abridgo_role',
  SAVED_CARDS: '@abridgo_saved_cards',
  CART: '@abridgo_cart',
} as const;

/**
 * Google Sign-In OAuth 2.0 Web Client ID (créé dans Google Cloud Console).
 * - Type: "Web application"
 * - Doit être le MÊME ID que celui configuré côté backend (env var
 *   GOOGLE_OAUTH_WEB_CLIENT_ID), parce que c'est l'audience du JWT que le
 *   backend va vérifier.
 *
 * iOS / Android obtiennent leur ID séparément (différent par plateforme),
 * mais le ID token retourné porte ce Web Client ID en aud.
 *
 * À remplir AVANT toute tentative d'utilisation de Google Sign-In, sinon
 * l'écran de login restera bloqué côté mobile (et le backend retournera 503).
 */
export const GOOGLE_OAUTH = {
  WEB_CLIENT_ID: '981021860949-s8940eh9dkdr5n3q7b49baff42seacie.apps.googleusercontent.com',
  // Optionnel : iOS Client ID (utile uniquement si on veut que GoogleSignIn
  // utilise une autre identité côté iOS). Sinon, le webClientId suffit.
  IOS_CLIENT_ID: '',
} as const;

export type UserRole = 'CLIENT' | 'EPICIER' | 'LIVREUR';