/**
 * OfflineService — Façade d'orchestration offline
 *
 * Point d'entrée unique pour les services métier :
 * - Initialise et coordonne network + cache + syncQueue
 * - Fournit des helpers haut-niveau (fetchWithCache, writeOrQueue)
 * - Gère le cycle de vie (start/stop/sync)
 *
 * Les services métier appellent offlineService au lieu d'interagir
 * directement avec cache/syncQueue/network.
 * → Facilite la migration future : chaque service peut être extrait
 *   en microservice avec son propre adaptateur offline.
 */

import { networkService, NetworkState } from './networkService';
import { cacheService, CacheNamespace } from './cacheService';
import { syncQueue, SyncDomain, SyncResult } from './syncQueue';
import api from '../api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchOptions<T> {
  /** Namespace de cache pour cette donnée */
  namespace: CacheNamespace;
  /** Clé unique dans le namespace */
  key: string;
  /** Fonction qui effectue l'appel API */
  fetcher: () => Promise<T>;
  /** TTL en ms (optionnel, utilise le défaut du namespace) */
  ttl?: number;
  /** Si true, force le refresh même si le cache est valide */
  forceRefresh?: boolean;
}

export interface WriteOptions {
  /** Domaine métier pour la sync queue */
  domain: SyncDomain;
  /** Méthode HTTP */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Endpoint API (relatif, ex: '/orders/direct-sale') */
  endpoint: string;
  /** Body de la requête */
  payload?: unknown;
  /** Headers additionnels */
  headers?: Record<string, string>;
  /** Namespaces de cache à invalider après sync */
  invalidateCache?: CacheNamespace[];
  /** Description lisible pour l'UI */
  description?: string;
  /** Données à retourner localement en mode offline (mise à jour optimiste) */
  optimisticData?: unknown;
}

export type OfflineEventType = 'sync:start' | 'sync:complete' | 'sync:error' | 'status:change';

export interface OfflineEvent {
  type: OfflineEventType;
  data?: unknown;
}

export type OfflineEventListener = (event: OfflineEvent) => void;

// ---------------------------------------------------------------------------
// État interne
// ---------------------------------------------------------------------------

