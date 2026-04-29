/**
 * useCarnet — Hook pour charger et gérer le carnet digital d'un client.
 *
 * Utilise offlineService.fetchWithCache pour le support offline.
 * Gère la pagination, le refresh, et les actions (encaisser, avance, crédit).
 */

import { useState, useCallback, useEffect } from 'react';
import api from '../../../services/api';
import { offlineService } from '../../../services/offline';
import { CarnetResponse } from '../types';

const PAGE_SIZE = 20;

interface UseCarnetOptions {
  epicerieId: number;
  clientId: number;
  enabled?: boolean;
}

interface UseCarnetResult {
  carnet: CarnetResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Données viennent du cache (potentiellement périmé) */
  isStale: boolean;
  /** Charger la page suivante de transactions */
  loadMore: () => Promise<void>;
  hasMore: boolean;
  /** Forcer un refresh complet */
  refresh: () => Promise<void>;
}

export function useCarnet({ epicerieId, clientId, enabled = true }: UseCarnetOptions): UseCarnetResult {
  const [carnet, setCarnet] = useState<CarnetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchCarnet = useCallback(async (pageNum: number, isRefresh: boolean) => {
    if (!epicerieId || !clientId) return;

    if (isRefresh) setRefreshing(true);
    else if (pageNum === 0) setLoading(true);
    setError(null);

    try {
      const cacheKey = `carnet_${epicerieId}_${clientId}_p${pageNum}`;
      const fetcher = async () => {
        const resp = await api.get<CarnetResponse>(
          `/epiceries/${epicerieId}/clients/${clientId}/carnet`,
          { params: { page: pageNum, size: PAGE_SIZE } }
        );
        return resp.data;
      };

      const data = await offlineService.fetchWithCache<CarnetResponse>({
        namespace: 'clients',
        key: cacheKey,
        fetcher,
        forceRefresh: isRefresh,
      });

      if (!data) {
        if (pageNum === 0) setError('Aucune donnée disponible');
        return;
      }

      if (pageNum === 0) {
        setCarnet(data);
      } else {
        // Append transactions pour pagination
        setCarnet(prev => prev ? {
          ...data,
          transactions: [...prev.transactions, ...data.transactions],
        } : data);
      }

      setHasMore(data.page < data.totalPages - 1);
      setPage(pageNum);

      // Vérifier si les données sont du cache
      const meta = await offlineService.cache.getMeta('clients', cacheKey);
      setIsStale(meta?.isExpired ?? false);
    } catch (err: any) {
      if (offlineService.isOnline()) {
        setError(err.message || 'Erreur de chargement');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [epicerieId, clientId]);

  useEffect(() => {
    if (enabled) fetchCarnet(0, false);
  }, [enabled, fetchCarnet]);

  const refresh = useCallback(async () => {
    await fetchCarnet(0, true);
  }, [fetchCarnet]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing) return;
    await fetchCarnet(page + 1, false);
  }, [hasMore, loading, refreshing, page, fetchCarnet]);

  return { carnet, loading, refreshing, error, isStale, loadMore, hasMore, refresh };
}
