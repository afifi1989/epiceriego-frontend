import { useCallback, useState } from 'react';
import { promotionService } from '../../../services/promotionService';

type ActionKind = 'apply' | 'rollback' | 'delete';

interface ActionState {
  loading: ActionKind | null;
  error: string | null;
}

/**
 * Mutations cycle de vie d'une promotion : apply, rollback, delete.
 * Chaque méthode retourne un résultat typé. Les erreurs sont capturées et
 * exposées via `error` — au composant de les présenter (toast/modal).
 */
export function usePromotionActions() {
  const [state, setState] = useState<ActionState>({ loading: null, error: null });

  const apply = useCallback(async (id: number) => {
    setState({ loading: 'apply', error: null });
    try {
      const res = await promotionService.applyPromotion(id);
      setState({ loading: null, error: null });
      return res;
    } catch (err: any) {
      setState({ loading: null, error: err?.message ?? 'apply_failed' });
      return null;
    }
  }, []);

  const rollback = useCallback(async (id: number) => {
    setState({ loading: 'rollback', error: null });
    try {
      const res = await promotionService.rollbackPromotion(id);
      setState({ loading: null, error: null });
      return res;
    } catch (err: any) {
      setState({ loading: null, error: err?.message ?? 'rollback_failed' });
      return null;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setState({ loading: 'delete', error: null });
    try {
      await promotionService.deletePromotion(id);
      setState({ loading: null, error: null });
      return true;
    } catch (err: any) {
      setState({ loading: null, error: err?.message ?? 'delete_failed' });
      return false;
    }
  }, []);

  return { ...state, apply, rollback, remove };
}
