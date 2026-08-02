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
  | 'hasPrioritySupport'
  | 'hasBundleOffers'
  | 'hasMultiCaisse';

/** Quota types — null = illimité côté backend. */
export type QuotaType =
  | 'maxProducts'
  | 'maxCollaborators'
  | 'maxOrdersPerMonth'
  | 'maxClients'
  | 'maxLivreurs'
  | 'maxPromoCodes';

/**
 * DERNIER RECOURS uniquement. La source de vérité reste l'API :
 *   1. le plan renvoyé par /subscriptions/my-plan (sub.plan), sinon
 *   2. la vraie définition DECOUVERTE chargée depuis /subscriptions/plans
 *      (cache module-level {@link cachedDefaultPlan}), sinon
 *   3. ce fallback codé en dur — utilisé seulement si le réseau est coupé
 *      dès le tout premier lancement (aucun /plans jamais chargé). Le moins
 *      permissif → safe : jamais de feature payante débloquée à tort.
 * Les quotas ci-dessous ne sont donc qu'un garde-fou hors-ligne et peuvent
 * diverger du backend ; ne pas s'en servir comme référence produit.
 */
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
  hasBundleOffers: false,
  hasMultiCaisse: false,
  displayOrder: 1,
};

// ── Cache module-level ──────────────────────────────────────────────
let cachedSub: MySubscription | null = null;
let inflight: Promise<MySubscription | null> | null = null;
/**
 * Définition DECOUVERTE (plan gratuit) chargée depuis /subscriptions/plans.
 * Sert de fallback « source de vérité » quand l'épicier n'a pas encore de
 * sub chargé : quotas/flags réels du backend plutôt que le FALLBACK_PLAN codé
 * en dur. Null tant que /plans n'a jamais répondu.
 */
let cachedDefaultPlan: SubscriptionPlan | null = null;
let defaultPlanInflight: Promise<SubscriptionPlan | null> | null = null;
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

/**
 * Charge (une fois) la définition du plan gratuit DECOUVERTE depuis le
 * catalogue /plans, pour servir de fallback réel quand aucun sub n'est chargé.
 * Best-effort : en cas d'échec on garde le FALLBACK_PLAN codé en dur.
 */
async function loadDefaultPlan(): Promise<SubscriptionPlan | null> {
  if (cachedDefaultPlan) return cachedDefaultPlan;
  if (defaultPlanInflight) return defaultPlanInflight;
  defaultPlanInflight = subscriptionService.listPlans()
    .then(plans => {
      if (!plans || plans.length === 0) return null;
      // DECOUVERTE explicite, sinon le plan de plus petit displayOrder (le
      // moins permissif) — jamais une feature payante débloquée à tort.
      const found = plans.find(p => p.code === 'DECOUVERTE')
        ?? [...plans].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))[0];
      cachedDefaultPlan = found ?? null;
      return cachedDefaultPlan;
    })
    .catch(() => null)
    .finally(() => { defaultPlanInflight = null; });
  return defaultPlanInflight;
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

/**
 * Plan effectif, par ordre de confiance décroissant :
 *   sub.plan (API) → DECOUVERTE réel depuis /plans → fallback codé en dur.
 */
function effectivePlan(sub: MySubscription | null): SubscriptionPlan {
  return sub?.plan ?? cachedDefaultPlan ?? FALLBACK_PLAN;
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
  // Tick pour re-render quand le plan DECOUVERTE réel (/plans) arrive et
  // remplace le FALLBACK_PLAN codé en dur dans effectivePlan().
  const [, setDefaultPlanTick] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!cachedSub) {
      setLoading(true);
      loadSubscription().then(next => {
        if (!alive) return;
        setSub(next);
        setLoading(false);
      });
      // Fallback « source de vérité » : charge la vraie définition DECOUVERTE
      // pour ne pas dépendre des quotas/flags codés en dur pendant le chargement.
      loadDefaultPlan().then(p => {
        if (alive && p) setDefaultPlanTick(t => t + 1);
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