let initialized = false;
let removeNetworkListener: (() => void) | null = null;
const eventListeners = new Set<OfflineEventListener>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitEvent(type: OfflineEventType, data?: unknown): void {
  const event: OfflineEvent = { type, data };
  eventListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (err) {
      console.warn('[OfflineService] Erreur event listener:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// Initialisation / Teardown
// ---------------------------------------------------------------------------

/**
 * Initialise tous les sous-systèmes offline.
 * À appeler une seule fois au démarrage de l'app (dans le root layout).
 */
async function initialize(): Promise<void> {
  if (initialized) return;

  console.log('[OfflineService] Initialisation...');

  // 1. Charger la queue persistée
  await syncQueue.load();

  // 2. Nettoyer le cache : entrées expirées + cap sur le nombre total.
  //    Garde-fou contre la limite Hermes "Property storage exceeds 196607
  //    properties" qui se déclenche quand AsyncStorage accumule trop
  //    d'entrées (params API variables, sessions longues, etc.).
  try {
    const pruneStats = await cacheService.pruneExpired();
    if (pruneStats.removed > 0) {
      console.log(`[OfflineService] 🧹 Cache: ${pruneStats.removed}/${pruneStats.total} entrées expirées supprimées`);
    }
    await cacheService.enforceMaxEntries();
  } catch (err) {
    // Si même le nettoyage doux échoue (cas extrême : limite Hermes déjà
    // atteinte au démarrage), on tente un wipe total du namespace cache
    // pour permettre à l'app de redémarrer sur une base saine. Les tokens
    // d'auth (hors namespace @offline_cache/) ne sont PAS touchés.
    console.warn('[OfflineService] Nettoyage cache doux échoué, fallback invalidateAll:', err);
    try {
      await cacheService.invalidateAll();
      console.log('[OfflineService] 🧹 Cache entièrement purgé (panic clear)');
    } catch (err2) {
      console.warn('[OfflineService] invalidateAll a aussi échoué:', err2);
    }
  }

  // 3. Démarrer la détection réseau
  networkService.start();

  // 4. Écouter les changements de connectivité
  removeNetworkListener = networkService.addListener(handleNetworkChange);

  initialized = true;
  console.log('[OfflineService] ✅ Initialisé. Pending sync:', syncQueue.getPendingCount());
}

/**
 * Arrête les sous-systèmes (nettoyage).
 */
function teardown(): void {
  if (removeNetworkListener) {
    removeNetworkListener();
    removeNetworkListener = null;
  }
  networkService.stop();
  initialized = false;
}

// ---------------------------------------------------------------------------
// Gestion du retour en ligne
// ---------------------------------------------------------------------------

async function handleNetworkChange(state: NetworkState): Promise<void> {
  emitEvent('status:change', state);

  if (state.status === 'online' && syncQueue.getPendingCount() > 0) {
    await syncPendingOperations();
  }
}

/**
 * Synchronise toutes les opérations en attente.
 */
async function syncPendingOperations(): Promise<SyncResult[]> {
  if (syncQueue.isSyncing()) return [];

  emitEvent('sync:start');
  console.log('[OfflineService] 🔄 Début synchronisation...');

  try {
    const results = await syncQueue.processAll();

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    emitEvent('sync:complete', { succeeded, failed, results });
    console.log(`[OfflineService] ✅ Sync terminée: ${succeeded} ok, ${failed} erreurs`);

    return results;
  } catch (err) {
    emitEvent('sync:error', err);
    console.error('[OfflineService] ❌ Erreur sync:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// API haut-niveau : Lecture avec cache
// ---------------------------------------------------------------------------

/**
 * Lecture intelligente : API si online → cache, sinon cache (même expiré).
 *
 * Usage dans un service métier :
 * ```ts
 * const products = await offlineService.fetchWithCache({
 *   namespace: 'products',
 *   key: `epicerie_${epicerieId}`,
 *   fetcher: () => api.get(`/products/epicerie/${epicerieId}`).then(r => r.data),
 * });
 * ```
 */
async function fetchWithCache<T>(options: FetchOptions<T>): Promise<T | null> {
  const { namespace, key, fetcher, ttl, forceRefresh } = options;

  // Si online et pas de forceRefresh → essayer le cache frais d'abord
  if (!forceRefresh && networkService.isOnline()) {
    const cached = await cacheService.get<T>(namespace, key);
    if (cached !== null) return cached;
  }

  // Si online → appel API
  if (networkService.isOnline()) {
    try {
      const data = await fetcher();
      // Stocker en cache
      await cacheService.set(namespace, key, data, { ttl });
      return data;
    } catch (err) {
      console.warn(`[OfflineService] Erreur API ${namespace}/${key}, fallback cache`);
      // Fallback cache (même expiré)
      return cacheService.get<T>(namespace, key, { ignoreExpiry: true });
    }
  }

  // Offline → cache (ignorer l'expiration)
  const cached = await cacheService.get<T>(namespace, key, { ignoreExpiry: true });
  if (cached !== null) return cached;

  console.warn(`[OfflineService] Offline et pas de cache pour ${namespace}/${key}`);
  return null;
}

// ---------------------------------------------------------------------------
// API haut-niveau : Écriture avec queue offline
// ---------------------------------------------------------------------------

/**
 * ⚠️ NON BRANCHÉ (dead code au 2026-07) — À NE PAS UTILISER TEL QUEL.
 * TODO(offline-writes): aucun service métier n'appelle `writeOrQueue`
 * aujourd'hui. L'infrastructure (syncQueue.enqueue, mise à jour optimiste) est
 * présente mais N'A PAS été validée sur les flux critiques. En particulier, ne
 * PAS l'utiliser pour le checkout / paiement : une mise en queue silencieuse
 * d'une commande en mode offline ferait croire à un succès sans garantie de
 * synchronisation (double vente, incohérence stock). Avant tout branchement,
 * définir explicitement quels domaines sont sûrs (idempotents, non financiers)
 * et tester la reprise réseau de bout en bout.
 *
 * Écriture intelligente : API si online, sinon queue pour sync ultérieure.
 *
 * Usage dans un service métier :
 * ```ts
 * const result = await offlineService.writeOrQueue({
 *   domain: 'orders',
 *   method: 'POST',
 *   endpoint: '/orders/direct-sale',
 *   payload: orderData,
 *   invalidateCache: ['orders'],
 *   description: 'Vente directe',
 *   optimisticData: { id: 'temp_123', ...orderData, status: 'DELIVERED' },
 * });
 * ```
 */
async function writeOrQueue<T = unknown>(
  options: WriteOptions,
): Promise<{ online: boolean; data: T | null; queueId?: string }> {
  const { domain, method, endpoint, payload, headers, invalidateCache, description, optimisticData } = options;

  // Si online → exécution directe
  if (networkService.isOnline()) {
    try {
      const response = await api.request({
        method,
        url: endpoint,
        data: payload,
        headers,
      });

      // Invalider les caches concernés
      if (invalidateCache) {
        for (const ns of invalidateCache) {
          await cacheService.invalidateNamespace(ns);
        }
      }

      return { online: true, data: response.data as T };
    } catch (err: any) {
      // Si erreur réseau (pas une erreur serveur) → fallback queue
      if (!err.response) {
        console.log(`[OfflineService] Erreur réseau sur ${method} ${endpoint}, mise en queue`);
        const queueId = await syncQueue.enqueue({
          domain,
          method,
          endpoint,
          payload,
          headers,
          invalidateCache,
          description,
        });

        return { online: false, data: (optimisticData as T) ?? null, queueId };
      }
      // Erreur serveur → propager
      throw err;
    }
  }

  // Offline → enqueue
  const queueId = await syncQueue.enqueue({
    domain,
    method,
    endpoint,
    payload,
    headers,
    invalidateCache,
    description,
  });

  return { online: false, data: (optimisticData as T) ?? null, queueId };
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

function addEventListener(listener: OfflineEventListener): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Accesseurs utilitaires
// ---------------------------------------------------------------------------

function isOnline(): boolean {
  return networkService.isOnline();
}

function getPendingSyncCount(): number {
  return syncQueue.getPendingCount();
}

function isSyncing(): boolean {
  return syncQueue.isSyncing();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const offlineService = {
  // Lifecycle
  initialize,
  teardown,

  // Lecture / Écriture
  fetchWithCache,
  writeOrQueue,

  // Sync manuelle
  syncPendingOperations,

  // État
  isOnline,
  getPendingSyncCount,
  isSyncing,

  // Événements
  addEventListener,

  // Accès sous-modules (pour cas avancés)
  cache: cacheService,
  network: networkService,
  queue: syncQueue,
};
