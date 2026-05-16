import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Identifie de façon stable l'install courante de l'app pour le flow auth
 * device-bound. La clé est un UUID v4 généré à la 1ère installation et
 * persisté dans expo-secure-store (encrypté côté iOS Keychain / Android
 * EncryptedSharedPreferences).
 *
 * Une réinstallation de l'app efface le SecureStore — un nouveau device_id
 * sera généré et l'utilisateur devra re-valider via OTP email à la prochaine
 * connexion.
 */

const DEVICE_ID_KEY = 'abridgo_device_id';

/**
 * Récupère le device_id existant ou en crée un nouveau (UUID v4 cryptographique).
 * Idempotent : appels multiples retournent toujours la même valeur pour cette
 * installation.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
  } catch (e) {
    console.warn('[deviceService] SecureStore read failed:', e);
  }

  const newId = Crypto.randomUUID();
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
  } catch (e) {
    console.warn('[deviceService] SecureStore write failed (id non-persistant):', e);
  }
  return newId;
}

export interface DeviceContext {
  deviceId: string;
  deviceLabel: string;
  platform: string;
  osVersion: string;
  appVersion: string;
}

/**
 * Construit la DeviceContext complète à envoyer au backend (login + login-google
 * + login-phone-otp). Tous les champs sauf deviceId sont best-effort.
 */
export async function getDeviceContext(): Promise<DeviceContext> {
  const deviceId = await getOrCreateDeviceId();
  const modelName = Device.modelName || Device.deviceName || 'Device';
  const platformOs = Platform.OS;
  return {
    deviceId,
    deviceLabel: modelName,
    platform: platformOs,
    osVersion: Device.osVersion || Platform.Version?.toString() || '',
    appVersion: Constants.expoConfig?.version || '1.0.0',
  };
}

/**
 * Efface le device_id stocké. À utiliser uniquement pour le debug ou si on
 * veut forcer une re-validation (typiquement après "Déconnexion de tous les
 * appareils" côté profil).
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  } catch (e) {
    console.warn('[deviceService] SecureStore delete failed:', e);
  }
}
