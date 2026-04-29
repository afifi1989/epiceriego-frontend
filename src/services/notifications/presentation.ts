import {
  getFamily,
  NotificationFamily,
  NotificationType,
  NotificationTypeValue,
  normalizeType,
} from './types';

/**
 * UI presentation for a notification (icon, color, badge letter).
 *
 * Resolved in two passes:
 *  1. Family default (e.g. all ORDER_* share blue)
 *  2. Type-specific override (e.g. ORDER_CANCELLED switches to red)
 */
export interface NotificationVisuals {
  icon: string;
  color: string;
  badge: string;
}

const FAMILY_VISUALS: Record<NotificationFamily, NotificationVisuals> = {
  ORDER: { icon: '📦', color: '#2196F3', badge: 'O' },
  DELIVERY: { icon: '🚚', color: '#4CAF50', badge: 'D' },
  PROMOTION: { icon: '🎉', color: '#FF9800', badge: 'P' },
  EPICERIE: { icon: '🏪', color: '#00BCD4', badge: 'E' },
  INVITATION: { icon: '✉️', color: '#FF5722', badge: 'I' },
  PAYMENT: { icon: '💳', color: '#3F51B5', badge: '€' },
  LOYALTY: { icon: '⭐', color: '#FFC107', badge: '★' },
  CART: { icon: '🛒', color: '#795548', badge: 'C' },
  CHAT: { icon: '💬', color: '#009688', badge: '@' },
  INFO: { icon: 'ℹ️', color: '#9C27B0', badge: 'i' },
};

const TYPE_OVERRIDES: Partial<Record<NotificationTypeValue, Partial<NotificationVisuals>>> = {
  [NotificationType.ALERT]: { icon: '⚠️', color: '#F44336' },
  [NotificationType.ORDER_CONFIRMED]: { icon: '✅' },
  [NotificationType.ORDER_PREPARING]: { icon: '👨‍🍳' },
  [NotificationType.ORDER_READY]: { icon: '✅' },
  [NotificationType.ORDER_OUT_FOR_DELIVERY]: { icon: '🛵' },
  [NotificationType.ORDER_DELIVERED]: { icon: '✅', color: '#4CAF50' },
  [NotificationType.ORDER_CANCELLED]: { icon: '❌', color: '#F44336' },
  [NotificationType.INVOICE_DUE]: { icon: '⏰', color: '#FF9800' },
  [NotificationType.PAYMENT_RECEIVED]: { icon: '✅', color: '#4CAF50' },
  [NotificationType.CREDIT_UPDATED]: { icon: '💰' },
  [NotificationType.LOYALTY_TIER_REACHED]: { icon: '🏆' },
  [NotificationType.LOYALTY_REWARD_AVAILABLE]: { icon: '🎁' },
};

export function getVisuals(type: string | undefined | null): NotificationVisuals {
  const family = getFamily(type);
  const base = FAMILY_VISUALS[family];
  const normalized = normalizeType(type);
  const override = normalized ? TYPE_OVERRIDES[normalized] : undefined;
  return { ...base, ...(override ?? {}) };
}
