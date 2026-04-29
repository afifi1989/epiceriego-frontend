/**
 * Identifiant persistant de l'appareil (device ID) — Axe POS / S6.
 *
 * <p>Généré une fois au premier lancement et stocké dans AsyncStorage.
 * Utilisé pour :
 *  - Scope multi-device des sessions POS (une tablette A vs tablette B)
 *  - Journalisation / debug
 *  - Futur : isolation stricte par device si la configuration le demande</p>
 *
 * <p>Format : {@code dev-{timestamp}-{rand}} — pas un UUID officiel mais
 * suffisamment unique au niveau d'une épicerie.</p>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'epicerie.deviceId.v1';

let cached: string | null = null;

function generate(): string {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const deviceIdService = {
  /** Récupère l'ID device (le crée au premier appel). */
  async get(): Promise<string> {
    if (cached) return cached;
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      if (existing) {
        cached = existing;
        return existing;
      }
    } catch {
      // ignore — on régénère
    }
    const fresh = generate();
    await AsyncStorage.setItem(STORAGE_KEY, fresh);
    cached = fresh;
    return fresh;
  },

  /** Récupère l'ID sans promise (null si pas encore initialisé). */
  getCached(): string | null {
    return cached;
  },

  /** Réinitialise (utilisé rarement — ex. reset d'app). */
  async reset(): Promise<void> {
    cached = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
};
