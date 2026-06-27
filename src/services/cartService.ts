import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../type';

const CART_STORAGE_KEY = '@abridgo_cart';
const CART_BUNDLES_KEY = '@abridgo_cart_bundles';

// ─── Bundle cart (V106) ──────────────────────────────────────────────────
// Stockage separe des "lignes bundle" pour ne pas etendre le type CartItem
// existant (qui rejette productId <= 0). Le checkout combine les deux dans
// le payload POST /orders. Pattern equivalent : 2 listes paralleles, meme
// epicerieId pour grouper a l'affichage.

/** Item compose d'un bundle dans le snapshot (mirror partiel du backend). */
export interface CartBundleItem {
  productId: number;
  productName: string;
  productPhotoUrl?: string | null;
  productUnitId?: number | null;
  unitLabel?: string | null;
  quantity: number;
}

/** Ligne bundle persistee dans le panier client. */
export interface CartBundle {
  /** ID du BundleOffer cote backend. */
  bundleOfferId: number;
  epicerieId: number;
  epicerieName?: string;
  /** Snapshot du nom au moment de l'ajout — affichage stable meme si renomme. */
  snapshotName: string;
  /** Prix forfaitaire du bundle fige a l'ajout. */
  snapshotPrice: number;
  currencyCode: string;
  photoUrl?: string | null;
  /** Composition pour l'affichage expansion dans la cart. */
  items: CartBundleItem[];
  /** Quantite de bundles dans le panier (1 par defaut, peut augmenter). */
  quantity: number;
}

/**
 * Source unique de vérité pour le total d'une ligne du panier.
 *
 * <p>Le champ {@code totalPrice} stocké sur {@link CartItem} est <strong>dérivé</strong>
 * de {@code pricePerUnit × quantity}. Toujours passer par ce helper plutôt que
 * de lire {@code item.totalPrice} directement — ainsi un item dont le stockage
 * a dérivé (panier persisté à l'époque d'un bug, race entre deux writes, etc.)
 * affiche quand même le bon montant.</p>
 *
 * <p>Tolérant aux entrées invalides : null/undefined/NaN/négatifs → 0. On ne
 * veut pas qu'un item corrompu fasse exploser le calcul du panier complet.</p>
 */
export function computeItemTotal(item: Pick<CartItem, 'pricePerUnit' | 'quantity'>): number {
  const price = Number(item?.pricePerUnit);
  const qty = Number(item?.quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0;
  if (price < 0 || qty <= 0) return 0;
  // Round to 2 decimals to éviter les artefacts IEEE-754 (ex. 0.1×3 = 0.30000004).
  return Math.round(price * qty * 100) / 100;
}

/**
 * Sanitise une liste de CartItem :
 * <ul>
 *   <li>Recalcule {@code totalPrice} à partir de {@code pricePerUnit × quantity}.
 *       Log un warning si l'ancien total stocké était désaligné — c'est la
 *       sonde qui révèle les paniers persistés avec un total faux.</li>
 *   <li>Drop les items invalides (quantité &lt;= 0, prix négatif/NaN, productId
 *       manquant). Mieux vaut perdre un item cassé que présenter un faux total
 *       à la commande.</li>
 *   <li>Force {@code itemType=PRODUCT} si manquant (héritage des paniers V1).</li>
 *   <li>Normalise {@code unitId=0|null} → propriété supprimée (le backend
 *       déclenche "Unit not found" sur {@code unitId=0} explicite).</li>
 * </ul>
 *
 * <p>Conçu pour être appelé à <em>chaque</em> lecture ET avant <em>chaque</em>
 * écriture, donc idempotent et bon marché.</p>
 */
function sanitizeCart(raw: any[]): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;

    const productId = Number(it.productId);
    const quantity = Number(it.quantity);
    const pricePerUnit = Number(it.pricePerUnit);
    if (!Number.isFinite(productId) || productId <= 0) {
      console.warn('[CartService] 🗑 Drop item sans productId valide:', it);
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      console.warn('[CartService] 🗑 Drop item avec quantité invalide:', it.productNom, it.quantity);
      continue;
    }
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      console.warn('[CartService] 🗑 Drop item avec prix invalide:', it.productNom, it.pricePerUnit);
      continue;
    }

    const sanitized: CartItem = {
      ...it,
      itemType: it.itemType || 'PRODUCT',
      productId,
      quantity,
      pricePerUnit,
      epicerieId: Number(it.epicerieId) || 0,
      totalPrice: computeItemTotal({ pricePerUnit, quantity }),
    };

    if (!sanitized.epicerieId) {
      console.warn('[CartService] ⚠️ Item sans epicerieId — sera rejeté au checkout:', sanitized.productNom);
    }

    // unitId=0|null = produit sans variante (legacy). On supprime la clé
    // plutôt que de la garder à 0 — sinon le backend essaie de matcher la
    // ProductUnit id=0 et renvoie "Unit not found".
    if (sanitized.unitId === 0 || sanitized.unitId === null) {
      delete (sanitized as any).unitId;
    }

    // Sonde de désalignement : si le panier persisté contenait un totalPrice
    // faux (cas de paniers anciens), on l'enregistre pour pouvoir tracer
    // l'origine en production. Toléré, on remet la bonne valeur.
    const previous = Number(it.totalPrice);
    if (Number.isFinite(previous) && Math.abs(previous - sanitized.totalPrice) > 0.01) {
      console.warn(
        '[CartService] 🔧 totalPrice désaligné — corrigé:',
        sanitized.productNom,
        `stocké=${previous} → recalculé=${sanitized.totalPrice}`,
        `(${sanitized.pricePerUnit} × ${sanitized.quantity})`,
      );
    }

    out.push(sanitized);
  }
  return out;
}

