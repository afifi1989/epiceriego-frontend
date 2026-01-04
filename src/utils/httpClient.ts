/**
 * Utilitaire pour configurer le client HTTP pour les certificats auto-signés en développement
 * Gère les certificats auto-signés sur iOS, Android, et Node.js
 */

import { Platform } from 'react-native';

const isDevelopment = __DEV__; // Variable globale Expo

if (isDevelopment) {
  console.log('[HTTPClient] Configuration pour certificats auto-signés en développement');
  console.log('[HTTPClient] Plateforme:', Platform.OS);

  // Désactiver la validation SSL de Node.js (si disponible)
  if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('[HTTPClient] NODE_TLS_REJECT_UNAUTHORIZED = 0');
  }

  // @ts-ignore
  const originalFetch = global.fetch;

  // Wrapper fetch pour gérer les certificats auto-signés
  // @ts-ignore
  global.fetch = function (...args: any[]) {
    const url = args[0];
    const options = args[1] || {};

    console.log(`[HTTPClient] Fetch request: ${typeof url === 'string' ? url : url.toString()}`);

    return (originalFetch.apply(global, args as any) as Promise<Response>)
      .catch((error: any) => {
        // Erreurs courantes liées aux certificats
        const isNetworkError = error.message?.includes('Network request failed');
        const isCertError = error.message?.includes('certificate') ||
                           error.message?.includes('SSL') ||
                           error.message?.includes('Illegal CrossOriginRequest') ||
                           error.code === 'EPROTO';

        if ((isNetworkError || isCertError) && Platform.OS === 'ios') {
          console.warn('[HTTPClient] Erreur certificat iOS détectée, retry...');
          console.warn('[HTTPClient] Erreur:', error.message);
          console.warn('[HTTPClient] Code:', error.code);

          // Retry une fois après délai
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              (originalFetch.apply(global, args as any) as Promise<Response>)
                .then(resolve)
                .catch((retryError: any) => {
                  console.error('[HTTPClient] Retry échoué:', retryError.message);
                  reject(retryError);
                });
            }, 1000);
          });
        }

        if (isNetworkError || isCertError) {
          console.warn('[HTTPClient] Erreur réseau/certificat détectée, retry...');
          console.warn('[HTTPClient] Plateforme:', Platform.OS);
          console.warn('[HTTPClient] Erreur:', error.message);

          // Retry une fois
          return originalFetch.apply(global, args as any) as Promise<Response>;
        }

        throw error;
      });
  };

  console.log('[HTTPClient] Fetch wrapper activé');
}

export const isSSLValidationDisabled = isDevelopment;
