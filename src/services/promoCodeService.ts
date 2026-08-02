import api from './api';

/**
 * Service mobile pour les codes promos (cote client + POS epicier).
 *
 * <p>Contrat aligne sur le backend V95
 * ({@code com.epiceriego.engagement.promocode.port}).</p>
 *
 * <h3>Architecture</h3>
 * Le service expose UNIQUEMENT le preview ({@link validate}). L'application
 * reelle du code se fait cote serveur lors de la creation de la commande
 * (champ {@code promoCode} dans {@link import('../type').CreateOrderRequest}),
 * pas via une API client dediee — evite la triche sur le discount affiche.
 */

/**
 * Codes stables de refus retournes par le backend. Mappes vers les messages
 * localises via {@code translations.promoCodes.errors[REASON]}.
 *
 * <p>NE JAMAIS renommer une constante : ces valeurs sont la cle de jointure
 * avec l'i18n. Ajouter seulement.</p>
 */
export type PromoCodeRejectionReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'MAX_USES_REACHED'
  | 'MAX_USES_PER_USER_REACHED'
  | 'FIRST_ORDER_ONLY'
  | 'MIN_AMOUNT_NOT_MET'
  | 'WRONG_CHANNEL'
  | 'NOT_STACKABLE_WITH_PROMOTION'
  | 'INVALID';

export type PromoCodeChannel = 'APP' | 'POS' | 'BOTH';

export interface ValidatePromoCodeRequest {
  epicerieId: number;
  code: string;
  /** Subtotal panier hors livraison, dans la devise de l'epicerie. */
  subtotal: number;
  /** Defaut: APP cote client. Le POS epicier envoie 'POS'. */
  channel?: PromoCodeChannel;
  /**
   * True si le panier contient au moins un article deja remise par une
   * promotion produit. Permet au backend de refuser en preview un code
   * {@code stackableWithPromotions=false} (reason NOT_STACKABLE_WITH_PROMOTION),
   * au lieu de laisser afficher une remise qui serait rejetee au checkout.
   * Optionnel : omis => le backend considere false (compat ascendante).
   */
  cartHasPromoItems?: boolean;
}

export interface ValidatePromoCodeResponse {
  valid: boolean;
  /** Code normalise echo par le serveur (UPPER). */
  code: string;
  /** Montant de la remise calcule (0 si invalid). */
  discountAmount: number;
  /** Subtotal apres remise. Toujours >= 0. */
  finalSubtotal: number;
  /** Raison du refus si {@code !valid}. */
  reason?: PromoCodeRejectionReason;
}

/**
 * Etat applique cote client : code accepte + montant calcule.
 * Type utilitaire pour le store du cart screen.
 */
export interface AppliedPromoCode {
  code: string;
  discountAmount: number;
}

export const promoCodeService = {
  /**
   * Preview de l'application d'un code sur un panier donne. Read-only :
   * aucune mutation cote serveur. Le subtotal envoye est utilise tel quel
   * pour le calcul — la valeur reelle sera recalculee a la creation de
   * la commande (anti-triche).
   *
   * <p>Le serveur repond toujours en 200 OK avec {@code valid: false} +
   * {@code reason} en cas de refus (plus simple a parser qu'un 400).</p>
   *
   * @throws Erreur reseau ou 5xx avec message textuel
   */
  validate: async (
    req: ValidatePromoCodeRequest
  ): Promise<ValidatePromoCodeResponse> => {
    try {
      // Timeout COURT dédié (12 s) : la validation d'un code promo ne doit
      // jamais faire tourner le spinner pendant les 180 s du timeout global
      // (calibré pour le chatbot LLM). Passé ce délai, on échoue vite pour
      // que le caissier poursuive la vente sans code. Surcharge le timeout
      // de l'instance axios uniquement pour cet appel.
      const response = await api.post<ValidatePromoCodeResponse>(
        '/promo-codes/validate',
        req,
        { timeout: 12000 }
      );
      return response.data;
    } catch (error: any) {
      console.error('[PromoCodeService] validate failed', error?.response?.data ?? error?.message);
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur reseau';
    }
  },
};

/**
 * Helper : extrait le code de rejet d'un message backend "PROMO_CODE_REJECTED:XXX"
 * retourne par /orders ou /orders/direct-sale quand l'apply final echoue.
 *
 * <p>Utilite : meme si le preview a passe, l'application reelle peut echouer
 * si le quota a ete atteint entre temps (course concurrente). Permet au
 * client d'afficher un message clair plutot que "Error creating order: ...".</p>
 */
