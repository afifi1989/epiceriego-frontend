/**
 * Hook + cache module-level pour acceder au LoginResponse stocke.
 *
 * <p>Pourquoi un cache : <code>PermissionGate</code> est utilise sur de nombreux
 * boutons inline. Faire un <code>AsyncStorage.getItem</code> par instance serait
 * gaspilleur et asynchrone (clignote). On lit AsyncStorage une fois au demarrage
 * puis on sert depuis la memoire.</p>
 *
 * <p>L'alimentation explicite (apres login/refresh/logout) passe par
 * {@link setCachedUser}, appele depuis {@code authService}/{@code api.ts}.</p>
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import { LoginResponse } from '../type';

let cachedUser: LoginResponse | null | undefined = undefined; // undefined = not loaded yet
let loadPromise: Promise<LoginResponse | null> | null = null;

type Listener = (user: LoginResponse | null) => void;
const listeners: Set<Listener> = new Set();

/** Met a jour le cache et notifie tous les abonnes (PermissionGate et autres). */
export function setCachedUser(user: LoginResponse | null): void {
  cachedUser = user;
  listeners.forEach(l => l(user));
}

/** Lecture synchrone du cache. Renvoie undefined si pas encore charge. */
export function getCachedUser(): LoginResponse | null | undefined {
  return cachedUser;
}

/** Charge le user depuis AsyncStorage et alimente le cache. Idempotent. */
export async function loadCurrentUser(): Promise<LoginResponse | null> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const user: LoginResponse | null = userStr ? JSON.parse(userStr) : null;
      setCachedUser(user);
      return user;
    } catch {
      setCachedUser(null);
      return null;
    } finally {
      // Garder loadPromise garde une seule lecture concurrente : on le remet a null
      // une fois la promise resolue pour permettre une future invalidation manuelle.
      loadPromise = null;
    }
  })();
  return loadPromise;
}

/**
 * Hook React : retourne le user courant (ou null). Declenche le 1er load si besoin
 * et s'abonne aux mises a jour du cache.
 */
export function useCurrentUser(): LoginResponse | null {
  const [user, setUser] = useState<LoginResponse | null>(cachedUser ?? null);

  useEffect(() => {
    if (cachedUser === undefined) {
      loadCurrentUser().then(u => setUser(u));
    }
    const listener: Listener = u => setUser(u);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return user;
}
