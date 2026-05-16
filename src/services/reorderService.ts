import { CartItem, Order, OrderItemDetail } from '../type';
import { cartService } from './cartService';

export interface ReorderResult {
  /** Nombre d'items poussés au panier. */
  added:   number;
  /** Items ignorés faute d'info nécessaire (productId/unitId/prix manquant). */
  skipped: number;
  /** True si le panier précédent a été vidé (cross-epicerie). */
  cartReset: boolean;
}

/**
 * Re-pousse les items d'une commande passée vers le panier courant.
 *
 * Règles métier:
 * - Le panier est TOUJOURS vidé avant de réinjecter la commande (replace, pas
 *   append). Sinon, cliquer plusieurs fois sur "Reprendre votre commande"
 *   accumulerait les quantités à l'infini.
 * - Items sans prix unitaire ou sans productId → skipped (le service est
 *   tolérant: 1 item cassé ne casse pas le reorder entier).
 *
 * Retour: stats utilisables pour donner un toast informatif à l'utilisateur.
 */
async function reorderFromOrder(order: Order): Promise<ReorderResult> {
  let added = 0;
  let skipped = 0;

  const currentCart = await cartService.getCart();
  const cartReset = currentCart.length > 0;
  if (cartReset) {
    await cartService.clearCart();
  }

  for (const item of order.items) {
    const cartItem = toCartItem(item, order.epicerieId);
    if (!cartItem) {
      skipped++;
      continue;
    }
    try {
      await cartService.addToCart(cartItem);
      added++;
    } catch (e) {
      console.warn('[reorderService] addToCart failed for', item.productNom, e);
      skipped++;
    }
  }

  return { added, skipped, cartReset };
}

/**
 * Mappe un OrderItemDetail (snapshot historique) vers un CartItem (état panier).
 * Renvoie null si l'item n'est pas réinjectable au panier.
 */
function toCartItem(item: OrderItemDetail, epicerieId: number): CartItem | null {
  // Garde-fou: un item d'historique sans prix unitaire ou sans productId
  // n'est pas reconstructible côté cart.
  if (!item.productId || item.prixUnitaire == null) return null;

  const quantity = item.quantite || 1;
  return {
    itemType:     item.itemType ?? 'PRODUCT',
    productId:    item.productId,
    productNom:   item.productNom,
    epicerieId,
    unitId:       item.unitId,
    unitLabel:    item.unitLabel,
    quantity,
    requestedQuantity: item.quantityActual ?? quantity,
    pricePerUnit: item.prixUnitaire,
    totalPrice:   item.prixUnitaire * quantity,
  };
}

export const reorderService = { reorderFromOrder };
