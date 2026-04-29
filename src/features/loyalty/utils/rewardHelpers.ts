import type { LoyaltyReward } from '../types';

export function canAfford(reward: LoyaltyReward, balance: number): boolean {
  return balance >= reward.pointsCost;
}

export function pointsMissing(reward: LoyaltyReward, balance: number): number {
  return Math.max(0, reward.pointsCost - balance);
}

export function progressRatio(reward: LoyaltyReward, balance: number): number {
  if (reward.pointsCost <= 0) return 1;
  return Math.max(0, Math.min(1, balance / reward.pointsCost));
}

export type RewardTypeKey = 'amount' | 'percent' | 'free';

export function rewardTypeKey(reward: LoyaltyReward): RewardTypeKey {
  switch (reward.rewardType) {
    case 'DISCOUNT_AMOUNT':
      return 'amount';
    case 'DISCOUNT_PERCENT':
      return 'percent';
    case 'FREE_PRODUCT':
    default:
      return 'free';
  }
}

export function rewardTypeValue(reward: LoyaltyReward): number | null {
  switch (reward.rewardType) {
    case 'DISCOUNT_AMOUNT':
      return reward.discountAmount ?? 0;
    case 'DISCOUNT_PERCENT':
      return reward.discountPercent ?? 0;
    default:
      return null;
  }
}

/**
 * Tri suggéré pour afficher les récompenses au client :
 *  1. Accessibles (balance >= cost)  triées par sortOrder puis pointsCost croissant
 *  2. Verrouillées  triées par points manquants croissants (les plus proches d'abord)
 */
export function sortRewardsForClient(rewards: LoyaltyReward[], balance: number): LoyaltyReward[] {
  const active = rewards.filter(r => r.isActive);
  return [...active].sort((a, b) => {
    const aAfford = canAfford(a, balance);
    const bAfford = canAfford(b, balance);
    if (aAfford !== bAfford) return aAfford ? -1 : 1;
    if (aAfford) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.pointsCost - b.pointsCost;
    }
    return pointsMissing(a, balance) - pointsMissing(b, balance);
  });
}
