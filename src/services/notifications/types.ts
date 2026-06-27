/**
 * Notification types — single source of truth for both:
 *  - push payload `data.type` (sent by backend via Expo/FCM)
 *  - API notification `Notification.type` (stored in DB)
 *
 * Backend MUST emit one of these values. Front uses the value to:
 *  - resolve a deep link route (see routing.ts)
 *  - pick an Android channel (see channels.ts)
 *  - render an icon/color in the UI (see presentation.ts)
 *
 * To add a new type: add it here, then add a route/channel/visual override
 * in the relevant files. The defaults are safe fallbacks.
 */
export const NotificationType = {
  NOTIFICATION: 'NOTIFICATION',
  ALERT: 'ALERT',
  INFO: 'INFO',

  ORDER: 'ORDER',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_PREPARING: 'ORDER_PREPARING',
  ORDER_READY: 'ORDER_READY',
  ORDER_OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_DETAIL: 'ORDER_DETAIL',

  DELIVERY: 'DELIVERY',
  DELIVERY_ASSIGNED: 'DELIVERY_ASSIGNED',

  PROMOTION: 'PROMOTION',
  PROMO: 'PROMO',

  EPICERIE: 'EPICERIE',

  INVITATION: 'INVITATION',

  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  INVOICE_DUE: 'INVOICE_DUE',
  CREDIT_UPDATED: 'CREDIT_UPDATED',

  LOYALTY_POINTS_EARNED: 'LOYALTY_POINTS_EARNED',
  LOYALTY_TIER_REACHED: 'LOYALTY_TIER_REACHED',
  LOYALTY_REWARD_AVAILABLE: 'LOYALTY_REWARD_AVAILABLE',

  CART_REMINDER: 'CART_REMINDER',

  CHATBOT_RESPONSE: 'CHATBOT_RESPONSE',
} as const;

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

const TYPE_ALIASES: Record<string, NotificationTypeValue> = {
  PROMO: NotificationType.PROMOTION,
};

export function normalizeType(rawType?: string | null): NotificationTypeValue | undefined {
  if (!rawType) return undefined;
  const upper = String(rawType).toUpperCase();
  return (TYPE_ALIASES[upper] || upper) as NotificationTypeValue;
}

export type NotificationFamily =
  | 'ORDER'
  | 'DELIVERY'
  | 'PROMOTION'
  | 'EPICERIE'
  | 'INVITATION'
  | 'PAYMENT'
  | 'LOYALTY'
  | 'CART'
  | 'CHAT'
  | 'INFO';

const FAMILY_MAP: Record<NotificationTypeValue, NotificationFamily> = {
  [NotificationType.NOTIFICATION]: 'INFO',
  [NotificationType.ALERT]: 'INFO',
  [NotificationType.INFO]: 'INFO',
  [NotificationType.ORDER]: 'ORDER',
  [NotificationType.ORDER_CONFIRMED]: 'ORDER',
  [NotificationType.ORDER_PREPARING]: 'ORDER',
  [NotificationType.ORDER_READY]: 'ORDER',
  [NotificationType.ORDER_OUT_FOR_DELIVERY]: 'DELIVERY',
  [NotificationType.ORDER_DELIVERED]: 'DELIVERY',
  [NotificationType.ORDER_CANCELLED]: 'ORDER',
  [NotificationType.ORDER_DETAIL]: 'ORDER',
  [NotificationType.DELIVERY]: 'DELIVERY',
  [NotificationType.DELIVERY_ASSIGNED]: 'DELIVERY',
  [NotificationType.PROMOTION]: 'PROMOTION',
  [NotificationType.PROMO]: 'PROMOTION',
  [NotificationType.EPICERIE]: 'EPICERIE',
  [NotificationType.INVITATION]: 'INVITATION',
  [NotificationType.PAYMENT_RECEIVED]: 'PAYMENT',
  [NotificationType.INVOICE_DUE]: 'PAYMENT',
  [NotificationType.CREDIT_UPDATED]: 'PAYMENT',
  [NotificationType.LOYALTY_POINTS_EARNED]: 'LOYALTY',
  [NotificationType.LOYALTY_TIER_REACHED]: 'LOYALTY',
  [NotificationType.LOYALTY_REWARD_AVAILABLE]: 'LOYALTY',
  [NotificationType.CART_REMINDER]: 'CART',
  [NotificationType.CHATBOT_RESPONSE]: 'CHAT',
};

export function getFamily(type: string | undefined | null): NotificationFamily {
  const normalized = normalizeType(type);
  if (!normalized) return 'INFO';
  return FAMILY_MAP[normalized] ?? 'INFO';
}

export function parseNotificationData(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  }
  return {};
}
