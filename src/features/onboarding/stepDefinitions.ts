/**
 * Définition centralisée de l'ordre et des métadonnées des étapes
 * d'onboarding mobile.
 *
 * <p>Une seule source de vérité pour le wizard : le moindre changement
 * d'ordre, d'icône ou de label se fait ici. Les composants du wizard
 * ne décident rien — ils consomment cette liste.</p>
 *
 * <p>Ordre validé avec l'utilisateur :
 * Type → Location → Photos → Description → Hours → Delivery →
 * WhatsApp → Catalogue → Clients.</p>
 */

import type { OnboardingStepKey } from './types';

/**
 * Étapes "structurelles" (TYPE, CATALOGUE, CLIENTS, PLAN) — chacune a un
 * endpoint dédié backend, distinct du couple générique
 * complete/skip. On les modélise avec un kind différent pour que
 * le wizard branche le bon handler.
 *
 * <p>PLAN est un cas particulier : l'abonnement (trial PRO 14j) est créé
 * automatiquement au signup côté backend, et cette étape ne fait que
 * permettre à l'épicier de confirmer ou changer son plan. Elle n'a pas
 * de flag dans OnboardingStatus — submit() retourne juste true (ou
 * appelle /subscriptions/switch si l'épicier a changé sa sélection).</p>
 */
export type StructuralStepKind = 'TYPE' | 'CATALOGUE' | 'CLIENTS' | 'PLAN' | 'FINALISER_STOCK';

/** Identifiant unique d'une étape dans le wizard. */
export type WizardStepId = StructuralStepKind | OnboardingStepKey;

export interface WizardStepMeta {
  id: WizardStepId;
  /** Type pour brancher le handler (générique vs historique). */
  kind: 'STRUCTURAL' | 'CONFIGURABLE';
  /** Clé enum backend pour les steps configurables (sinon undefined). */
  apiKey?: OnboardingStepKey;
  /** Étape obligatoire — pas de bouton "Ignorer". */
  required: boolean;
  /** Titre de l'étape dans le header du wizard. */
  title: string;
  /** Petit emoji/icône pour le stepper et le header. */
  icon: string;
  /** Sous-titre / phrase d'accroche affichée sous le titre. */
  subtitle: string;
  /**
   * Temps moyen pour remplir cette étape, en secondes. Sert à afficher
   * "~30 s" sous le titre pour rassurer l'utilisateur sur l'effort.
   * Valeurs empiriques basées sur les retours utilisateurs.
   */
  estimatedSeconds: number;
}

export const WIZARD_STEPS: WizardStepMeta[] = [
  {
    id: 'TYPE',
    kind: 'STRUCTURAL',
    required: true,
    title: 'Type de boutique',
    icon: '🏪',
    subtitle: 'Choisissez la catégorie qui correspond à votre épicerie',
    estimatedSeconds: 30,
  },
  {
    id: 'LOCATION',
    kind: 'CONFIGURABLE',
    apiKey: 'LOCATION',
    required: false,
    title: 'Localisation',
    icon: '📍',
    subtitle: 'Position GPS pour la livraison et la recherche par proximité',
    estimatedSeconds: 45,
  },
  {
    id: 'PHOTOS',
    kind: 'CONFIGURABLE',
    apiKey: 'PHOTOS',
    required: false,
    title: 'Photos',
    icon: '📸',
    subtitle: 'Logo et bannière — la première impression de vos clients',
    estimatedSeconds: 90,
  },
  {
    id: 'DESCRIPTION',
    kind: 'CONFIGURABLE',
    apiKey: 'DESCRIPTION',
    required: false,
    title: 'Description & contact',
    icon: '✍️',
    subtitle: 'Présentez votre épicerie et vos coordonnées professionnelles',
    estimatedSeconds: 60,
  },
  {
    id: 'HOURS',
    kind: 'CONFIGURABLE',
    apiKey: 'HOURS',
    required: false,
    title: 'Horaires',
    icon: '🕐',
    subtitle: 'Quand vos clients peuvent commander chez vous',
    estimatedSeconds: 60,
  },
  {
    id: 'DELIVERY',
    kind: 'CONFIGURABLE',
    apiKey: 'DELIVERY',
    required: false,
    title: 'Zones de livraison',
    icon: '🚚',
    subtitle: 'Où vous livrez — rayon GPS ou liste de quartiers',
    estimatedSeconds: 90,
  },
  // NOTE : Le step WHATSAPP a ete retire du wizard car cette fonctionnalite
  // est liee a l'abonnement (incluse a partir de ESSENTIEL). L'epicier peut
  // l'activer plus tard via Paramètres -> WhatsApp Business si son plan le
  // permet. Le composant StepWhatsapp.tsx reste utilise par parametres
  // (re-edition d'une section).
  {
    id: 'PLAN',
    kind: 'STRUCTURAL',
    required: false,
    title: 'Votre offre',
    icon: '⭐',
    subtitle: 'Vous démarrez avec 14 jours d\'essai PRO offerts — choisissez votre plan',
    estimatedSeconds: 30,
  },
  {
    id: 'CATALOGUE',
    kind: 'STRUCTURAL',
    required: true,
    title: 'Catalogue produits',
    icon: '📦',
    subtitle: 'Importez un catalogue pré-rempli adapté à votre type',
    estimatedSeconds: 30,
  },
  {
    id: 'FINALISER_STOCK',
    kind: 'STRUCTURAL',
    required: false,
    title: 'Stock de départ',
    icon: '📥',
    subtitle: 'Réglez le stock des produits importés — vous activerez la vente plus tard',
    estimatedSeconds: 120,
  },
  {
    id: 'CLIENTS',
    kind: 'STRUCTURAL',
    required: false,
    title: 'Premiers clients',
    icon: '👥',
    subtitle: 'Invitez vos clients réguliers — ou faites-le plus tard',
    estimatedSeconds: 60,
  },
];

/**
 * Helper format "~X s" / "~X min" — utilisé par le header de chaque étape.
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) return `~${seconds} s`;
  const min = Math.round(seconds / 60);
  return `~${min} min`;
}

/** Lookup helper, lève si la step n'est pas dans la liste. */
export function getStepMeta(id: WizardStepId): WizardStepMeta {
  const meta = WIZARD_STEPS.find(s => s.id === id);
  if (!meta) throw new Error(`Step ${id} non définie dans WIZARD_STEPS`);
  return meta;
}
