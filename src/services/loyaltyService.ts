/**
 * Service Fidélité — API loyalty pour épicier et client.
 */

import api from './api';

// ── Types ────────────────────────────────────────────────────

export interface LoyaltyProgram {
  id: number;
  epicerieId: number;
  programType: 'POINTS' | 'STAMPS';
  name: string;
  earningRateNumerator: number;
  earningRateDenominator: number;
  roundingMode: string;
  minOrderAmount: number | null;
  pointsExpiryDays: number | null;
  earnOnCreditOrders: boolean;
  isActive: boolean;
}

export interface LoyaltyReward {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  rewardType: 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT' | 'FREE_PRODUCT';
  discountAmount: number | null;
  discountPercent: number | null;
  maxDiscountAmount: number | null;
  productUnitId: number | null;
  productNameSnapshot: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface LoyaltyTransaction {
  id: number;
  transactionType: 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST' | 'CANCEL';
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  referenceType: string | null;
  referenceId: number | null;
  rewardId: number | null;
  description: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface LoyaltyBalance {
  epicerieId: number;
  epicerieName?: string;
  programName?: string;
  programType?: string;
  balance: number;
  isActive?: boolean;
}

export interface LoyaltyStats {
  activeMembersCount: number;
  totalPointsInCirculation: number;
}

// ── Epicier API ──────────────────────────────────────────────

export const loyaltyService = {

  // Programme
  getProgram: async (): Promise<LoyaltyProgram> => {
    const r = await api.get<LoyaltyProgram>('/loyalty/program');
    return r.data;
  },

  saveProgram: async (data: Partial<LoyaltyProgram>): Promise<LoyaltyProgram> => {
    const r = await api.put<LoyaltyProgram>('/loyalty/program', data);
    return r.data;
  },

  toggleProgram: async (active: boolean): Promise<LoyaltyProgram> => {
    const r = await api.patch<LoyaltyProgram>('/loyalty/program/toggle', { active });
    return r.data;
  },

  // Récompenses
  getRewards: async (activeOnly = false): Promise<LoyaltyReward[]> => {
    const r = await api.get<LoyaltyReward[]>('/loyalty/rewards', { params: { activeOnly } });
    return r.data ?? [];
  },

  createReward: async (data: Partial<LoyaltyReward>): Promise<LoyaltyReward> => {
    const r = await api.post<LoyaltyReward>('/loyalty/rewards', data);
    return r.data;
  },

  updateReward: async (id: number, data: Partial<LoyaltyReward>): Promise<LoyaltyReward> => {
    const r = await api.put<LoyaltyReward>(`/loyalty/rewards/${id}`, data);
    return r.data;
  },

  deleteReward: async (id: number): Promise<void> => {
    await api.delete(`/loyalty/rewards/${id}`);
  },

  // Stats
  getStats: async (): Promise<LoyaltyStats> => {
    const r = await api.get<LoyaltyStats>('/loyalty/stats');
    return r.data;
  },

  // Client balance (vu par l'épicier)
  getClientBalance: async (clientId: number): Promise<LoyaltyBalance> => {
    const r = await api.get<LoyaltyBalance>(`/loyalty/clients/${clientId}/balance`);
    return r.data;
  },

  getClientTransactions: async (clientId: number, page = 0): Promise<{
    content: LoyaltyTransaction[];
    totalElements: number;
    last: boolean;
  }> => {
    const r = await api.get(`/loyalty/clients/${clientId}/transactions`, { params: { page, size: 20 } });
    return r.data;
  },

  adjustPoints: async (clientId: number, points: number, note?: string): Promise<LoyaltyTransaction> => {
    const r = await api.post<LoyaltyTransaction>(`/loyalty/clients/${clientId}/adjust`, { points, note });
    return r.data;
  },

  // ── Client self-service API ────────────────────────────────

  getMyBalances: async (): Promise<Record<number, number>> => {
    const r = await api.get<Record<number, number>>('/loyalty/my/balances');
    return r.data ?? {};
  },

  getMyBalanceAtStore: async (epicerieId: number): Promise<LoyaltyBalance> => {
    const r = await api.get<LoyaltyBalance>(`/loyalty/my/epiceries/${epicerieId}/balance`);
    return r.data;
  },

  getMyRewardsAtStore: async (epicerieId: number): Promise<LoyaltyReward[]> => {
    const r = await api.get<LoyaltyReward[]>(`/loyalty/my/epiceries/${epicerieId}/rewards`);
    return r.data ?? [];
  },

  getMyTransactionsAtStore: async (epicerieId: number, page = 0): Promise<{
    content: LoyaltyTransaction[];
    totalElements: number;
    last: boolean;
  }> => {
    const r = await api.get(`/loyalty/my/epiceries/${epicerieId}/transactions`, { params: { page, size: 20 } });
    return r.data;
  },

  redeemReward: async (epicerieId: number, rewardId: number, orderId?: number): Promise<{ discount: number; success: boolean }> => {
    const r = await api.post(`/loyalty/my/epiceries/${epicerieId}/redeem`, { rewardId, orderId });
    return r.data;
  },
};
