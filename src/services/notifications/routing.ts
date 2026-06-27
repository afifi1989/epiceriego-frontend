import { NotificationType, NotificationTypeValue, normalizeType } from './types';

/**
 * Maps a notification type to a deep link route.
 *
 * Resolvers receive the notification's `data` payload and return the route
 * to push. If `data` lacks the required field (e.g. orderId), fall back to
 * a list view rather than crashing.
 *
 * Routing is role-aware: a CLIENT and a LIVREUR tapping the same
 * notification type must land in their own layout group — crossing
 * layouts bounces the user through the wrong auth guard.
 */
type RouteResolver = (data: Record<string, any>) => string;

export type RoutingRole = 'CLIENT' | 'LIVREUR';

const FALLBACK_ROUTE = '/(client)/notifications';
const LIVREUR_FALLBACK_ROUTE = '/(livreur)/deliveries';

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

/**
 * Routes côté livreur : toutes les notifications de course mènent à la
 * liste des livraisons (pas d'écran de détail dédié pour le moment).
 */
const LIVREUR_ROUTE_RESOLVERS: Partial<Record<NotificationTypeValue, RouteResolver>> = {
  [NotificationType.DELIVERY_ASSIGNED]: () => LIVREUR_FALLBACK_ROUTE,
  [NotificationType.DELIVERY]: () => LIVREUR_FALLBACK_ROUTE,
  [NotificationType.ORDER_READY]: () => LIVREUR_FALLBACK_ROUTE,
  [NotificationType.ORDER_OUT_FOR_DELIVERY]: () => LIVREUR_FALLBACK_ROUTE,
  [NotificationType.ORDER_DELIVERED]: () => '/(livreur)/history',
};

export function resolveRoute(
  type: string | undefined | null,
  data: Record<string, any>,
  role: RoutingRole = 'CLIENT'
): string {
  const normalized = normalizeType(type);

  if (role === 'LIVREUR') {
    if (normalized && LIVREUR_ROUTE_RESOLVERS[normalized]) {
      return LIVREUR_ROUTE_RESOLVERS[normalized]!(data);
    }
    return LIVREUR_FALLBACK_ROUTE;
  }

  if (normalized && ROUTE_RESOLVERS[normalized]) {
    return ROUTE_RESOLVERS[normalized]!(data);
  }
  return FALLBACK_ROUTE;
}
