/**
 * CacheService — Module de cache persistant unifié
 *
 * Architecture modulaire :
 * - Chaque domaine métier (products, orders, clients...) utilise un namespace isolé
 * - TTL configurable par entrée
 * - Invalidation ciblée ou par namespace
 * - Prêt pour migration microservice (chaque namespace = un service indépendant)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  version: number;
}

export interface CacheOptions {
  /** Durée de vie en millisecondes */
  ttl: number;
  /** Version du schéma — invalide automatiquement si différente */
  version?: number;
}

/** Namespaces par domaine métier (extensible) */
export type CacheNamespace =
  | 'epicerie'
  | 'products'
  | 'orders'
  | 'clients'
  | 'invoices'
  | 'stats'
  | 'categories'
  | 'tags'
  | 'livreurs'
  | 'collaborateurs'
  | 'notifications'
  | 'pos'
  | 'geo';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CACHE_PREFIX = '@offline_cache/';
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Plafond du nombre d'entrées de cache dans AsyncStorage. Au-delà, on
 * évince les plus anciennes (LRU par timestamp). Garde-fou contre la
 * limite Hermes "Property storage exceeds 196607 properties" qui se
 * déclenche quand le cache grossit sans limite (params variables côté
 * API, etc.).
 */
const MAX_CACHE_ENTRIES = 500;

/** Toutes les N écritures, déclenche un enforceMaxEntries() en arrière-plan. */
const PRUNE_EVERY_N_WRITES = 50;
let setCountSinceLastPrune = 0;

/** TTL par défaut par namespace (en ms) */
export const DEFAULT_TTL: Record<CacheNamespace, number> = {
  epicerie: 30 * 60 * 1000,      // 30 min (rarement modifié)
  products: 15 * 60 * 1000,      // 15 min
  orders: 5 * 60 * 1000,         // 5 min (volatile)
  clients: 15 * 60 * 1000,       // 15 min
  invoices: 15 * 60 * 1000,      // 15 min
  stats: 60 * 60 * 1000,         // 1h (analytique)
  categories: 24 * 60 * 60 * 1000, // 24h (quasi-statique)
  tags: 24 * 60 * 60 * 1000,     // 24h (quasi-statique)
  livreurs: 10 * 60 * 1000,      // 10 min
  collaborateurs: 30 * 60 * 1000, // 30 min
  notifications: 10 * 60 * 1000,  // 10 min
  pos: 2 * 60 * 1000,             // 2 min (sessions POS — très volatile)
  geo: 24 * 60 * 60 * 1000,       // 24h (référentiel pays/villes/quartiers/devises)
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildKey(namespace: CacheNamespace, key: string): string {
  return `${CACHE_PREFIX}${namespace}/${key}`;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Stocke une valeur dans le cache.
 */
async function set<T>(
  namespace: CacheNamespace,
  key: string,
  data: T,
  options?: Partial<CacheOptions>,
): Promise<void> {
  const ttl = options?.ttl ?? DEFAULT_TTL[namespace];
  const version = options?.version ?? CURRENT_SCHEMA_VERSION;

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
    version,
  };

  try {
    await AsyncStorage.setItem(buildKey(namespace, key), JSON.stringify(entry));

    // Garde-fou anti-saturation : toutes les N écritures, on force le cap.
    setCountSinceLastPrune++;
    if (setCountSinceLastPrune >= PRUNE_EVERY_N_WRITES) {
      setCountSinceLastPrune = 0;
      // Fire-and-forget : ne bloque pas le caller.
      enforceMaxEntries().catch(() => { /* silencieux */ });
    }
  } catch (err) {
    console.warn(`[CacheService] Erreur écriture ${namespace}/${key}:`, err);
  }
}

/**
 * Récupère une valeur du cache.
 * Retourne `null` si expirée, absente ou version incompatible.
 * Si `ignoreExpiry` est true, retourne même si expirée (mode offline).
 */
async function get<T>(
  namespace: CacheNamespace,
  key: string,
  options?: { ignoreExpiry?: boolean; version?: number },
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(namespace, key));
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const expectedVersion = options?.version ?? CURRENT_SCHEMA_VERSION;

    // Version mismatch → invalide
    if (entry.version !== expectedVersion) {
      await remove(namespace, key);
      return null;
    }

    // Vérifier expiration (sauf si ignoreExpiry)
    if (!options?.ignoreExpiry) {
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) return null;
    }

    return entry.data;
  } catch (err) {
    console.warn(`[CacheService] Erreur lecture ${namespace}/${key}:`, err);
    return null;
  }
}

/**
 * Récupère les métadonnées d'une entrée (timestamp, âge, expiration).
 */
