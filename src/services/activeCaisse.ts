/**
 * Caisse « active » de CET appareil (liaison device ↔ caisse), persistée en
 * AsyncStorage. C'est la caisse sur laquelle ce téléphone/tablette ouvre la
 * session et encaisse les ventes directes.
 *
 * Cache module-level + listeners (même pattern que useCurrentUser) pour un
 * accès synchrone et des mises à jour réactives via {@link useActiveCaisse}.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@abridgo_active_caisse';

let cached: number | null | undefined = undefined; // undefined = pas encore chargé
type Listener = (id: number | null) => void;
const listeners = new Set<Listener>();

/** Charge la caisse active depuis AsyncStorage et alimente le cache. */
export async function loadActiveCaisse(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const n = raw != null ? Number(raw) : NaN;
    cached = Number.isFinite(n) ? n : null;
  } catch {
    cached = null;
  }
  return cached ?? null;
}

/** Lecture synchrone (undefined si pas encore chargé). */
export function getActiveCaisseId(): number | null | undefined {
  return cached;
}

export async function setActiveCaisseId(id: number | null): Promise<void> {
  cached = id;
  try {
    if (id == null) await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // ignore storage errors
  }
  listeners.forEach(l => l(id));
}

/** Hook réactif : id de la caisse active (null = caisse par défaut serveur). */
export function useActiveCaisse(): number | null {
  const [id, setId] = useState<number | null>(cached ?? null);

  useEffect(() => {
    if (cached === undefined) loadActiveCaisse().then(v => setId(v));
    const l: Listener = v => setId(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return id;
}
