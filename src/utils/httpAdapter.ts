/**
 * Adapter HTTP personnalisé pour Axios en développement
 * Contourne les problèmes de certificats auto-signés en React Native
 * En React Native, on utilise un interceptor de réponse au lieu d'un adapter
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';

const isDevelopment = __DEV__;
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Configure un interceptor de réponse pour retry en cas d'erreur SSL/réseau
 */
export const configureHttpAdapter = (axiosInstance: AxiosInstance): void => {
  if (!isDevelopment) {
    console.log('[HttpAdapter] Mode production - pas de retry');
    return;
  }

  console.log('[HttpAdapter] Mode développement - activation retry automatique');
  console.log('[HttpAdapter] Plateforme:', Platform.OS);

  // Interceptor de réponse pour retry
  axiosInstance.interceptors.response.use(
    (response) => {
      // Réinitialiser le compteur en cas de succès
      if (retryCount > 0) {
        console.log(`[HttpAdapter] ✅ Réussi après ${retryCount} retry(s)`);
        retryCount = 0;
      }
      return response;
    },
    async (error: AxiosError) => {
      // Ne retry que sur erreurs réseau/SSL
      const isNetworkError =
        error.message?.includes('Network request failed') ||
        error.message?.includes('CERTIFICATE_VERIFY_FAILED') ||
        error.message?.includes('SSL') ||
        error.message?.includes('certificate') ||
        error.code === 'EPROTO' ||
        error.code === 'ERR_NETWORK';

      if (!isNetworkError) {
        // Ce n'est pas une erreur réseau/SSL
        console.log('[HttpAdapter] Erreur non-réseau, pas de retry');
        return Promise.reject(error);
      }

      // Vérifier si on a encore des retries
      if (retryCount >= MAX_RETRIES) {
        console.error(`[HttpAdapter] ❌ Erreur après ${MAX_RETRIES} retry(s)`);
        retryCount = 0;
        return Promise.reject(error);
      }

      retryCount++;
      const delayMs = 100 * Math.pow(2, retryCount - 1);

      console.warn(`[HttpAdapter] ❌ Erreur réseau/SSL (tentative ${retryCount}/${MAX_RETRIES})`);
      console.warn(`[HttpAdapter] Erreur: ${error.message}`);
      console.warn(`[HttpAdapter] ⏳ Retry après ${delayMs}ms...`);

      // Attendre avant retry
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Retry la requête
      console.log(`[HttpAdapter] 🔄 Tentative ${retryCount + 1}/${MAX_RETRIES + 1}...`);
      return axiosInstance(error.config!);
    }
  );

  console.log('[HttpAdapter] Interceptor configuré - retry automatique activé');
};
