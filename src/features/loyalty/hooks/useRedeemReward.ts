import { useCallback, useState } from 'react';
import { loyaltyService } from '../../../services/loyaltyService';

interface RedeemResult {
  success: boolean;
  discount?: number;
  error?: string;
}

/**
 * Mutation d'échange d'une récompense. Le composant gère sa propre UI (modal de
 * confirmation, toast) — ce hook ne fait qu'appeler l'API et exposer l'état.
 */
export function useRedeemReward() {
  const [redeeming, setRedeeming] = useState(false);

  const redeem = useCallback(async (
    epicerieId: number,
    rewardId: number,
    orderId?: number,
  ): Promise<RedeemResult> => {
    setRedeeming(true);
    try {
      const res = await loyaltyService.redeemReward(epicerieId, rewardId, orderId);
      setRedeeming(false);
      return { success: !!res.success, discount: res.discount };
    } catch (err: any) {
      setRedeeming(false);
      const message = err?.response?.data?.message
        ?? err?.message
        ?? 'redeem_failed';
      return { success: false, error: message };
    }
  }, []);

  return { redeem, redeeming };
}
