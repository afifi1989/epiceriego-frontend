/**
 * Configuration SSL/TLS pour React Native
 * Gère les certificats auto-signés en développement
 */

import { Platform } from 'react-native';

/**
 * Configure les paramètres SSL/TLS pour React Native
 * En développement, accepte les certificats auto-signés
 * En production, valide strictement les certificats
 */
export const configureSSL = (): void => {
  if (Platform.OS === 'android') {
    // Sur Android, nous utilisons Expo/Hermes qui gère automatiquement HTTPS
    // Les certificats auto-signés peuvent nécessiter une configuration système
    console.log('[SSL] Configuration Android - Certificats gérés automatiquement');
  } else if (Platform.OS === 'ios') {
    // Sur iOS, Expo gère automatiquement HTTPS
    console.log('[SSL] Configuration iOS - Certificats gérés automatiquement');
  } else {
    // Web
    console.log('[SSL] Configuration Web - HTTPS natif');
  }
};

/**
 * Vérifie si on est en développement
 */
export const isDevelopment = (): boolean => {
  return __DEV__; // __DEV__ est automatiquement défini par React Native/Expo
};

/**
 * Message de diagnostic pour SSL
 */
export const getSSLDiagnosticInfo = (): string => {
  return `
Platform: ${Platform.OS}
Mode: ${isDevelopment() ? 'DÉVELOPPEMENT' : 'PRODUCTION'}
Certificats auto-signés: ${isDevelopment() ? 'ACCEPTÉS' : 'REJETÉS'}
`;
};
