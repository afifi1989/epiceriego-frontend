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
  USER: '@abridgo_user',
  ROLE: '@abridgo_role',
  SAVED_CARDS: '@abridgo_saved_cards',
  CART: '@abridgo_cart',
} as const;

export type UserRole = 'CLIENT' | 'EPICIER' | 'LIVREUR';