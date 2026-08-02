import api from './api';

/**
 * Service "Quick Reorder" — proposer la dernière commande livrée du client
 * comme template pour gagner du temps sur les commandes récurrentes.
 *
 * Endpoint backend : GET /api/orders/quick-reorder?epicerieId=X
 * - 200 → {@link QuickReorderSuggestion} avec items + état actuel (stock, prix)
 * - 204 → null (pas d'historique exploitable pour ce client × épicerie)
 *
 * Le caller doit gérer le filtrage des items {@code available=false} avant
 * d'ajouter au panier, et idéalement afficher un bandeau explicatif sur les
 * articles indisponibles.
 */

export interface QuickReorderItem {
  productId: number | null;
  unitId?: number | null;
  productName: string;
  photoUrl?: string;
  unitLabel?: string;
  /**
   * Quantité à re-commander, en UNITÉ DE BASE du catalogue (kg / L / pièces) —
   * « 500 g » vaut 0.5. Recopiée depuis `OrderItem.baseQuantity` côté backend.
   * Peut donc être décimale : tout champ entier alimenté à partir d'elle
   * (`OrderItemRequest.quantite`, `@Min(1)`) doit être arrondi au supérieur.
   */
  quantity: number;
  /**
   * Total de la ligne aux prix du jour, déjà mis à l'échelle de la variante.
   * Ne pas recalculer via `currentUnitPrice * quantity` : `quantity` est en
   * unité de base alors que `currentUnitPrice` est le prix d'UN format.
   */
  lineTotal?: number;
  /** Prix d'UN format de vente aujourd'hui (comparable à `previousUnitPrice`). */
  currentUnitPrice?: number;
  previousUnitPrice?: number;
  currentStock?: number;
  available: boolean;
  /** "out_of_stock" | "removed" | "variant_removed" | null */
  unavailableReason?: string | null;
}

export interface QuickReorderSuggestion {
  sourceOrderId: number;
  sourceOrderDate: string;          // ISO 8601 from backend LocalDateTime
  sourceOrderTotal: number;
  currency?: {
    code: string;
    symbol: string;
    symbolPosition: 'BEFORE' | 'AFTER';
    decimals: number;
  };
  items: QuickReorderItem[];
  availableCount: number;
  unavailableCount: number;
  estimatedTotal: number;
}

export const quickReorderService = {
  /**
   * Récupère la suggestion de re-commande pour l'épicerie ciblée. Renvoie
   * null si le backend répond 204 (pas d'historique). En cas d'erreur réseau
   * ou serveur, on swallow et renvoie null aussi — la fonctionnalité est
   * purement "nice to have" et ne doit jamais bloquer l'ouverture du chatbot.
   */
  async getSuggestion(epicerieId: number): Promise<QuickReorderSuggestion | null> {
    try {
      const res = await api.get<QuickReorderSuggestion>('/orders/quick-reorder', {
        params: { epicerieId },
      });
      // Axios remonte status 204 avec data=null/'' → on normalise en null.
      if (res.status === 204 || !res.data || typeof res.data !== 'object') {
        return null;
      }
      return res.data;
    } catch (err) {
      // Échec silencieux : pas d'historique, pas connecté, ou backend down.
      // Le chatbot continue normalement sans la card "Reprendre".
      return null;
    }
  },
};
