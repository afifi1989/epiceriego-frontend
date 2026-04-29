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
 * Étapes "structurelles" (TYPE, CATALOGUE, CLIENTS) — chacune a un
 * endpoint dédié backend, distinct du couple générique
 * complete/skip. On les modélise avec un kind différent pour que
 * le wizard branche le bon handler.
 */
export type StructuralStepKind = 'TYPE' | 'CATALOGUE' | 'CLIENTS';

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
}

export const WIZARD_STEPS: WizardStepMeta[] = [
  {
    id: 'TYPE',
    kind: 'STRUCTURAL',
    required: true,
    title: 'Type de boutique',
    icon: '🏪',
    subtitle: 'Choisissez la catégorie qui correspond à votre épicerie',
  },
  {
    id: 'LOCATION',
    kind: 'CONFIGURABLE',
    apiKey: 'LOCATION',
    required: false,
    title: 'Localisation',
    icon: '📍',
    subtitle: 'Position GPS pour la livraison et la recherche par proximité',
  },
  {
    id: 'PHOTOS',
    kind: 'CONFIGURABLE',
    apiKey: 'PHOTOS',
    required: false,
    title: 'Photos',
    icon: '📸',
    subtitle: 'Logo et bannière — la première impression de vos clients',
  },
  {
    id: 'DESCRIPTION',
    kind: 'CONFIGURABLE',
    apiKey: 'DESCRIPTION',
    required: false,
    title: 'Description & contact',
    icon: '✍️',
    subtitle: 'Présentez votre épicerie et vos coordonnées professionnelles',
  },
  {
    id: 'HOURS',
    kind: 'CONFIGURABLE',
    apiKey: 'HOURS',
    required: false,
    title: 'Horaires',
    icon: '🕐',
    subtitle: 'Quand vos clients peuvent commander chez vous',
  },
  {
    id: 'DELIVERY',
    kind: 'CONFIGURABLE',
    apiKey: 'DELIVERY',
    required: false,
    title: 'Zones de livraison',
    icon: '🚚',
    subtitle: 'Où vous livrez — rayon GPS ou liste de quartiers',
  },
  {
    id: 'WHATSAPP',
    kind: 'CONFIGURABLE',
    apiKey: 'WHATSAPP',
    required: false,
    title: 'WhatsApp Business',
    icon: '💬',
    subtitle: 'Recevez des commandes via WhatsApp en plus de l\'app',
  },
  {
    id: 'CATALOGUE',
    kind: 'STRUCTURAL',
    required: true,
    title: 'Catalogue produits',
    icon: '📦',
    subtitle: 'Importez un catalogue pré-rempli adapté à votre type',
  },
  {
    id: 'CLIENTS',
    kind: 'STRUCTURAL',
    required: false,
    title: 'Premiers clients',
    icon: '👥',
    subtitle: 'Invitez vos clients réguliers — ou faites-le plus tard',
  },
];

/** Lookup helper, lève si la step n'est pas dans la liste. */
export function getStepMeta(id: WizardStepId): WizardStepMeta {
  const meta = WIZARD_STEPS.find(s => s.id === id);
  if (!meta) throw new Error(`Step ${id} non définie dans WIZARD_STEPS`);
  return meta;
}
