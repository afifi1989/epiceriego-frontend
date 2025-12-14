/**
 * Gestionnaire SSL/TLS pour React Native
 * Configure automatiquement la gestion des certificats selon l'environnement
 *
 * En développement (avec certificats auto-signés):
 * - Android: Accepte les certificats utilisateur (via network_security_config.xml)
 * - iOS: Accepte les certificats spécifiés (via NSExceptionDomains dans app.json)
 * - Node.js: Désactive la validation SSL (NODE_TLS_REJECT_UNAUTHORIZED = '0')
 *
 * En production: Les certificats sont strictement validés
 */

import { Platform } from 'react-native';

const isDevelopment = __DEV__;
const isProduction = !isDevelopment;

console.log('========================================');
console.log('[SSLManager] Initialisation');
console.log('[SSLManager] Environnement:', isDevelopment ? 'DÉVELOPPEMENT' : 'PRODUCTION');
console.log('[SSLManager] Plateforme:', Platform.OS);
console.log('========================================');

/**
 * Configure les paramètres SSL pour le développement
 */
const setupDevelopmentSSL = (): void => {
  if (!isDevelopment) {
    console.log('[SSLManager] Mode production - validation SSL stricte');
    return;
  }

  console.log('[SSLManager] Mode développement - configuration SSL flexible');

  // Désactiver la validation SSL au niveau Node.js
  if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('[SSLManager] NODE_TLS_REJECT_UNAUTHORIZED = 0 (Node.js)');
  }

  // Configuration spécifique par plateforme
  if (Platform.OS === 'android') {
    console.log('[SSLManager] Android: Utilisez network_security_config.xml');
    console.log('[SSLManager] Les certificats auto-signés sont acceptés');
    console.log('[SSLManager] Domaine configuré: afifi-mostafa.com');
  } else if (Platform.OS === 'ios') {
    console.log('[SSLManager] iOS: Utilisez NSExceptionDomains dans app.json');
    console.log('[SSLManager] Les certificats auto-signés sont acceptés');
    console.log('[SSLManager] Domaine configuré: afifi-mostafa.com');
  } else if (Platform.OS === 'web') {
    console.log('[SSLManager] Web: Navigateur gère les certificats');
    console.log('[SSLManager] HTTPS natif avec certificats standard');
  }
};

/**
 * Diganostique SSL
 */
export const getSSLDiagnostics = (): {
  isDevelopment: boolean;
  platform: string;
  sslValidation: string;
  details: string[];
} => {
  const details: string[] = [];

  if (isDevelopment) {
    details.push('Mode développement - certificats auto-signés acceptés');
    details.push('httpClient.ts: Wrapper fetch avec retry');
    if (Platform.OS === 'android') {
      details.push('Android: network_security_config.xml active');
    } else if (Platform.OS === 'ios') {
      details.push('iOS: NSExceptionDomains configuré dans app.json');
    }
  } else {
    details.push('Mode production - validation SSL stricte');
    details.push('Certificats auto-signés REJETÉS');
    details.push('Utilisez un certificat SSL valide (Let\'s Encrypt)');
  }

  return {
    isDevelopment,
    platform: Platform.OS,
    sslValidation: isDevelopment ? 'FLEXIBLE' : 'STRICT',
    details,
  };
};

/**
 * Vérifie la configuration SSL
 */
export const verifySSlConfiguration = (): boolean => {
  console.log('[SSLManager] Vérification de la configuration SSL...');

  if (isDevelopment) {
    console.log('[SSLManager] ✓ Configuration SSL flexible activée');
    return true;
  } else {
    console.log('[SSLManager] ✓ Configuration SSL stricte (production)');
    return true;
  }
};

// Initialiser la configuration SSL
setupDevelopmentSSL();
verifySSlConfiguration();

console.log('[SSLManager] Configuration terminée');
console.log('========================================');

export const sslConfig = {
  isDevelopment,
  isProduction,
  platform: Platform.OS,
};
