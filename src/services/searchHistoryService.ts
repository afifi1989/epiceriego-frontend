import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@abridgo_search_history_v1';
const MAX_ENTRIES = 8;
const MIN_LENGTH  = 2;

/**
 * Historique de recherche local par épicerie.
 *
 * Conception:
 * - Persistance: AsyncStorage (clé namespacée par epicerieId)
 * - Capacité bornée: 8 entrées max → l'UI tient sur 1-2 lignes
 * - Déduplication MRU: une recherche déjà présente remonte en tête
 * - Filtrage minimum: les requêtes < 2 caractères ne sont pas mémorisées
 * - Stockage par épicerie: la recherche "tomate" chez X ne pollue pas chez Y
 */

function keyFor(epicerieId: number | string | null | undefined): string {
  return `${STORAGE_KEY}_${epicerieId ?? 'global'}`;
}

async function list(epicerieId: number | string | null | undefined): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(epicerieId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((q: unknown) => typeof q === 'string') : [];
  } catch {
    return [];
  }
}

async function add(
  epicerieId: number | string | null | undefined,
  query: string
): Promise<string[]> {
  const normalized = query.trim();
  if (normalized.length < MIN_LENGTH) {
    return list(epicerieId);
  }
  try {
    const current = await list(epicerieId);
    const next = [
      normalized,
      ...current.filter(q => q.toLowerCase() !== normalized.toLowerCase()),
    ].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(keyFor(epicerieId), JSON.stringify(next));
    return next;
  } catch {
    return list(epicerieId);
  }
}

async function remove(
  epicerieId: number | string | null | undefined,
  query: string
): Promise<string[]> {
  try {
    const current = await list(epicerieId);
    const next = current.filter(q => q !== query);
    await AsyncStorage.setItem(keyFor(epicerieId), JSON.stringify(next));
    return next;
  } catch {
    return list(epicerieId);
  }
}

async function clear(epicerieId: number | string | null | undefined): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(epicerieId));
  } catch {
    // ignore
  }
}

export const searchHistoryService = { list, add, remove, clear };
