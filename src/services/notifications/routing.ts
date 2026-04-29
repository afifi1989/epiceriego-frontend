import { NotificationType, NotificationTypeValue, normalizeType } from './types';

/**
 * Maps a notification type to a deep link route.
 *
 * Resolvers receive the notification's `data` payload and return the route
 * to push. If `data` lacks the required field (e.g. orderId), fall back to
 * a list view rather than crashing.
 */
type RouteResolver = (data: Record<string, any>) => string;

const FALLBACK_ROUTE = '/(client)/notifications';

const ROUTE_RESOLVERS: Partial<Record<NotificationTypeValue, RouteResolver>> = {
  [NotificationType.ORDER_DETAIL]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : '/(client)/(commandes)',
  [NotificationType.ORDER_CONFIRMED]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : FALLBACK_ROUTE,
  [NotificationType.ORDER_PREPARING]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : FALLBACK_ROUTE,
  [NotificationType.ORDER_READY]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : FALLBACK_ROUTE,
  [NotificationType.ORDER_OUT_FOR_DELIVERY]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : FALLBACK_ROUTE,
  [NotificationType.ORDER_DELIVERED]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : FALLBACK_ROUTE,
  [NotificationType.ORDER_CANCELLED]: (d) =>
    d?.orderId ? `/(client)/(commandes)/${d.orderId}` : FALLBACK_ROUTE,

  [NotificationType.EPICERIE]: (d) =>
    d?.epicerieId ? `/(client)/(epicerie)/${d.epicerieId}` : '/(client)/epiceries',
  [NotificationType.PROMOTION]: (d) =>
    d?.epicerieId ? `/(client)/(epicerie)/${d.epicerieId}` : FALLBACK_ROUTE,

  [NotificationType.PAYMENT_RECEIVED]: () => '/(client)/factures-paiements',
  [NotificationType.INVOICE_DUE]: () => '/(client)/factures-paiements',
  [NotificationType.CREDIT_UPDATED]: () => '/(client)/factures-paiements',

  [NotificationType.LOYALTY_POINTS_EARNED]: () => '/(client)/fidelite',
  [NotificationType.LOYALTY_TIER_REACHED]: () => '/(client)/fidelite',
  [NotificationType.LOYALTY_REWARD_AVAILABLE]: () => '/(client)/fidelite',

  [NotificationType.CART_REMINDER]: () => '/(client)/cart',

  [NotificationType.CHATBOT_RESPONSE]: (d) =>
    d?.epicerieId ? `/(client)/(epicerie)/${d.epicerieId}` : FALLBACK_ROUTE,

  [NotificationType.INVITATION]: () => FALLBACK_ROUTE,
};

export function resolveRoute(type: string | undefined | null, data: Record<string, any>): string {
  const normalized = normalizeType(type);
  if (normalized && ROUTE_RESOLVERS[normalized]) {
    return ROUTE_RESOLVERS[normalized]!(data);
  }
  return FALLBACK_ROUTE;
}
