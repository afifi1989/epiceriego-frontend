/**
 * Normalisation des statuts de livraison côté livreur.
 *
 * Le backend renvoie les noms de l'enum OrderStatus (PENDING, ACCEPTED,
 * PREPARING, READY, IN_DELIVERY, DELIVERED, CANCELLED). Historiquement,
 * les écrans testaient des valeurs qui n'existent pas côté serveur
 * ('completed', 'in_progress') : le bouton « Livré au client » ne
 * s'affichait jamais et les compteurs restaient à zéro. Toute comparaison
 * de statut DOIT passer par ce module.
 */

export type NormalizedDeliveryStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled'
  | 'unknown';

export const normalizeDeliveryStatus = (status?: string): NormalizedDeliveryStatus => {
  switch ((status ?? '').toLowerCase()) {
    case 'pending':
    case 'en attente':
      return 'pending';
    case 'accepted':
    case 'preparing':
    case 'en préparation':
      return 'preparing';
    case 'ready':
    case 'prête':
      return 'ready';
    // 'in_progress' : ancienne valeur utilisée par les écrans mobile
    case 'in_progress':
    case 'in_delivery':
    case 'en cours':
      return 'in_delivery';
    // 'completed' : ancienne valeur utilisée par les écrans mobile
    case 'completed':
    case 'delivered':
    case 'complétée':
      return 'delivered';
    case 'cancelled':
    case 'annulée':
      return 'cancelled';
    default:
      return 'unknown';
  }
};

/** Statuts pour lesquels la commande n'est pas encore partie en livraison. */
export const isAwaitingPickup = (status?: string): boolean =>
  ['pending', 'preparing', 'ready'].includes(normalizeDeliveryStatus(status));

export const isInDelivery = (status?: string): boolean =>
  normalizeDeliveryStatus(status) === 'in_delivery';

export const isDelivered = (status?: string): boolean =>
  normalizeDeliveryStatus(status) === 'delivered';

export const isCancelled = (status?: string): boolean =>
  normalizeDeliveryStatus(status) === 'cancelled';

export const isReady = (status?: string): boolean =>
  normalizeDeliveryStatus(status) === 'ready';
