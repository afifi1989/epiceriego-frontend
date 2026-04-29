/**
 * useOfflineData — Hook générique de lecture avec cache offline
 *
 * Encapsule le pattern "fetch si online, sinon cache" pour n'importe
 * quelle donnée. Utilisable par tous les écrans épicier.
 *
 * Usage :
 * ```ts
 * const { data, loading, isStale, lastSync, refresh } = useOfflineData({
 *   namespace: 'products',
 *   key: `epicerie_${epicerieId}`,
 *   fetcher: () => productService.getProductsByEpicerie(epicerieId),
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineService, CacheNamespace } from '../services/offline';
import { cacheService } from '../services/offline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseOfflineDataOptions<T> {
  /** Namespace de cache */
  namespace: CacheNamespace;
  /** Clé unique dans le namespace */
  key: string;
  /** Fonction d'appel API (exécutée seulement si online) */
  fetcher: () => Promise<T>;
  /** TTL personnalisé en ms (optionnel) */
  ttl?: number;
  /** Désactiver le chargement automatique */
  enabled?: boolean;
}

export interface UseOfflineDataResult<T> {
  /** Les données (API fraîches ou cache) */
  data: T | null;
  /** Chargement en cours */
  loading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Les données viennent du cache (potentiellement périmé) */
  isStale: boolean;
  /** Timestamp de la dernière mise à jour du cache */
  lastSync: Date | null;
  /** Forcer un refresh (même si le cache est valide) */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineData<T>(options: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const { namespace, key, fetcher, ttl, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Ref pour éviter les fetches concurrents
  const fetchingRef = useRef(false);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const result = await offlineService.fetchWithCache<T>({
          namespace,
          key,
          fetcher,
          ttl,
          forceRefresh,
        });

        setData(result);

        // Vérifier si le cache est périmé
        const meta = await cacheService.getMeta(namespace, key);
        if (meta) {
          setIsStale(meta.isExpired);
          setLastSync(new Date(meta.timestamp));
        } else {
          setIsStale(false);
          setLastSync(null);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [namespace, key, fetcher, ttl],
  );

  useEffect(() => {
    if (enabled) {
      load();
    }
  }, [enabled, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, error, isStale, lastSync, refresh };
}
