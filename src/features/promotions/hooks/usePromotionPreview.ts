import { useCallback, useState } from 'react';
import { promotionService } from '../../../services/promotionService';
import type { CreatePromotionRequest, PromotionPreview } from '../types';

/**
 * Mutation "simulation" d'une promo avant création — utilisé par le wizard.
 */
export function usePromotionPreview() {
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (spec: CreatePromotionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await promotionService.previewPromotionSpec(spec);
      setPreview(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'preview_failed';
      setError(msg);
      setPreview(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return { preview, loading, error, run, clear };
}
