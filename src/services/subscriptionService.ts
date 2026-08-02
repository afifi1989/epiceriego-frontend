/**
 * Service abonnements epicier (mobile).
 *
 * <p>Consomme les endpoints {@code /api/subscriptions/...} pour :</p>
 * <ul>
 *   <li>Lister le catalogue des plans (page de pricing + onboarding)</li>
 *   <li>Recuperer le plan courant + jours restants</li>
 *   <li>Basculer vers un autre plan (DECOUVERTE ou demande d'upgrade)</li>
 * </ul>
 */
import api from './api';

export interface SubscriptionPlan {
  id: number;
  code: 'DECOUVERTE' | 'ESSENTIEL' | 'PRO' | 'PREMIUM' | string;
  name: string;
  tagline?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  /** null = illimite */
  maxProducts?: number | null;
  maxCollaborators?: number | null;
  maxOrdersPerMonth?: number | null;
  maxClients?: number | null;
  maxLivreurs?: number | null;
  maxPromoCodes?: number | null;
  hasWhatsapp: boolean;
  hasPromotions: boolean;
  hasAdvancedStats: boolean;
  hasSuppliers: boolean;
  hasCsvImport: boolean;
  hasLoyalty: boolean;
  hasMultiEpicerie: boolean;
  hasPrioritySupport: boolean;
  /** Offres & paniers groupés. Présent dans SubscriptionPlanDTO (backend). */
  hasBundleOffers: boolean;
  /**
   * Multi-caisse : autorise la création d'une 2ᵉ caisse et plus. La 1ʳᵉ caisse
   * reste GRATUITE (enforce backend CaisseService). Désormais mappé dans
   * SubscriptionPlanDTO.from() → exposé au front.
   */
  hasMultiCaisse?: boolean;
  displayOrder: number;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface MySubscription {
  subscriptionId: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string;
  trialEndDate?: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  autoRenew: boolean;
  daysRemaining: number;
}

export const subscriptionService = {
  /** Catalogue public — accessible sans auth pendant l'onboarding. */
  listPlans: async (): Promise<SubscriptionPlan[]> => {
    const response = await api.get<SubscriptionPlan[]>('/subscriptions/plans');
    return response.data ?? [];
  },

  /**
   * Plan courant de l'epicier connecte. Retourne null si pas d'abonnement
   * (edge case ou epicerie creee avant V97).
   */
  getMyPlan: async (): Promise<MySubscription | null> => {
    try {
      const response = await api.get<MySubscription | { plan: null }>('/subscriptions/my-plan');
      const data = response.data;
      if (!data || (data as any).plan === null) return null;
      return data as MySubscription;
    } catch {
      return null;
    }
  },

  /**
   * @deprecated Préférer requestChange qui gère le cas plan payant via une
   * demande PENDING de validation manuelle. Conservé pour compat anciennes
   * APK.
   */
  switchPlan: async (planCode: string): Promise<MySubscription> => {
    const res = await subscriptionService.requestChange(planCode);
    return res.subscription ?? (await subscriptionService.getMyPlan())!;
  },

  /**
   * V99 — Demande de changement de plan unifiée.
   *
   * - Plan gratuit (Découverte) → switch immédiat, status=IMMEDIATE
   * - Plan payant → crée demande PENDING + retourne payment instructions
   */
  requestChange: async (planCode: string): Promise<RequestChangeResponse> => {
    const response = await api.post<RequestChangeResponse>(
      '/subscriptions/request-change',
      { planCode }
    );
    return response.data;
  },

  /** La demande PENDING courante (null si aucune — backend renvoie 404). */
  getMyRequest: async (): Promise<SubscriptionChangeRequest | null> => {
    try {
      const response = await api.get<SubscriptionChangeRequest>('/subscriptions/my-request');
      return response.data;
    } catch {
      return null;
    }
  },

  /** Annule la demande PENDING courante. Idempotent. */
  cancelMyRequest: async (): Promise<void> => {
    await api.delete('/subscriptions/my-request');
  },

  /** Instructions de paiement actives (RIB, WhatsApp, méthodes). */
  getPaymentInstructions: async (): Promise<PaymentInstructions | null> => {
    try {
      const response = await api.get<PaymentInstructions>('/subscriptions/payment-instructions');
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Calcule l'impact d'un changement de plan avant qu'il soit applique.
   */
  previewSwitch: async (planCode: string): Promise<SubscriptionSwitchPreview> => {
    const response = await api.post<SubscriptionSwitchPreview>('/subscriptions/preview-switch', { planCode });
    return response.data;
  },
};

// ── V99 : types pour la validation manuelle ──────────────────────────────

export type SubscriptionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface SubscriptionChangeRequest {
  id: number;
  status: SubscriptionRequestStatus;
  currentPlan: SubscriptionPlan;
  requestedPlan: SubscriptionPlan;
  amountDue: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  paymentReference?: string;
  paymentReceivedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInstructions {
  key: string;
  label: string;
  bankName?: string;
  accountHolder?: string;
  rib?: string;
  iban?: string;
  swift?: string;
  phoneWhatsapp?: string;
  phoneCall?: string;
  emailContact?: string;
  acceptedMethods?: string;
  instructions?: string;
}

export interface RequestChangeResponse {
  status: 'IMMEDIATE' | 'PENDING';
  subscription: MySubscription | null;
  request?: SubscriptionChangeRequest | null;
  paymentInstructions?: PaymentInstructions | null;
}

export interface SubscriptionSwitchPreview {
  currentPlanCode: string;
  targetPlanCode: string;
  targetPlanName: string;
  isDowngrade: boolean;
  featureLosses: FeatureLoss[];
  quotaWarnings: QuotaWarning[];
}

export interface FeatureLoss {
  feature: string;
  label: string;
  affectedCount?: number | null;
  action?: string | null;
}

export interface QuotaWarning {
  quotaType: string;
  label: string;
  currentUsage: number;
  newMax: number;
}
