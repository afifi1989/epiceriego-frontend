/**
 * planLabels — Source unique pour l'affichage des plans d'abonnement.
 *
 * <p>Centralise ce qui était dupliqué (ou en passe de l'être) dans
 * {@code api.ts}, {@code mon-abonnement.tsx} et {@code StepPlan.tsx} :</p>
 * <ul>
 *   <li>{@link planHumanName} — libellé humain d'un code plan (mirror backend
 *       FeaturePlanMappingService.humanPlanName).</li>
 *   <li>{@link planAccent} — couleur d'accent + fond doux par plan.</li>
 *   <li>{@link PLAN_FEATURE_ROWS} — liste ordonnée des features booléennes du
 *       plan, pour itérer plutôt que recopier un tableau codé en dur.</li>
 * </ul>
 */

import type { SubscriptionPlan } from '../services/subscriptionService';

/** Libellé humain des codes plan (mirror FeaturePlanMappingService.humanPlanName). */
export function planHumanName(planCode: string): string {
  switch (planCode) {
    case 'DECOUVERTE': return 'Découverte';
    case 'ESSENTIEL':  return 'Essentiel';
    case 'PRO':        return 'Pro';
    case 'PREMIUM':    return 'Premium';
    default:           return planCode;
  }
}

export interface PlanAccent {
  /** Couleur d'accent (titre, bordure sélectionnée). */
  tint: string;
  /** Fond doux assorti (badges, cartes). */
  soft: string;
}

/** Accent couleur par plan. Défaut (Découverte / inconnu) : slate-500. */
export function planAccent(code: string): PlanAccent {
  switch (code) {
    case 'PRO':       return { tint: '#7C3AED', soft: '#F3E8FF' }; // violet (recommandé)
    case 'PREMIUM':   return { tint: '#F59E0B', soft: '#FEF3C7' }; // gold
    case 'ESSENTIEL': return { tint: '#0EA5E9', soft: '#E0F2FE' }; // cyan
    default:          return { tint: '#64748B', soft: '#F1F5F9' }; // découverte / autre
  }
}

/** Clés des features booléennes portées par {@link SubscriptionPlan}. */
export type PlanFeatureKey =
  | 'hasWhatsapp'
  | 'hasPromotions'
  | 'hasAdvancedStats'
  | 'hasSuppliers'
  | 'hasCsvImport'
  | 'hasLoyalty'
  | 'hasMultiEpicerie'
  | 'hasPrioritySupport'
  | 'hasBundleOffers';

export interface PlanFeatureRow {
  key: PlanFeatureKey;
  /** Libellé FR affiché dans le comparatif (UI épicier = FR). */
  label: string;
}

/**
 * Liste ordonnée des features du plan pour le comparatif. Itérer sur cette
 * liste évite les tableaux codés en dur divergents entre écrans (et garantit
 * qu'ajouter une feature — ex: Fournisseurs — la fait apparaître partout).
 */
export const PLAN_FEATURE_ROWS: PlanFeatureRow[] = [
  { key: 'hasWhatsapp',        label: 'WhatsApp Business' },
  { key: 'hasPromotions',      label: 'Codes promo' },
  { key: 'hasAdvancedStats',   label: 'Statistiques avancées' },
  { key: 'hasSuppliers',       label: 'Fournisseurs' },
  { key: 'hasBundleOffers',    label: 'Offres & paniers groupés' },
  { key: 'hasCsvImport',       label: 'Import CSV' },
  { key: 'hasLoyalty',         label: 'Carte fidélité' },
  { key: 'hasMultiEpicerie',   label: 'Multi-épicerie' },
  { key: 'hasPrioritySupport', label: 'Support prioritaire' },
];

/** Booléen d'une feature sur un plan (helper typé pour l'itération). */
export function planHasFeature(plan: SubscriptionPlan, key: PlanFeatureKey): boolean {
  return Boolean(plan[key]);
}
