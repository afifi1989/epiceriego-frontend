import { useCallback, useEffect, useState } from 'react';
import { loyaltyService } from '../../../services/loyaltyService';
import type { LoyaltyBalance, LoyaltyReward, LoyaltyTransaction } from '../types';

interface State {
  balance: LoyaltyBalance | null;
  rewards: LoyaltyReward[];
  transactions: LoyaltyTransaction[];
  hasMoreTx: boolean;
  txPage: number;
  loading: boolean;
  refreshing: boolean;
  loadingMoreTx: boolean;
  error: string | null;
}

const INITIAL: State = {
  balance: null,
  rewards: [],
  transactions: [],
  hasMoreTx: false,
  txPage: 0,
  loading: true,
  refreshing: false,
  loadingMoreTx: false,
  error: null,
};

/**
 * Hook unifié pour une épicerie : solde + récompenses + première page des transactions.
 * Expose un loadMoreTx pour pagination et un refetch pour pull-to-refresh.
 */
export function useLoyaltyStore(epicerieId: number | null) {
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(async (isRefresh = false) => {
    if (!epicerieId || Number.isNaN(epicerieId)) return;

    setState(s => ({
      ...s,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const [balance, rewards, txPage] = await Promise.all([
        loyaltyService.getMyBalanceAtStore(epicerieId),
        loyaltyService.getMyRewardsAtStore(epicerieId),
        loyaltyService.getMyTransactionsAtStore(epicerieId, 0),
      ]);

      setState({
        balance,
        rewards,
        transactions: txPage.content ?? [],
        hasMoreTx: !(txPage.last ?? true),
        txPage: 0,
        loading: false,
        refreshing: false,
        loadingMoreTx: false,
        error: null,
      });
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'load_error',
      }));
    }
  }, [epicerieId]);

  useEffect(() => {
    load(false);
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  const loadMoreTx = useCallback(async () => {
    if (!epicerieId || state.loadingMoreTx || !state.hasMoreTx) return;
    setState(s => ({ ...s, loadingMoreTx: true }));
    try {
      const nextPage = state.txPage + 1;
      const res = await loyaltyService.getMyTransactionsAtStore(epicerieId, nextPage);
      setState(s => ({
        ...s,
        transactions: [...s.transactions, ...(res.content ?? [])],
        hasMoreTx: !(res.last ?? true),
        txPage: nextPage,
        loadingMoreTx: false,
      }));
    } catch {
      setState(s => ({ ...s, loadingMoreTx: false }));
    }
  }, [epicerieId, state.loadingMoreTx, state.hasMoreTx, state.txPage]);

  return {
    ...state,
    refetch,
    loadMoreTx,
  };
}
