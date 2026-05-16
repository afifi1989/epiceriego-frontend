import api from './api';

/**
 * Réponse du backend POST /api/epiceries/{id}/delivery-quote.
 *
 * - `canDeliver=false` + `mode='NONE'`        → l'épicerie ne livre pas
 * - `canDeliver=false` + `mode='ZONES'`       → adresse hors des zones couvertes
 * - `canDeliver=true`                          → `deliveryFee` à facturer
 *
 * En mode `ZONES`, `zoneName` et `distanceKm` sont remplis pour expliquer
 * le calcul au client. En mode `FLAT_RATE`, `zoneName` reste null.
 */
export interface DeliveryQuote {
  mode: 'ZONES' | 'FLAT_RATE' | 'NONE';
  canDeliver: boolean;
  deliveryFee: number | null;
  zoneName: string | null;
  distanceKm: number | null;
  currencyCode: string | null;
  hasLivreur: boolean;
}

export const deliveryQuoteService = {
  /**
   * Demande un devis de livraison pour des coordonnées client précises.
   * Utilisé par le panier client pour afficher le coût de livraison
   * avant validation. Le serveur recalcule à la création de commande,
   * donc cette valeur est purement indicative.
   */
  quote: async (
    epicerieId: number,
    latitude: number,
    longitude: number,
  ): Promise<DeliveryQuote> => {
    const response = await api.post<DeliveryQuote>(
      `/epiceries/${epicerieId}/delivery-quote`,
      { latitude, longitude },
    );
    return response.data;
  },
};
