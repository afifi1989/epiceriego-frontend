// Déterminer l'URL API selon l'environnement
const getApiBaseUrl = (): string => {
  // URL du serveur distant (pour téléphones physiques et autres environnements)
  const REMOTE_SERVER = 'https://178.170.49.149:8443/api';

  // URL localhost (pour émulateur Android Studio)
  const LOCAL_EMULATOR = 'http://localhost:8080/api';

  // Par défaut, utiliser le serveur distant
  // Vous pouvez changer ceci selon vos besoins
  return REMOTE_SERVER;
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 10000,
} as const;
export const STORAGE_KEYS = {
  TOKEN: '@epiceriego_token',
  USER: '@epiceriego_user',
  ROLE: '@epiceriego_role',
} as const;

export type UserRole = 'CLIENT' | 'EPICIER' | 'LIVREUR';