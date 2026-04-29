/**
 * Types pour l'onboarding épicier.
 * Miroir des DTOs backend : OnboardingStatusDTO, CatalogueItemDTO,
 * OnboardingStep enum.
 */

/**
 * Étapes "configurables" — alignées avec l'enum backend
 * {@code OnboardingStep}. Couvre les 6 étapes ajoutées au-delà du
 * triplet historique (Type, Catalogue, Clients).
 *
 * Le front utilise ce string literal directement dans les URLs des
 * endpoints génériques :
 *   POST /api/onboarding/{epicerieId}/step/{stepKey}/complete
 *   POST /api/onboarding/{epicerieId}/step/{stepKey}/skip
 */
export type OnboardingStepKey =
  | 'LOCATION'
  | 'PHOTOS'
  | 'DESCRIPTION'
  | 'HOURS'
  | 'DELIVERY'
  | 'WHATSAPP';

export interface OnboardingStatus {
  completed: boolean;

  // ── Étapes obligatoires ──
  stepTypeCompleted: boolean;
  stepCatalogueCompleted: boolean;
  productsImported: number;

  // ── Étape clients (existante, déjà skippable) ──
  stepClientsCompleted: boolean;
  stepClientsSkipped: boolean;

  // ── Étapes configurables ──
  stepLocationCompleted: boolean;
  stepLocationSkipped: boolean;

  stepPhotosCompleted: boolean;
  stepPhotosSkipped: boolean;

  stepDescriptionCompleted: boolean;
  stepDescriptionSkipped: boolean;

  stepHoursCompleted: boolean;
  stepHoursSkipped: boolean;

  stepDeliveryCompleted: boolean;
  stepDeliverySkipped: boolean;

  stepWhatsappCompleted: boolean;
  stepWhatsappSkipped: boolean;
}

export interface CatalogueItem {
  seedId: string;
  nom: string;
  nomAr: string;
  description?: string;
  categoryName: string;
  categoryId: number | null;
  prixSuggere: number;
  stockSuggere: number;
  preSelected: boolean;
}

export interface EpicerieTypeOption {
  type: string;
  label: string;
  icon: string;
  description: string;
}

export const EPICERIE_TYPES: EpicerieTypeOption[] = [
  { type: 'EPICERIE_GENERALE', label: 'Épicerie générale', icon: '🛒', description: 'Alimentation, boissons, hygiène' },
  { type: 'BOULANGERIE_PATISSERIE', label: 'Boulangerie', icon: '🥖', description: 'Pains, viennoiseries, pâtisseries' },
  { type: 'BOUCHERIE_CHARCUTERIE', label: 'Boucherie', icon: '🥩', description: 'Viandes, volailles, charcuterie' },
  { type: 'FRUITS_LEGUMES', label: 'Fruits & Légumes', icon: '🥦', description: 'Fruits, légumes, herbes fraîches' },
  { type: 'POISSONNERIE', label: 'Poissonnerie', icon: '🐟', description: 'Poissons, fruits de mer' },
  { type: 'BOISSONS', label: 'Boissons', icon: '🧃', description: 'Boissons, jus, eaux' },
  { type: 'BIO_NATURE', label: 'Bio & Nature', icon: '🌿', description: 'Produits bio et naturels' },
  { type: 'EPICERIE_FINE', label: 'Épicerie fine', icon: '🫙', description: 'Produits de terroir, épices' },
  { type: 'SUPERETTE', label: 'Supérette', icon: '🏪', description: 'Supermarché de quartier' },
  { type: 'AUTRE', label: 'Autre', icon: '📦', description: 'Autre type de commerce' },
];

// ── Helpers de lecture du status ──────────────────────────────────────

/**
 * Indique si un step configurable est "résolu" (complété OU ignoré).
 * Sert au wizard pour décider s'il doit encore l'afficher.
 */
export function isOptionalStepResolved(
  status: OnboardingStatus,
  step: OnboardingStepKey,
): boolean {
  switch (step) {
    case 'LOCATION':    return status.stepLocationCompleted    || status.stepLocationSkipped;
    case 'PHOTOS':      return status.stepPhotosCompleted      || status.stepPhotosSkipped;
    case 'DESCRIPTION': return status.stepDescriptionCompleted || status.stepDescriptionSkipped;
    case 'HOURS':       return status.stepHoursCompleted       || status.stepHoursSkipped;
    case 'DELIVERY':    return status.stepDeliveryCompleted    || status.stepDeliverySkipped;
    case 'WHATSAPP':    return status.stepWhatsappCompleted    || status.stepWhatsappSkipped;
  }
}

export function isOptionalStepCompleted(
  status: OnboardingStatus,
  step: OnboardingStepKey,
): boolean {
  switch (step) {
    case 'LOCATION':    return status.stepLocationCompleted;
    case 'PHOTOS':      return status.stepPhotosCompleted;
    case 'DESCRIPTION': return status.stepDescriptionCompleted;
    case 'HOURS':       return status.stepHoursCompleted;
    case 'DELIVERY':    return status.stepDeliveryCompleted;
    case 'WHATSAPP':    return status.stepWhatsappCompleted;
  }
}
