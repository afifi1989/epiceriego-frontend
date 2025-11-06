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
        const parsed = JSON.parse(cartJson);
        console.log('[CartService.getCart] Panier parsé:', parsed.length, 'articles');
        return parsed;
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
      const existingIndex = cart.findIndex(item => item.id === product.id);

      if (existingIndex >= 0) {
        // Produit existe déjà, augmenter la quantité
        cart[existingIndex].quantity += product.quantity;
      } else {
        // Nouveau produit
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
   */
  updateQuantity: async (productId: number, delta: number): Promise<CartItem[]> => {
    try {
      const cart = await cartService.getCart();
      const updatedCart = cart.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
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
   */
  removeFromCart: async (productId: number): Promise<CartItem[]> => {
    try {
      const cart = await cartService.getCart();
      const updatedCart = cart.filter(item => item.id !== productId);
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
      return cart.reduce((sum, item) => sum + (item.prix * item.quantity), 0);
    } catch (error) {
      console.error('[CartService] Erreur calcul total:', error);
      return 0;
    }
  },
};