export function extractPromoRejection(serverMsg?: string | null): PromoCodeRejectionReason | null {
  if (!serverMsg) return null;
  const m = /PROMO_CODE_REJECTED:([A-Z_]+)/.exec(serverMsg);
  return (m?.[1] as PromoCodeRejectionReason) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION EPICIER — CRUD complete pour le panneau de gestion (mobile + web)
// ═══════════════════════════════════════════════════════════════════════════

export type PromoCodeDiscountType = 'PERCENT' | 'FIXED';

/**
 * Vue d'un code promo pour l'epicier. Aligne 1:1 sur le backend
 * {@code com.epiceriego.engagement.promocode.dto.PromoCodeDTO}.
 *
 * <p>NE JAMAIS exposer ces champs ({@code maxUses}, {@code usesCount}, etc.)
 * a un utilisateur client final — c'est la strategie marketing de l'epicier.</p>
 */
export interface PromoCodeDTO {
  id: number;
  epicerieId: number;
  code: string;
  description?: string | null;
  discountType: PromoCodeDiscountType;
  discountValue: number;
  /** Plafond pour PERCENT. null = pas de cap. */
  maxDiscount?: number | null;
  /** Seuil subtotal minimum. null = aucun. */
  minOrderAmount?: number | null;
  /** ISO 8601. */
  startAt: string;
  /** ISO 8601. */
  endAt: string;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  usesCount: number;
  /** {@code maxUses - usesCount}. null si maxUses est null. */
  remainingUses?: number | null;
  firstOrderOnly: boolean;
  /**
   * Cumulable avec les promotions produit. Defaut backend = true. Si false, le
   * code est refuse (PROMO_CODE_REJECTED:NOT_STACKABLE_WITH_PROMOTION) quand le
   * panier contient au moins un article deja remise par une promotion.
   */
  stackableWithPromotions: boolean;
  channel: PromoCodeChannel;
  isActive: boolean;
  /** Helper UI : true si actif + dans la fenetre + quota non atteint. */
  currentlyUsable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromoCodeRequest {
  code: string;
  description?: string;
  discountType: PromoCodeDiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minOrderAmount?: number | null;
  startAt: string;
  endAt: string;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  firstOrderOnly?: boolean;
  /** Cumulable avec les promotions produit. Defaut backend = true. */
  stackableWithPromotions?: boolean;
  channel?: PromoCodeChannel;
  isActive?: boolean;
}

/** PATCH-like : tous les champs optionnels. Seuls les champs fournis sont mis a jour. */
export type UpdatePromoCodeRequest = Partial<CreatePromoCodeRequest>;

/**
 * Etat fonctionnel d'un code, derive du DTO. Utilise par l'UI pour le filtre tabs.
 * <ul>
 *   <li>ACTIVE      : actif + maintenant ∈ [startAt, endAt]</li>
 *   <li>SCHEDULED   : actif + maintenant &lt; startAt (pas encore demarre)</li>
 *   <li>EXPIRED     : actif + maintenant &gt;= endAt</li>
 *   <li>INACTIVE    : isActive = false (desactive par l'epicier)</li>
 * </ul>
 */
export type PromoCodeStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';

export function derivePromoCodeStatus(p: PromoCodeDTO, now: Date = new Date()): PromoCodeStatus {
  if (!p.isActive) return 'INACTIVE';
  const start = new Date(p.startAt).getTime();
  const end = new Date(p.endAt).getTime();
  const t = now.getTime();
  if (t < start) return 'SCHEDULED';
  if (t >= end) return 'EXPIRED';
  return 'ACTIVE';
}

export const promoCodeEpicierService = {
  /** GET /api/promo-codes/my-store — liste pour l'epicerie courante. */
  list: async (): Promise<PromoCodeDTO[]> => {
    try {
      const response = await api.get<PromoCodeDTO[]>('/promo-codes/my-store');
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur de chargement';
    }
  },

  getById: async (id: number): Promise<PromoCodeDTO> => {
    try {
      const response = await api.get<PromoCodeDTO>(`/promo-codes/${id}`);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Code introuvable';
    }
  },

  create: async (req: CreatePromoCodeRequest): Promise<PromoCodeDTO> => {
    try {
      const response = await api.post<PromoCodeDTO>('/promo-codes', req);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors de la creation';
    }
  },

  update: async (id: number, req: UpdatePromoCodeRequest): Promise<PromoCodeDTO> => {
    try {
      const response = await api.put<PromoCodeDTO>(`/promo-codes/${id}`, req);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors de la mise a jour';
    }
  },

  toggle: async (id: number, active: boolean): Promise<PromoCodeDTO> => {
    try {
      const response = await api.put<PromoCodeDTO>(
        `/promo-codes/${id}/toggle`,
        null,
        { params: { active } }
      );
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors du basculement';
    }
  },

  /** DELETE — refus 400 si le code a deja servi (preferer toggle pour preserver l'audit). */
  remove: async (id: number): Promise<void> => {
    try {
      await api.delete(`/promo-codes/${id}`);
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur lors de la suppression';
    }
  },

  // ── Stats (V95 Phase 6) ───────────────────────────────────────────────

  /**
   * Stats agregees sur une fenetre temporelle (defaut: 30 derniers jours).
   * Reserve aux roles avec STATS_VIEW — 403 sur caissier (a gerer dans
   * l'appelant si necessaire).
   */
  stats: async (from?: Date, to?: Date): Promise<PromoCodeStats> => {
    try {
      const params: Record<string, string> = {};
      if (from) params['from'] = from.toISOString();
      if (to)   params['to']   = to.toISOString();
      const response = await api.get<PromoCodeStats>('/promo-codes/stats', { params });
      return response.data;
    } catch (error: any) {
      throw error?.response?.data?.message ?? error?.message ?? 'Erreur stats';
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Types stats (alignes sur backend PromoCodeStatsDTO)
// ═══════════════════════════════════════════════════════════════════════════

export interface TopPromoCodeEntry {
  promoCodeId: number;
  code: string;
  redemptionCount: number;
  totalDiscount: number;
}

export interface PromoCodeStats {
  totalDiscountGiven: number;
  redemptionCount: number;
  activeCodesCount: number;
  topCodes: TopPromoCodeEntry[];
}
