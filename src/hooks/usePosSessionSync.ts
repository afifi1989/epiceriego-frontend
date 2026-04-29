/**
 * Hook de synchronisation des sessions POS avec le backend (Axe POS / S1).
 *
 * Approche "layer additive" : n'interfère PAS avec la logique existante de
 * `vente-directe.tsx`. L'écran continue de fonctionner entièrement en mémoire.
 * Le hook ajoute simplement :
 *   - hydratation des sessions ouvertes à l'init
 *   - synchronisation serveur debouncée à chaque changement de panier
 *   - marquage CHECKED_OUT après succès du checkout
 *
 * En cas d'erreur réseau, la sync échoue silencieusement — le panier reste
 * utilisable en local (la vente directe elle-même retombe sur la file offline
 * existante de `offlineService` si besoin).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PosSessionRequest,
  PosSessionResponse,
  posSessionService
} from '../services/posSessionService';

export interface SyncableSession {
  /** UUID client stable — généré au moment de createSession(). */
  clientUuid: string;
  /** ID serveur (null tant que pas encore synchronisé). */
  serverId?: number | null;
  /** ID client (unique interne au composant, conserve rétrocompat). */
  id: string;
  cart: unknown[];
  client?: { id?: number } | null;
  notes?: string | null;
  paymentMethod?: string;
}

interface UsePosSessionSyncOptions {
  /** Cadence max de sync (ms) — évite le spam serveur pendant la saisie. */
  debounceMs?: number;
  /** ID du device pour que chaque caisse ne voie que ses sessions. */
  deviceId?: string;
  /** Calcule le total affiché — fourni par le composant (source de vérité). */
  computeTotal?: (session: SyncableSession) => number;
  /** Calcule le nombre d'articles. */
  computeItemCount?: (session: SyncableSession) => number;
}

export function usePosSessionSync(options: UsePosSessionSyncOptions = {}) {
  const { debounceMs = 800, deviceId, computeTotal, computeItemCount } = options;

  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());

  // ── Hydratation initiale ────────────────────────────────────────────
  const hydrate = useCallback(async (): Promise<PosSessionResponse[]> => {
    try {
      const sessions = await posSessionService.listOpen(deviceId);
      setLastSyncError(null);
      setLastSyncAt(new Date());
      return sessions;
    } catch (e: any) {
      setLastSyncError(e?.message ?? 'Impossible de récupérer les sessions');
      return [];
    }
  }, [deviceId]);

  // ── Sync immédiate d'une session (offline-first via upsert) ──────────
  const syncNow = useCallback(async (session: SyncableSession):
      Promise<PosSessionResponse | null> => {
    if (!session.clientUuid) return null;
    if (inFlightRef.current.has(session.clientUuid)) return null;

    inFlightRef.current.add(session.clientUuid);
    try {
      const payload: PosSessionRequest = {
        clientUuid: session.clientUuid,
        clientId:   session.client?.id ?? null,
        notes:      session.notes ?? null,
        deviceId:   deviceId ?? null,
        cartJson:   JSON.stringify(session.cart ?? []),
        totalAmount: computeTotal ? computeTotal(session) : null,
        itemCount:   computeItemCount ? computeItemCount(session) : (session.cart?.length ?? 0)
      };
      // Upsert offline-first : POST /pos-sessions (backend dé-doublonne par clientUuid)
      const result = await posSessionService.upsert(payload);
      setLastSyncError(null);
      setLastSyncAt(new Date());
      return result.data; // null si queuée offline — pas une erreur
    } catch (e: any) {
      setLastSyncError(e?.message ?? 'Sync échouée');
      return null;
    } finally {
      inFlightRef.current.delete(session.clientUuid);
    }
  }, [deviceId, computeTotal, computeItemCount]);

  // ── Sync debouncée ──────────────────────────────────────────────────
  const scheduleSync = useCallback((
    session: SyncableSession,
    onSynced?: (response: PosSessionResponse) => void
  ) => {
    if (!session.clientUuid) return;
    const existing = timersRef.current.get(session.clientUuid);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      timersRef.current.delete(session.clientUuid);
      const response = await syncNow(session);
      if (response && onSynced) onSynced(response);
    }, debounceMs);

    timersRef.current.set(session.clientUuid, timer);
  }, [debounceMs, syncNow]);

  const markCheckedOut = useCallback(async (
    serverId: number | null | undefined,
    orderId: number
  ): Promise<void> => {
    if (!serverId) return;
    try {
      await posSessionService.markCheckedOut(serverId, orderId);
      // Silent même en offline : la queue rejouera plus tard
    } catch {
      // silencieux — non-bloquant pour la vente
    }
  }, []);

  const abandonSession = useCallback(async (
    serverId: number | null | undefined
  ): Promise<void> => {
    if (!serverId) return;
    try {
      await posSessionService.abandon(serverId);
    } catch {
      // silencieux
    }
  }, []);

  // Cleanup timers au démontage
  useEffect(() => () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return {
    hydrate,
    scheduleSync,
    syncNow,
    markCheckedOut,
    abandonSession,
    lastSyncError,
    lastSyncAt
  };
}
