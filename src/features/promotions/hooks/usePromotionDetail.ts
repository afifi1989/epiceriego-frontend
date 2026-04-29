import { useCallback, useEffect, useState } from 'react';
import { promotionService } from '../../../services/promotionService';
import type { Promotion, PromotionImpact } from '../types';

interface State {
  promotion: Promotion | null;
  impact: PromotionImpact | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

/**
 * Détails d'une promotion + son impact actuel (unités impactées, économies).
 */
export function usePromotionDetail(id: number | null) {
  const [state, setState] = useState<State>({
    promotion: null,
    impact: null,
    loading: true,
    refreshing: false,
    error: null,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    setState(s => ({ ...s, loading: !isRefresh, refreshing: isRefresh, error: null }));
    try {
      const [promo, impact] = await Promise.all([
        promotionService.getPromotionById(id),
        // Impact peut échouer si pas d'apply — on ignore l'erreur
        promotionService.getPromotionImpact(id).catch(() => null),
      ]);
      setState({
        promotion: promo,
        impact,
        loading: false,
        refreshing: false,
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
  }, [id]);

  useEffect(() => { load(false); }, [load]);
  const refetch = useCallback(() => load(true), [load]);

  return { ...state, refetch };
}
