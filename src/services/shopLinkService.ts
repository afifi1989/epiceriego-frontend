/**
 * Service Shop Link cote mobile : lien WhatsApp permanent partage par
 * l'epicerie (QR vitrine, flyer) et snapshots panier pre-remplis crees
 * par le client depuis l'app.
 *
 * Cote backend : voir {@code ShopLinkService.java} + endpoints
 *   - GET  /api/epiceries/my-epicerie/whatsapp-share (auth epicier)
 *   - POST /api/whatsapp/precart                    (auth client)
 */

import { Linking } from 'react-native';
import api from './api';

/** Miroir de {@code ShareLinkResponse} cote backend. */
export interface ShareLinkResponse {
  /** Token brut EG-XXXXXXXXXXXX. */
  token: string;
  /** URL wa.me prete a partager. */
  waUrl: string;
  /** Numero d'affichage WhatsApp business (E.164). */
  displayPhone: string;
  /** EPICERIE = lien permanent, PRECART = snapshot temporaire. */
  kind: 'EPICERIE' | 'PRECART';
  /** ISO datetime — present uniquement pour PRECART. */
  expiresAt?: string;
}

/** Un item envoye dans POST /api/whatsapp/precart. */
export interface PrecartItem {
  productId: number;
  unitId?: number | null;
  productName?: string;
  unitLabel?: string;
  /**
   * Quantite en UNITE DE BASE du catalogue (kg / L / pieces), jamais en nombre
   * de formats de vente : « 2 x 500 g » vaut 1.0, pas 2. C'est l'unite du panier
   * JSON WhatsApp cote backend (PrecartItemDTO#quantity), consommee telle quelle
   * par le recap, le calcul de prix et le decrement de stock.
   *
   * Depuis un CartItem, envoyer `requestedQuantity` (repli sur `quantity`), pas
   * `quantity`.
   */
  quantity: number;
  price?: number;
}

/** V106 — Une ligne bundle envoyee dans POST /api/whatsapp/precart. */
export interface PrecartBundle {
  bundleOfferId: number;
  quantity: number;
  /** Snapshot du nom pour le recap WhatsApp. */
  name?: string;
  /** Snapshot du prix forfaitaire pour le recap WhatsApp. */
  price?: number;
}

// Cache memoire du lien permanent de l'epicerie : il est immuable cote serveur
// (idempotent a la creation), inutile de re-fetch a chaque navigation. Un seul
// epicier par session = un seul lien a memoriser.
let cachedEpicerieLink: ShareLinkResponse | null = null;

const shopLinkService = {
  /**
   * Pour l'epicier connecte : renvoie le lien WhatsApp permanent de sa boutique.
   * Cree le lien a la 1ere demande puis le reutilise.
   *
   * @param force si true, ignore le cache et re-fetch
   */
  async getMyShareLink(force = false): Promise<ShareLinkResponse> {
    if (!force && cachedEpicerieLink) {
      return cachedEpicerieLink;
    }
    try {
      const response = await api.get<ShareLinkResponse>('/epiceries/my-epicerie/whatsapp-share');
      cachedEpicerieLink = response.data;
      return response.data;
    } catch (error) {
      console.error('[ShopLink] Error fetching share link:', error);
      throw error;
    }
  },

  /**
   * Pour un client : cree une session PRECART avec son panier courant et
   * renvoie le lien wa.me a ouvrir. Le backend rejette en 429 si le client
   * a deja trop de sessions actives en parallele.
   *
   * V106 — Accepte aussi des bundles (paniers groupes). Au moins un des deux
   * doit etre non vide (validation cote backend via {@code @AssertTrue}).
   */
  async createPrecart(
    epicerieId: number,
    items: PrecartItem[],
    bundles: PrecartBundle[] = [],
  ): Promise<ShareLinkResponse> {
    try {
      const response = await api.post<ShareLinkResponse>('/whatsapp/precart', {
        epicerieId,
        items,
        // Omet le champ si vide pour rester compatible avec d'anciens backends
        // qui n'ont pas encore le champ — Spring tolere les champs inconnus
        // a la deserialisation mais autant rester minimaliste.
        ...(bundles.length > 0 ? { bundles } : {}),
      });
      return response.data;
    } catch (error) {
      console.error('[ShopLink] Error creating precart:', error);
      throw error;
    }
  },

  /**
   * Ouvre WhatsApp (app native si installee, web fallback sinon) sur l'URL
   * wa.me. Renvoie true en cas de succes, false sinon (ex: device sans
   * WhatsApp + sans navigateur — tres rare).
   */
  async openWhatsApp(waUrl: string): Promise<boolean> {
    try {
      const supported = await Linking.canOpenURL(waUrl);
      if (!supported) {
        console.warn('[ShopLink] WhatsApp URL not openable on this device:', waUrl);
        return false;
      }
      await Linking.openURL(waUrl);
      return true;
    } catch (error) {
      console.error('[ShopLink] Error opening WhatsApp:', error);
      return false;
    }
  },

  /** Vide le cache local (ex: apres logout, ou changement d'epicerie). */
  invalidateCache(): void {
    cachedEpicerieLink = null;
  },
};

export default shopLinkService;
