export const API_CONFIG = {
  // URL du serveur backend HTTPS
  BASE_URL: 'https://afifi-mostafa.com:8443/api',
  TIMEOUT: 10000,
} as const;
export const STORAGE_KEYS = {
  TOKEN: '@epiceriego_token',
  USER: '@epiceriego_user',
  ROLE: '@epiceriego_role',
  SAVED_CARDS: '@epiceriego_saved_cards',
  CART: '@epiceriego_cart',
} as const;

export type UserRole = 'CLIENT' | 'EPICIER' | 'LIVREUR';