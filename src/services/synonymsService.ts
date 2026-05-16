import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { SynonymExpansionMap } from '../utils/synonymExpansion';

/** Mirror of {@code com.epiceriego.catalog.dto.SynonymDTO}. */
export interface SearchSynonym {
  id: number;
  term: string;
  canonical: string;
  /** ISO code: "ary" (Darija latin), "ar", "fr", "en", "tz". */
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface SynonymRequest {
  term: string;
  canonical: string;
  language?: string;
}

/**
 * Sync of the per-épicerie synonym expansion map for offline POS search.
 *
 * <p>Mirrors {@code SynonymService.getExpansionSnapshot} on the backend
 * (10-min in-memory snapshot, invalidated on every CRUD). We replicate the
 * same TTL on the client so a synonym added by the épicier shows up within
 * 10 minutes without manual refresh, and the search keeps working offline
 * in the meantime.
 *
 * <p>Storage: AsyncStorage keyed by épicerie id, so multi-account devices
 * don't leak maps across épiceries. Cache miss / stale → re-fetch; network
 * failure on stale cache → keep using the stale entry (offline-first).
 */

const TTL_MS = 10 * 60 * 1000; // 10 min — aligned with backend snapshot TTL.
const STORAGE_PREFIX = '@synonyms_map_';

interface CachedSnapshot {
  map: SynonymExpansionMap;
  /** Epoch millis when the map was fetched. Used for TTL comparisons. */
  fetchedAt: number;
}

/** In-process memoization on top of AsyncStorage so a hot screen doesn't
 *  pay the JSON.parse cost on every keystroke. */
const memoryCache = new Map<number, CachedSnapshot>();

const storageKey = (epicerieId: number) => `${STORAGE_PREFIX}${epicerieId}`;

const isFresh = (entry: CachedSnapshot): boolean =>
  Date.now() - entry.fetchedAt < TTL_MS;

const fetchFromBackend = async (epicerieId: number): Promise<SynonymExpansionMap> => {
  const url = `/epiceries/${epicerieId}/synonyms/expansion-map`;
  const response = await api.get<SynonymExpansionMap>(url);
  // Defensive: an empty/null body is a valid "no synonyms" answer, not an error.
  return response.data || {};
};

const persist = async (epicerieId: number, snapshot: CachedSnapshot): Promise<void> => {
  try {
    await AsyncStorage.setItem(storageKey(epicerieId), JSON.stringify(snapshot));
  } catch (e) {
    console.warn('[synonyms] AsyncStorage write failed (non-blocking)', e);
  }
};

const restore = async (epicerieId: number): Promise<CachedSnapshot | null> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(epicerieId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedSnapshot;
  } catch {
    return null;
  }
};

export const synonymsService = {
  /**
   * Get the expansion map for {@code epicerieId}. Resolves with the freshest
   * data available:
   *  1. memory cache (hot path) → return directly
   *  2. AsyncStorage cache (warm) → return + refresh in background if stale
   *  3. network fetch (cold) → wait, persist, return
   *
   * <p>Network failures are <strong>not</strong> propagated to the caller
   * when a stale entry exists — the offline-first POS keeps working with
   * yesterday's map until the backend is reachable again.
   */
  getExpansionMap: async (epicerieId: number): Promise<SynonymExpansionMap> => {
    if (!epicerieId) return {};

    // 1) Memory cache
    const inMem = memoryCache.get(epicerieId);
    if (inMem && isFresh(inMem)) return inMem.map;

    // 2) AsyncStorage cache
    const stored = inMem ?? (await restore(epicerieId));
    if (stored) {
      memoryCache.set(epicerieId, stored);
      if (isFresh(stored)) return stored.map;
      // Stale — try to refresh, but fall back to stale on network error.
      try {
        const fresh = await fetchFromBackend(epicerieId);
        const snap: CachedSnapshot = { map: fresh, fetchedAt: Date.now() };
        memoryCache.set(epicerieId, snap);
        await persist(epicerieId, snap);
        return fresh;
      } catch (e) {
        console.warn('[synonyms] Refresh failed, using stale cache', e);
        return stored.map;
      }
    }

    // 3) Cold fetch
    try {
      const fresh = await fetchFromBackend(epicerieId);
      const snap: CachedSnapshot = { map: fresh, fetchedAt: Date.now() };
      memoryCache.set(epicerieId, snap);
      await persist(epicerieId, snap);
      return fresh;
    } catch (e) {
      console.warn('[synonyms] Cold fetch failed, returning empty map', e);
      // Return empty so the caller's filter behaves as before (substring only).
      return {};
    }
  },

  /**
   * Clear the cached map for an épicerie — used by the synonyms-management UI
   * after the épicier creates/edits/deletes a synonym, so the next POS search
   * picks up the change immediately instead of waiting for the 10-min TTL.
   */
  invalidate: async (epicerieId: number): Promise<void> => {
    memoryCache.delete(epicerieId);
    try {
      await AsyncStorage.removeItem(storageKey(epicerieId));
    } catch {
      /* ignore */
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // CRUD — used by the synonyms management UI. Each mutation invalidates
  // the local cache so the POS search picks up the change immediately.
  // ─────────────────────────────────────────────────────────────────────

  list: async (epicerieId: number): Promise<SearchSynonym[]> => {
    const response = await api.get<SearchSynonym[]>(`/epiceries/${epicerieId}/synonyms`);
    return response.data || [];
  },

  create: async (epicerieId: number, request: SynonymRequest): Promise<SearchSynonym> => {
    const response = await api.post<SearchSynonym>(`/epiceries/${epicerieId}/synonyms`, request);
    await synonymsService.invalidate(epicerieId);
    return response.data;
  },

  update: async (epicerieId: number, synonymId: number, request: SynonymRequest): Promise<SearchSynonym> => {
    const response = await api.put<SearchSynonym>(
      `/epiceries/${epicerieId}/synonyms/${synonymId}`, request);
    await synonymsService.invalidate(epicerieId);
    return response.data;
  },

  remove: async (epicerieId: number, synonymId: number): Promise<void> => {
    await api.delete(`/epiceries/${epicerieId}/synonyms/${synonymId}`);
    await synonymsService.invalidate(epicerieId);
  },

  restoreDefaults: async (epicerieId: number): Promise<{ restored: number; message: string }> => {
    const response = await api.post<{ restored: number; message: string }>(
      `/epiceries/${epicerieId}/synonyms/restore-defaults`);
    await synonymsService.invalidate(epicerieId);
    return response.data;
  },

  /**
   * List the default synonyms not yet installed for the épicerie. Each
   * entry has the same shape as a {@link SynonymRequest}, so the UI can
   * pass it straight to {@code create} when the épicier accepts a single
   * suggestion (fine-grained alternative to {@code restoreDefaults}).
   */
  listMissingDefaults: async (epicerieId: number): Promise<SynonymRequest[]> => {
    const response = await api.get<SynonymRequest[]>(
      `/epiceries/${epicerieId}/synonyms/missing-defaults`);
    return response.data || [];
  },
};
