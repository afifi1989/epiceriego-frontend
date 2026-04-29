/**
 * Types locaux de la feature Fidélité Client.
 * Re-exports des types API + types UI dérivés.
 */

export type {
  LoyaltyBalance,
  LoyaltyReward,
  LoyaltyTransaction,
  LoyaltyProgram,
} from '../../services/loyaltyService';

export type TxKind = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST' | 'CANCEL';

export interface AggregateSummary {
  totalPoints: number;
  storesCount: number;
}
