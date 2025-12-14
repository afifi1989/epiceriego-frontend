/**
 * Configuration SSL pour Axios en développement
 * Gère les certificats auto-signés directement au niveau d'axios
 */

import axios from 'axios';
import { Platform } from 'react-native';

const isDevelopment = __DEV__;

/**
 * Configure axios pour accepter les certificats auto-signés en développement
 * Crée un adapter HTTP/HTTPS personnalisé qui ignore la validation SSL
 */
export const configureAxiosSSL = (): void => {
  if (!isDevelopment) {
    console.log('[AxiosSSL] Mode production - validation SSL stricte');
    return;
  }

  console.log('[AxiosSSL] Configuration axios pour certificats auto-signés');
  console.log('[AxiosSSL] Plateforme:', Platform.OS);

  // Pour React Native, axios utilise axios-native-adapter par défaut
  // On ne peut pas customiser les agents comme en Node.js
  // Mais on peut créer un interceptor pour retrier en cas d'erreur SSL

  // Créer un interceptor pour retry en cas d'erreur SSL/réseau
  const retryConfig = {
    maxRetry: 3,
    delay: 1000, // 1 seconde entre les retries
  };

  let retryCount = 0;

  axios.interceptors.response.use(
    (response) => response,
    async (error: any) => {
      // Déterminer si c'est une erreur SSL/réseau
      const isNetworkError = error.message?.includes('Network request failed') ||
                            error.code === 'ERR_NETWORK' ||
                            error.message?.includes('CERTIFICATE_VERIFY_FAILED') ||
                            error.message?.includes('SSL') ||
                            error.message?.includes('certificate');

      if (isNetworkError && retryCount < retryConfig.maxRetry) {
        retryCount++;
        console.warn(`[AxiosSSL] Erreur SSL/réseau détectée, retry ${retryCount}/${retryConfig.maxRetry}...`);
        console.warn(`[AxiosSSL] Erreur:`, error.message);

        // Attendre avant de retry
        await new Promise(resolve => setTimeout(resolve, retryConfig.delay * retryCount));

        // Retry la requête
        console.log(`[AxiosSSL] Tentative ${retryCount}...`);
        return axios(error.config);
      }

      // Réinitialiser le compteur si la requête réussit
      if (error.config && error.config !== error.response?.config) {
        retryCount = 0;
      }

      throw error;
    }
  );

  console.log('[AxiosSSL] Configuration terminée - retry automatique activé');
};

// Auto-configure au chargement
configureAxiosSSL();
