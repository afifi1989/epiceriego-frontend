/**
 * useSubscription — Hook React qui expose l'abonnement courant de
 * l'épicier connecté et des helpers pour conditionner l'UI.
 *
 * <p>Le plan est mis en cache module-level pour que les composants
 * synchrones (filtre de menu, boutons cachés) puissent lire la feature
 * sans attendre un useEffect. Le cache est rempli au premier appel
 * du hook puis rafraîchi à la demande via {@link reload}.</p>
 *
 * <p>Tolérance erreur : si l'endpoint /subscriptions/my-plan échoue
 * (réseau coupé, 404), on considère que l'épicier est sur le plan
 * DECOUVERTE (le moins permissif) — l'UI reste fonctionnelle, juste
 * sans accès aux features payantes.</p>
 */

import { useCallback, useEffect, useState } from 'react';
import {
  subscriptionService,
  type MySubscription,
  type PaymentInstructions,
  type SubscriptionChangeRequest,
  type SubscriptionPlan,
} from '../services/subscriptionService';

/** Feature flags portés par {@link SubscriptionPlan}. */
export type SubscriptionFeature =
  | 'hasWhatsapp'
  | 'hasPromotions'
  | 'hasAdvancedStats'
  | 'hasSuppliers'
  | 'hasCsvImport'
  | 'hasLoyalty'
  | 'hasMultiEpicerie'
  | 'hasPrioritySupport';

/** Quota types — null = illimité côté backend. */
export type QuotaType =
  | 'maxProducts'
  | 'maxCollaborators'
  | 'maxOrdersPerMonth'
  | 'maxClients'
  | 'maxLivreurs'
  | 'maxPromoCodes';

/** Plan par défaut quand l'API échoue. Le moins permissif → safe. */
const FALLBACK_PLAN: SubscriptionPlan = {
  id: 0,
  code: 'DECOUVERTE',
  name: 'Découverte',
  monthlyPrice: 0,
  yearlyPrice: 0,
  maxProducts: 50,
  maxCollaborators: 0,
  maxOrdersPerMonth: 30,
  maxClients: 50,
  maxLivreurs: 0,
  maxPromoCodes: 0,
  hasWhatsapp: false,
  hasPromotions: false,
  hasAdvancedStats: false,
  hasSuppliers: false,
  hasCsvImport: false,
  hasLoyalty: false,
  hasMultiEpicerie: false,
  hasPrioritySupport: false,
  displayOrder: 1,
};

// ── Cache module-level ──────────────────────────────────────────────
let cachedSub: MySubscription | null = null;
let inflight: Promise<MySubscription | null> | null = null;
/** V99 : cache de la demande PENDING courante (null si aucune). */
let cachedPending: SubscriptionChangeRequest | null = null;
let pendingInflight: Promise<SubscriptionChangeRequest | null> | null = null;

/**
 * Lit le cache sans déclencher de fetch. Renvoie {@code null} si pas
 * encore chargé — utilisable depuis du code non-React (services axios,
 * helpers de format) pour des checks synchrones.
 */
export function getCachedSubscription(): MySubscription | null {
  return cachedSub;
}

/**
 * Force le rechargement (typiquement après un switchPlan réussi).
 * Invalide aussi le inflight pour qu'un appel concurrent n'écrase pas
 * la nouvelle valeur.
 */
export async function refreshSubscription(): Promise<MySubscription | null> {
  inflight = null;
  cachedSub = null;
  return loadSubscription();
}

async function loadSubscription(): Promise<MySubscription | null> {
  if (inflight) return inflight;
  inflight = subscriptionService.getMyPlan()
    .then(sub => {
      cachedSub = sub;
      return sub;
    })
    .catch(() => {
      // Garde le fallback : pas de cache écrit, ce qui force un re-essai
      // au prochain appel.
      return null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** V99 : load la demande PENDING courante (1 max). */
async function loadPendingRequest(): Promise<SubscriptionChangeRequest | null> {
  if (pendingInflight) return pendingInflight;
  pendingInflight = subscriptionService.getMyRequest()
    .then(req => {
      cachedPending = req;
      return req;
    })
    .catch(() => null)
    .finally(() => { pendingInflight = null; });
  return pendingInflight;
}

/** Force le rechargement du cache pendingRequest. */
export async function refreshPendingRequest(): Promise<SubscriptionChangeRequest | null> {
  pendingInflight = null;
  cachedPending = null;
  return loadPendingRequest();
}

/** Plan effectif : le plan du sub courant, ou le fallback. */
function effectivePlan(sub: MySubscription | null): SubscriptionPlan {
  return sub?.plan ?? FALLBACK_PLAN;
}

export interface UseSubscriptionResult {
  /** Abonnement courant — null pendant le chargement initial. */
  subscription: MySubscription | null;
  /** Plan effectif (jamais null — fallback DECOUVERTE si pas chargé). */
  plan: SubscriptionPlan;
  loading: boolean;
  /** True si l'epicier est sur trial PRO. */
  isTrial: boolean;
  /** Jours restants si trial, 0 sinon. */
  trialDaysLeft: number;
  /** Helper feature flag. */
  hasFeature: (feature: SubscriptionFeature) => boolean;
  /**
   * Helper quota : renvoie le max (null = illimité). Pour vérifier si
   * une action est possible, comparer avec l'usage courant.
   */
  getQuotaMax: (type: QuotaType) => number | null;
  /** Recharge depuis le backend (à appeler après un switch). */
  reload: () => Promise<void>;
  /** V99 : demande PENDING courante (null si aucune ou pas chargée). */
  pendingRequest: SubscriptionChangeRequest | null;
  /** V99 : recharge la pending depuis le backend. */
  reloadPending: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [sub, setSub] = useState<MySubscription | null>(cachedSub);
  const [loading, setLoading] = useState<boolean>(cachedSub == null);
  const [pending, setPending] = useState<SubscriptionChangeRequest | null>(cachedPending);

  useEffect(() => {
    let alive = true;
    if (!cachedSub) {
      setLoading(true);
      loadSubscription().then(next => {
        if (!alive) return;
        setSub(next);
        setLoading(false);
      });
    }
    // Charge la pending en parallèle (toujours, pour avoir l'état frais).
    loadPendingRequest().then(req => {
      if (alive) setPending(req);
    });
    return () => { alive = false; };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await refreshSubscription();
    setSub(next);
    setLoading(false);
  }, []);

  const reloadPending = useCallback(async () => {
    const next = await refreshPendingRequest();
    setPending(next);
  }, []);

  const plan = effectivePlan(sub);

  const hasFeature = useCallback(
    (f: SubscriptionFeature) => Boolean(plan[f]),
    [plan],
  );

  const getQuotaMax = useCallback(
    (q: QuotaType) => (plan[q] as number | null | undefined) ?? null,
    [plan],
  );

  return {
    subscription: sub,
    plan,
    loading,
    isTrial: sub?.status === 'TRIAL',
    trialDaysLeft: sub?.status === 'TRIAL' ? (sub?.daysRemaining ?? 0) : 0,
    hasFeature,
    getQuotaMax,
    reload,
    pendingRequest: pending,
    reloadPending,
  };
}