/**
 * Service pour gérer le panier persistant.
 *
 * <p><strong>Invariant critique</strong> : à tout moment, pour chaque ligne du
 * panier, {@code totalPrice === pricePerUnit × quantity}. Garanti par
 * {@link sanitizeCart} appliqué à <em>chaque</em> read et write. Le checkout
 * dépend de cet invariant — un désalignement = facturation erronée.</p>
 */
export const cartService = {
  /**
   * Récupère le panier depuis AsyncStorage, sanitisé.
   */
  getCart: async (): Promise<CartItem[]> => {
    try {
      const cartJson = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (!cartJson) return [];
      const parsed = JSON.parse(cartJson);
      return sanitizeCart(parsed);
    } catch (error) {
      console.error('[CartService] Erreur lecture panier:', error);
      return [];
    }
  },

  /**
   * Sauvegarde le panier dans AsyncStorage. Sanitise systématiquement avant
   * d'écrire — verrou en écriture qui garantit que le storage ne contiendra
   * jamais un {@code totalPrice} désaligné, même si un caller en amont a
   * oublié de le mettre à jour.
   */
  saveCart: async (cart: CartItem[]): Promise<void> => {
    try {
      const sanitized = sanitizeCart(cart);
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (error) {
      console.error('[CartService.saveCart] ❌ Erreur sauvegarde panier:', error);
    }
  },

  /**
   * Ajoute un produit au panier.
   *
   * <p>Cumul automatique si {@code (productId, unitId)} existe déjà. Le
   * {@code totalPrice} envoyé par le caller est ignoré — toujours recalculé
   * via {@link computeItemTotal} pour éviter les désalignements d'un appelant
   * négligent.</p>
   */
  addToCart: async (product: CartItem): Promise<CartItem[]> => {
    try {
      const cart = await cartService.getCart();

      const existingIndex = cart.findIndex(item =>
        item.productId === product.productId &&
        item.unitId === product.unitId
      );

      if (existingIndex >= 0) {
        const merged = {
          ...cart[existingIndex],
          quantity: cart[existingIndex].quantity + product.quantity,
        };
        merged.totalPrice = computeItemTotal(merged);
        cart[existingIndex] = merged;
      } else {
        cart.push({
          ...product,
          totalPrice: computeItemTotal(product),
        });
      }

      await cartService.saveCart(cart);
      return cart;
    } catch (error) {
      console.error('[CartService] Erreur ajout au panier:', error);
      return [];
    }
  },

  /**
   * Met à jour la quantité d'un produit (delta peut être négatif).
   * Si la quantité retombe à 0, l'item est retiré.
   */
  updateQuantity: async (productId: number, delta: number, unitId?: number): Promise<CartItem[]> => {
    try {
      const cart = await cartService.getCart();
      const updatedCart = cart.map(item => {
        const isSameProduct = item.productId === productId &&
          (unitId === undefined || item.unitId === unitId);

        if (isSameProduct) {
          const newQuantity = item.quantity + delta;
          if (newQuantity > 0) {
            const next = { ...item, quantity: newQuantity };
            next.totalPrice = computeItemTotal(next);
            return next;
          }
          return null;
        }
        return item;
      }).filter((item): item is CartItem => item !== null);

      await cartService.saveCart(updatedCart);
      return updatedCart;
    } catch (error) {
      console.error('[CartService] Erreur mise à jour quantité:', error);
      return [];
    }
  },

  /**
   * Vide complètement le panier
   */
  clearCart: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
      console.log('[CartService] Panier vidé');
    } catch (error) {
      console.error('[CartService] Erreur vidage panier:', error);
    }
  },

  /**
   * Supprime un produit spécifique du panier
   * Utilise productId et optionnellement unitId pour identifier le produit
   */
  removeFromCart: async (productId: number, unitId?: number): Promise<CartItem[]> => {
    try {
      const cart = await cartService.getCart();
      const updatedCart = cart.filter(item => {
        const isSameProduct = item.productId === productId &&
          (unitId === undefined || item.unitId === unitId);
        return !isSameProduct;
      });
      await cartService.saveCart(updatedCart);
      return updatedCart;
    } catch (error) {
      console.error('[CartService] Erreur suppression du panier:', error);
      return [];
    }
  },

  /**
   * Obtient le nombre total d'articles dans le panier
   */
  getCartCount: async (): Promise<number> => {
    try {
      const cart = await cartService.getCart();
      return cart.reduce((sum, item) => sum + item.quantity, 0);
    } catch (error) {
      console.error('[CartService] Erreur comptage panier:', error);
      return 0;
    }
  },

  /**
   * Obtient le total du panier. Toujours recalculé via {@link computeItemTotal}
   * pour rester robuste à un éventuel désalignement de stockage.
   */
  getCartTotal: async (): Promise<number> => {
    try {
      const cart = await cartService.getCart();
      return cart.reduce((sum, item) => sum + computeItemTotal(item), 0);
    } catch (error) {
      console.error('[CartService] Erreur calcul total:', error);
      return 0;
    }
  },

  // ─── Bundles (V106) ────────────────────────────────────────────────────

  /** Lit la liste des lignes bundle du panier (peut etre vide). */
  getBundles: async (): Promise<CartBundle[]> => {
    try {
      const raw = await AsyncStorage.getItem(CART_BUNDLES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidBundle) : [];
    } catch (error) {
      console.error('[CartService] Erreur lecture bundles:', error);
      return [];
    }
  },

  /** Persiste la liste des lignes bundle. */
  saveBundles: async (bundles: CartBundle[]): Promise<void> => {
    try {
      const sanitized = bundles.filter(isValidBundle);
      await AsyncStorage.setItem(CART_BUNDLES_KEY, JSON.stringify(sanitized));
    } catch (error) {
      console.error('[CartService] Erreur sauvegarde bundles:', error);
    }
  },

  /**
   * Ajoute un bundle au panier. Si la meme (bundleOfferId, epicerieId)
   * existe deja, incremente la quantite. Sinon, cree une nouvelle ligne.
   */
  addBundle: async (bundle: CartBundle): Promise<CartBundle[]> => {
    const list = await cartService.getBundles();
    const idx = list.findIndex(
      b => b.bundleOfferId === bundle.bundleOfferId && b.epicerieId === bundle.epicerieId,
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], quantity: list[idx].quantity + (bundle.quantity || 1) };
    } else {
      list.push({ ...bundle, quantity: bundle.quantity || 1 });
    }
    await cartService.saveBundles(list);
    return list;
  },

  updateBundleQty: async (bundleOfferId: number, epicerieId: number, delta: number): Promise<CartBundle[]> => {
    const list = await cartService.getBundles();
    const next = list
      .map(b => {
        if (b.bundleOfferId === bundleOfferId && b.epicerieId === epicerieId) {
          const q = b.quantity + delta;
          return q > 0 ? { ...b, quantity: q } : null;
        }
        return b;
      })
      .filter((b): b is CartBundle => b !== null);
    await cartService.saveBundles(next);
    return next;
  },

  removeBundle: async (bundleOfferId: number, epicerieId: number): Promise<CartBundle[]> => {
    const list = await cartService.getBundles();
    const next = list.filter(
      b => !(b.bundleOfferId === bundleOfferId && b.epicerieId === epicerieId),
    );
    await cartService.saveBundles(next);
    return next;
  },

  clearBundles: async (): Promise<void> => {
    await AsyncStorage.removeItem(CART_BUNDLES_KEY);
  },

  getBundleSubtotal: async (): Promise<number> => {
    const list = await cartService.getBundles();
    return list.reduce((s, b) => s + (b.snapshotPrice || 0) * (b.quantity || 0), 0);
  },
};

