import { useCallback, useEffect, useState } from 'react';
import { loyaltyService } from '../../../services/loyaltyService';
import type { LoyaltyBalance } from '../types';

interface State {
  balances: LoyaltyBalance[];
  totalPoints: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

/**
 * Agrège tous les soldes de fidélité du client et enrichit chaque entrée
 * avec le nom de l'épicerie + programme (via appels parallèles `getMyBalanceAtStore`).
 *
 * Expose un `refetch()` pour pull-to-refresh.
 */
export function useLoyaltyBalances() {
  const [state, setState] = useState<State>({
    balances: [],
    totalPoints: 0,
    loading: true,
    refreshing: false,
    error: null,
  });

  const load = useCallback(async (isRefresh = false) => {
    setState(s => ({
      ...s,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const map = await loyaltyService.getMyBalances();
      const entries = Object.entries(map).filter(([, v]) => (v ?? 0) > 0);

      if (entries.length === 0) {
        setState({
          balances: [],
          totalPoints: 0,
          loading: false,
          refreshing: false,
          error: null,
        });
        return;
      }

      const enriched = await Promise.all(
        entries.map(async ([idStr, points]) => {
          const epicerieId = Number(idStr);
          try {
            const full = await loyaltyService.getMyBalanceAtStore(epicerieId);
            return { ...full, epicerieId, balance: points };
          } catch {
            return {
              epicerieId,
              balance: points,
              isActive: true,
            } as LoyaltyBalance;
          }
        })
      );

      const activeOnly = enriched.filter(b => b.isActive !== false);
      const sorted = activeOnly.sort((a, b) => b.balance - a.balance);
      const total = sorted.reduce((sum, b) => sum + b.balance, 0);

      setState({
        balances: sorted,
        totalPoints: total,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (err) {
      setState({
        balances: [],
        totalPoints: 0,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'load_error',
      });
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  return {
    ...state,
    refetch,
  };
}
