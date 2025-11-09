import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../type';

const CART_STORAGE_KEY = '@epiceriego_cart';

/**
 * Service pour gérer le panier persistant
 */
export const cartService = {
  /**
   * Récupère le panier depuis AsyncStorage
   */
  getCart: async (): Promise<CartItem[]> => {
    try {
      const cartJson = await AsyncStorage.getItem(CART_STORAGE_KEY);
      console.log('[CartService.getCart] Clé:', CART_STORAGE_KEY);
      console.log('[CartService.getCart] Contenu brut:', cartJson);

      if (cartJson) {
        let parsed = JSON.parse(cartJson);
        console.log('[CartService.getCart] Panier parsé:', parsed.length, 'articles');

        // Migration: Fix items that don't have epicerieId (from before the fix)
        const migratedCart = parsed.map((item: any) => {
          if (!item.epicerieId) {
            console.warn('[CartService] ⚠️ Item sans epicerieId détecté:', item.productNom);
            // Si epicerieId manque, on ne peut pas corriger sans le backend
            // Donc on le marque comme invalide
            return {
              ...item,
              epicerieId: 0, // Invalide - sera rejeté à la checkout
            };
          }
          return item;
        });

        return migratedCart;
      }
      console.log('[CartService.getCart] Panier vide');
      return [];
    } catch (error) {
      console.error('[CartService] Erreur lecture panier:', error);
      return [];
    }
  },

  /**
   * Sauvegarde le panier dans AsyncStorage
   */
  saveCart: async (cart: CartItem[]): Promise<void> => {
    try {
      const cartJson = JSON.stringify(cart);
      await AsyncStorage.setItem(CART_STORAGE_KEY, cartJson);
      console.log('[CartService.saveCart] ✅ Panier sauvegardé:', cart.length, 'articles');
      console.log('[CartService.saveCart] Clé:', CART_STORAGE_KEY);
      console.log('[CartService.saveCart] Contenu:', cartJson.substring(0, 100));
    } catch (error) {
      console.error('[CartService.saveCart] ❌ Erreur sauvegarde panier:', error);
    }
  },

  /**
   * Ajoute un produit au panier
   */
  addToCart: async (product: CartItem): Promise<CartItem[]> => {
    try {
      const cart = await cartService.getCart();

      // Chercher si le produit existe déjà avec la même unité
      const existingIndex = cart.findIndex(item =>
        item.productId === product.productId &&
        item.unitId === product.unitId
      );

      if (existingIndex >= 0) {
        // Produit existe déjà avec la même unité, augmenter la quantité
        cart[existingIndex].quantity += product.quantity;
        cart[existingIndex].totalPrice = cart[existingIndex].pricePerUnit * cart[existingIndex].quantity;
      } else {
        // Nouveau produit ou nouvelle unité
        cart.push(product);
      }

      await cartService.saveCart(cart);
      return cart;
    } catch (error) {
      console.error('[CartService] Erreur ajout au panier:', error);
      return [];
    }
  },

  /**
   * Met à jour la quantité d'un produit
   * Utilise productId et optionnellement unitId pour identifier le produit
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
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: item.pricePerUnit * newQuantity
            };
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
   * Obtient le total du panier
   */
  getCartTotal: async (): Promise<number> => {
    try {
      const cart = await cartService.getCart();
      return cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    } catch (error) {
      console.error('[CartService] Erreur calcul total:', error);
      return 0;
    }
  },
};