/** Validation minimale d'une ligne bundle persistee (anti-corruption). */
function isValidBundle(b: any): b is CartBundle {
  return (
    b
    && typeof b === 'object'
    && Number.isFinite(b.bundleOfferId) && b.bundleOfferId > 0
    && Number.isFinite(b.epicerieId) && b.epicerieId > 0
    && typeof b.snapshotName === 'string'
    && Number.isFinite(b.snapshotPrice) && b.snapshotPrice >= 0
    && Number.isFinite(b.quantity) && b.quantity > 0
  );
}

/**
 * Helper pur (synchrone) : groupe une liste de CartItem par epicerieId.
 *
 * <p>Retourne un Array d'entrees {@code { epicerieId, items, subtotal }}
 * tri par epicerieId pour un ordre stable a l'affichage. Les items
 * sans epicerieId valide sont regroupes sous la cle 0 (a traiter
 * comme invalide cote checkout).</p>
 *
 * <p>Utilise par l'ecran panier pour afficher des sections par boutique
 * et par le checkout pour generer une requete par epicerie.</p>
 */
export interface CartGroup {
  epicerieId: number;
  /**
   * Nom de la boutique pour l'affichage, dérivé de la première ligne bundle
   * qui le porte (CartItem ne transporte pas le nom). Peut être absent pour
   * un groupe 100% items — les écrans affichent alors le fallback `#id`.
   */
  epicerieNom?: string;
  items: CartItem[];
  /** V106 — lignes bundle de la meme epicerie (peut etre vide). */
  bundles: CartBundle[];
  /** Subtotal items + bundles. */
  subtotal: number;
  /** Nombre d'articles : items (quantite cumulee) + bundles (1 par bundle pour la jauge). */
  itemCount: number;
}

