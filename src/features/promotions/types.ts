export type {
  Promotion,
  PromoStatus,
  PromoTargetType,
  PromoTargetKind,
  PromotionTarget,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PromotionPreview,
  PromotionImpact,
  ActivePromotionSummary,
} from '../../services/promotionService';

/**
 * Onglets de la liste promotions (UI-only — correspond à un filtre de status).
 */
export type PromoListTab = 'active' | 'scheduled' | 'expired' | 'cancelled';

/**
 * État du wizard de création/modification.
 */
export interface WizardState {
  id?: number;               // défini si modification
  titre: string;
  description: string;
  reductionPercentage: number;
  imageUrl?: string;
  dateDebut: string;         // ISO string
  dateFin: string;
  targetType: 'ALL' | 'CATEGORY' | 'PRODUCT' | 'UNIT';
  targetIds: number[];
  autoApply: boolean;
  priority: number;
}