async function getMeta(
  namespace: CacheNamespace,
  key: string,
): Promise<{ timestamp: number; age: number; isExpired: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(namespace, key));
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;

    return {
      timestamp: entry.timestamp,
      age,
      isExpired: age > entry.ttl,
    };
  } catch {
    return null;
  }
}

/**
 * Supprime une entrée du cache.
 */
async function remove(namespace: CacheNamespace, key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(buildKey(namespace, key));
  } catch (err) {
    console.warn(`[CacheService] Erreur suppression ${namespace}/${key}:`, err);
  }
}

/**
 * Invalide tout un namespace (ex: après sync d'un domaine).
 */
async function invalidateNamespace(namespace: CacheNamespace): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${CACHE_PREFIX}${namespace}/`;
    const namespacedKeys = allKeys.filter((k) => k.startsWith(prefix));
    if (namespacedKeys.length > 0) {
      await AsyncStorage.multiRemove(namespacedKeys);
    }
  } catch (err) {
    console.warn(`[CacheService] Erreur invalidation namespace ${namespace}:`, err);
  }
}

/**
 * Invalide tout le cache offline.
 */
async function invalidateAll(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (err) {
    console.warn('[CacheService] Erreur invalidation totale:', err);
  }
}

/**
 * Supprime toutes les entrées expirées (ou de version obsolète, ou corrompues).
 * À appeler au démarrage de l'app pour éviter l'accumulation infinie qui
 * peut hit la limite Hermes "Property storage exceeds 196607 properties".
 */
async function pruneExpired(): Promise<{ removed: number; total: number }> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length === 0) return { removed: 0, total: 0 };

    const now = Date.now();
    const toRemove: string[] = [];
    const entries = await AsyncStorage.multiGet(cacheKeys);
    for (const [key, raw] of entries) {
      if (!raw) {
        toRemove.push(key);
        continue;
      }
      try {
        const entry: CacheEntry = JSON.parse(raw);
        const age = now - (entry.timestamp ?? 0);
        const ttl = entry.ttl ?? 0;
        if (entry.version !== CURRENT_SCHEMA_VERSION || age > ttl) {
          toRemove.push(key);
        }
      } catch {
        // Entrée corrompue → on supprime.
        toRemove.push(key);
      }
    }

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
    return { removed: toRemove.length, total: cacheKeys.length };
  } catch (err) {
    console.warn('[CacheService] Erreur pruneExpired:', err);
    return { removed: 0, total: 0 };
  }
}

/**
 * Plafonne le nombre total d'entrées du cache à MAX_CACHE_ENTRIES.
 * Eviction LRU basée sur le timestamp d'écriture (les plus anciennes
 * dégagent en premier).
 */
async function enforceMaxEntries(): Promise<number> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length <= MAX_CACHE_ENTRIES) return 0;

    const entries = await AsyncStorage.multiGet(cacheKeys);
    const dated: { key: string; ts: number }[] = [];
    for (const [key, raw] of entries) {
      if (!raw) {
        dated.push({ key, ts: 0 });
        continue;
      }
      try {
        const entry: CacheEntry = JSON.parse(raw);
        dated.push({ key, ts: entry.timestamp ?? 0 });
      } catch {
        // Entrée corrompue → on l'évince en premier.
        dated.push({ key, ts: 0 });
      }
    }
    dated.sort((a, b) => a.ts - b.ts);
    const overflow = dated.length - MAX_CACHE_ENTRIES;
    const toRemove = dated.slice(0, overflow).map((d) => d.key);
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
      console.log(`[CacheService] 🧹 Cap appliqué : ${toRemove.length} entrées les plus anciennes évincées (cap=${MAX_CACHE_ENTRIES})`);
    }
    return toRemove.length;
  } catch (err) {
    console.warn('[CacheService] Erreur enforceMaxEntries:', err);
    return 0;
  }
}

/**
 * Retourne des stats sur le cache (debug / monitoring).
 */
async function getStats(): Promise<{
  totalEntries: number;
  byNamespace: Record<string, number>;
}> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));

    const byNamespace: Record<string, number> = {};
    for (const k of cacheKeys) {
      const ns = k.replace(CACHE_PREFIX, '').split('/')[0];
      byNamespace[ns] = (byNamespace[ns] || 0) + 1;
    }

    return { totalEntries: cacheKeys.length, byNamespace };
  } catch {
    return { totalEntries: 0, byNamespace: {} };
  }
}

// ---------------------------------------------------------------------------
// Export — objet unique (facilite le remplacement / mock en tests)
// ---------------------------------------------------------------------------

export const cacheService = {
  set,
  get,
  getMeta,
  remove,
  invalidateNamespace,
  invalidateAll,
  pruneExpired,
  enforceMaxEntries,
  getStats,
  buildKey,
  DEFAULT_TTL,
};