export function groupCartByEpicerie(cart: CartItem[], bundles: CartBundle[] = []): CartGroup[] {
  const itemsMap = new Map<number, CartItem[]>();
  for (const item of cart) {
    const id = item.epicerieId || 0;
    if (!itemsMap.has(id)) itemsMap.set(id, []);
    itemsMap.get(id)!.push(item);
  }
  const bundlesMap = new Map<number, CartBundle[]>();
  for (const b of bundles) {
    const id = b.epicerieId || 0;
    if (!bundlesMap.has(id)) bundlesMap.set(id, []);
    bundlesMap.get(id)!.push(b);
  }
  const allIds = Array.from(new Set([...itemsMap.keys(), ...bundlesMap.keys()])).sort((a, b) => a - b);
  return allIds.map(epicerieId => {
    const its = itemsMap.get(epicerieId) ?? [];
    const bds = bundlesMap.get(epicerieId) ?? [];
    const itemsSub = its.reduce((s, it) => s + computeItemTotal(it), 0);
    const bundlesSub = bds.reduce((s, b) => s + (b.snapshotPrice || 0) * (b.quantity || 0), 0);
    return {
      epicerieId,
      epicerieNom: bds.find((b) => !!b.epicerieName)?.epicerieName,
      items: its,
      bundles: bds,
      subtotal: Math.round((itemsSub + bundlesSub) * 100) / 100,
      itemCount:
        its.reduce((s, it) => s + (it.quantity || 0), 0)
        + bds.reduce((s, b) => s + (b.quantity || 0), 0),
    };
  });
}
