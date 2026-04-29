import { useCallback, useEffect, useMemo, useState } from 'react';
import { promotionService } from '../../../services/promotionService';
import type { PromoListTab, PromoStatus, Promotion } from '../types';
import { computeStatus } from '../utils';

interface State {
  promotions: Promotion[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export interface Stats {
  active: number;
  scheduled: number;
  expired: number;
  cancelled: number;
  draft: number;
  total: number;
}

const TAB_TO_STATUSES: Record<PromoListTab, PromoStatus[]> = {
  active:    ['ACTIVE'],
  scheduled: ['SCHEDULED', 'DRAFT'],
  expired:   ['EXPIRED'],
  cancelled: ['CANCELLED'],
};

/**
 * Liste des promotions de l'épicerie + stats agrégées + filtrage par onglet.
 */
export function usePromotions() {
  const [state, setState] = useState<State>({
    promotions: [],
    loading: true,
    refreshing: false,
    error: null,
  });

  const [tab, setTab] = useState<PromoListTab>('active');
  const [search, setSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    setState(s => ({
      ...s,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));
    try {
      const list = await promotionService.getMyPromotions();
      setState({
        promotions: list,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (err) {
      setState({
        promotions: [],
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'load_error',
      });
    }
  }, []);

  useEffect(() => { load(false); }, [load]);
  const refetch = useCallback(() => load(true), [load]);

  const stats: Stats = useMemo(() => {
    const s: Stats = {
      active: 0, scheduled: 0, expired: 0, cancelled: 0, draft: 0,
      total: state.promotions.length,
    };
    for (const p of state.promotions) {
      switch (computeStatus(p)) {
        case 'ACTIVE':    s.active++; break;
        case 'SCHEDULED': s.scheduled++; break;
        case 'EXPIRED':   s.expired++; break;
        case 'CANCELLED': s.cancelled++; break;
        case 'DRAFT':     s.draft++; break;
      }
    }
    return s;
  }, [state.promotions]);

  const filtered = useMemo(() => {
    const allowed = TAB_TO_STATUSES[tab];
    const q = search.trim().toLowerCase();
    return state.promotions
      .filter(p => allowed.includes(computeStatus(p)))
      .filter(p => !q
        || p.titre.toLowerCase().includes(q)
        || (p.description || '').toLowerCase().includes(q))
      .sort((a, b) => {
        // Tri : ACTIVE par dateFin asc (plus urgent en haut), sinon par dateDebut desc
        const statusA = computeStatus(a);
        if (statusA === 'ACTIVE') {
          return new Date(a.dateFin).getTime() - new Date(b.dateFin).getTime();
        }
        return new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime();
      });
  }, [state.promotions, tab, search]);

  return {
    ...state,
    stats,
    filtered,
    tab,
    setTab,
    search,
    setSearch,
    refetch,
  };
}
