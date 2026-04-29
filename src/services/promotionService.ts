import api from './api';

// ═══════════════════════════════════════════════════════════════════════════
// Types (alignés sur le backend V70+)
// ═══════════════════════════════════════════════════════════════════════════

export type PromoStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type PromoTargetType = 'ALL' | 'CATEGORY' | 'PRODUCT' | 'UNIT';
export type PromoTargetKind = 'CATEGORY' | 'PRODUCT' | 'UNIT';

export interface PromotionTarget {
  id: number;
  kind: PromoTargetKind;
  targetId: number;
  displayName: string;
}

export interface Promotion {
  id: number;
  epicerieId: number;
  epicerieName: string;
  epicerieImageUrl?: string;
  titre: string;
  description?: string;
  reductionPercentage: number;
  imageUrl?: string;
  dateDebut: string;
  dateFin: string;
  isActive: boolean;
  createdAt: string;
  isCurrentlyActive: boolean;

  // V70+
  status?: PromoStatus;
  targetType?: PromoTargetType;
  autoApply?: boolean;
  priority?: number;
  appliedAt?: string;
  rolledBackAt?: string;
  targets?: PromotionTarget[];
  impactedUnitsCount?: number;
}

export interface CreatePromotionRequest {
  titre: string;
  description?: string;
  reductionPercentage: number;
  imageUrl?: string;
  dateDebut: string;
  dateFin: string;
  // V70+
  targetType?: PromoTargetType;
  targetIds?: number[];
  autoApply?: boolean;
  priority?: number;
}

export interface UpdatePromotionRequest extends Partial<CreatePromotionRequest> {
  isActive?: boolean;
}

export interface PromotionPreview {
  promotionId?: number | null;
  reductionPercentage: number;
  totalUnits: number;
  unitsSample: {
    unitId: number;
    productId: number | null;
    productName: string;
    unitLabel: string;
    currentPrix: number;
    projectedPrix: number;
    savings: number;
    existingActivePromotionId: number | null;
  }[];
  avgSavingPerUnit: number;
  unitsAlreadyUnderPromo: number;
}

export interface PromotionImpact {
  promotionId: number;
  activeUnitsCount: number;
  totalSavingsGiven: number;
  appliedAt?: string;
  expectedExpiryAt?: string;
  activeUnits: {
    unitId: number;
    productId: number | null;
    productName: string;
    unitLabel: string;
    originalPrix: number;
    currentPrix: number;
    savings: number;
  }[];
}

export interface ActivePromotionSummary {
  id: number;
  titre: string;
  reductionPercentage: number;
  dateFin: string;
  priority: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

export const promotionService = {

  // ── CLIENT ────────────────────────────────────────────────────────────────

  getNearbyPromotions: async (
    latitude: number,
    longitude: number,
    radius: number = 1,
  ): Promise<Promotion[]> => {
    const r = await api.get<Promotion[]>('/promotions/nearby', {
      params: { latitude, longitude, radius },
    });
    return r.data ?? [];
  },

  getFavoriteEpiceriesPromotions: async (): Promise<Promotion[]> => {
    const r = await api.get<Promotion[]>('/promotions/favorites');
    return r.data ?? [];
  },

  getAllActivePromotions: async (): Promise<Promotion[]> => {
    const r = await api.get<Promotion[]>('/promotions/all');
    return r.data ?? [];
  },

  getActivePromotionsForProduct: async (productId: number): Promise<Promotion[]> => {
    const r = await api.get<Promotion[]>(`/promotions/active/for-product/${productId}`);
    return r.data ?? [];
  },

  getActivePromotionsForUnit: async (unitId: number): Promise<Promotion[]> => {
    const r = await api.get<Promotion[]>(`/promotions/active/for-unit/${unitId}`);
    return r.data ?? [];
  },

  // ── ÉPICIER — CRUD ────────────────────────────────────────────────────────

  getMyPromotions: async (): Promise<Promotion[]> => {
    const r = await api.get<Promotion[]>('/promotions/my-store');
    return r.data ?? [];
  },

  getPromotionById: async (id: number): Promise<Promotion> => {
    const r = await api.get<Promotion>(`/promotions/${id}`);
    return r.data;
  },

  createPromotion: async (data: CreatePromotionRequest): Promise<Promotion> => {
    const r = await api.post<Promotion>('/promotions', data);
    return r.data;
  },

  updatePromotion: async (id: number, data: UpdatePromotionRequest): Promise<Promotion> => {
    const r = await api.put<Promotion>(`/promotions/${id}`, data);
    return r.data;
  },

  deletePromotion: async (id: number): Promise<void> => {
    await api.delete(`/promotions/${id}`);
  },

  togglePromotionStatus: async (id: number, isActive: boolean): Promise<Promotion> => {
    const r = await api.put<Promotion>(`/promotions/${id}/toggle`, null, {
      params: { isActive },
    });
    return r.data;
  },

  // ── ÉPICIER — LIFECYCLE V70+ ──────────────────────────────────────────────

  applyPromotion: async (id: number): Promise<{ promotion: Promotion; unitsModified: number }> => {
    const r = await api.post(`/promotions/${id}/apply`);
    return r.data;
  },

  rollbackPromotion: async (id: number): Promise<{ promotion: Promotion; unitsRestored: number }> => {
    const r = await api.post(`/promotions/${id}/rollback`);
    return r.data;
  },

  previewPromotion: async (id: number): Promise<PromotionPreview> => {
    const r = await api.get<PromotionPreview>(`/promotions/${id}/preview`);
    return r.data;
  },

  previewPromotionSpec: async (spec: CreatePromotionRequest): Promise<PromotionPreview> => {
    const r = await api.post<PromotionPreview>('/promotions/preview-spec', spec);
    return r.data;
  },

  getPromotionImpact: async (id: number): Promise<PromotionImpact> => {
    const r = await api.get<PromotionImpact>(`/promotions/${id}/impact`);
    return r.data;
  },
};
