import { useCallback, useEffect, useState } from 'react';
import { clientManagementService } from '../services/clientManagementService';

/**
 * Status of the current user's relationship with a given epicerie.
 *
 * Used to gate features that are reserved to registered clients of the store
 * (WhatsApp ordering, AI chatbot assistant). A user is considered a client only
 * when an ACCEPTED `ClientEpicerie` relationship exists server-side.
 *
 * Note: owners/collaborators bypass this hook entirely — they never reach the
 * client area of the app. The backend re-checks the rule authoritatively
 * (see `EpicerieAccessService`).
 */
export interface EpicerieClientStatus {
  /** True once the relationship has been resolved (success OR error). */
  ready: boolean;
  /** True iff the current user has an ACCEPTED relationship with this epicerie. */
  isClient: boolean;
  /** Error message if the lookup failed. Non-blocking — UI should fall back to `isClient === false`. */
  error: string | null;
  /** Force a refresh of the relationship (e.g. after accepting an invitation). */
  refresh: () => Promise<void>;
}

const ACCEPTED = 'ACCEPTED';

/**
 * Resolve whether `clientId` is a registered client of `epicerieId`.
 *
 * - Returns `{ready: false}` while loading.
 * - Returns `{isClient: false}` if either id is missing — the caller can use
 *   this to keep the gate closed until authentication finishes.
 * - Does NOT throw: errors are surfaced via `error` while `isClient` stays false,
 *   so a network glitch can't accidentally unlock the feature.
 */
export function useEpicerieClientStatus(
  clientId: number | null | undefined,
  epicerieId: number | null | undefined,
): EpicerieClientStatus {
  const [ready, setReady] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId || !epicerieId) {
      setReady(true);
      setIsClient(false);
      setError(null);
      return;
    }
    try {
      setReady(false);
      setError(null);
      const relations = await clientManagementService.getClientRelationships(clientId);
      const match = relations.find((r) => r.epicerieId === epicerieId);
      setIsClient(!!match && match.status === ACCEPTED);
    } catch (e: any) {
      // Fail closed: keep the gate shut on error, surface the message for debugging.
      setIsClient(false);
      setError(typeof e === 'string' ? e : e?.message || 'Erreur');
    } finally {
      setReady(true);
    }
  }, [clientId, epicerieId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ready, isClient, error, refresh: load };
}
