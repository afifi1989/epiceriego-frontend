/**
 * Custom hook for product management
 * Handles product state, caching, and API interactions
 */

import { useState, useCallback, useEffect } from 'react';
import epicierProductService, {
  ProductDetailDTO,
} from '../services/epicierProductService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PaginatedProducts {
  content: ProductDetailDTO[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

interface UseProductsState {
  products: ProductDetailDTO[];
  lowStockProducts: ProductDetailDTO[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  lastUpdated: number | null;
}

const CACHE_KEY = 'epicier_products_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useProducts = () => {
  const [state, setState] = useState<UseProductsState>({
    products: [],
    lowStockProducts: [],
    isLoading: false,
    error: null,
    hasMore: true,
    currentPage: 0,
    totalPages: 0,
    lastUpdated: null,
  });

  // Load products from cache
  const loadFromCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { products, timestamp } = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - timestamp < CACHE_DURATION) {
          setState((prev) => ({
            ...prev,
            products,
            lastUpdated: timestamp,
          }));
          return true;
        }
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    }
    return false;
  }, []);

  // Save products to cache
  const saveToCache = useCallback(async (products: ProductDetailDTO[]) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          products,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, []);

  // Get all products
  const getProducts = useCallback(
    async (page = 0, size = 50, useCache = true) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Try cache for first page only
        if (page === 0 && useCache) {
          const fromCache = await loadFromCache();
          if (fromCache) {
            setState((prev) => ({ ...prev, isLoading: false }));
            return state.products;
          }
        }

        const data: PaginatedProducts =
          await epicierProductService.getProducts(page, size);
        const allProducts =
          page === 0
            ? data.content
            : [...state.products, ...data.content];

        setState((prev) => ({
          ...prev,
          products: allProducts,
          currentPage: page,
          totalPages: data.totalPages,
          hasMore: page < data.totalPages - 1,
          isLoading: false,
          lastUpdated: Date.now(),
        }));

        // Cache if first page
        if (page === 0) {
          await saveToCache(data.content);
        }

        return allProducts;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur';
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        throw error;
      }
    },
    [state.products, loadFromCache, saveToCache]
  );

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data = await epicierProductService.searchProducts(query, 0, 100);
      setState((prev) => ({
        ...prev,
        products: data.content || [],
        isLoading: false,
      }));
      return data.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Get single product
  const getProductById = useCallback(async (productId: number) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const product = await epicierProductService.getProductById(productId);
      setState((prev) => ({ ...prev, isLoading: false }));
      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Get low stock products
  const getLowStockProducts = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data = await epicierProductService.getLowStockProducts();
      setState((prev) => ({
        ...prev,
        lowStockProducts: data.content || [],
        isLoading: false,
      }));
      return data.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Create product
  const createProduct = useCallback(async (productData: any) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const newProduct = await epicierProductService.createProduct(productData);
      setState((prev) => ({
        ...prev,
        products: [newProduct, ...prev.products],
        isLoading: false,
      }));
      return newProduct;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Update product
  const updateProduct = useCallback(async (productId: number, productData: any) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const updated = await epicierProductService.updateProduct(
        productId,
        productData
      );
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === productId ? updated : p)),
        isLoading: false,
      }));
      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Update stock
  const updateStock = useCallback(async (productId: number, quantity: number) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const updated = await epicierProductService.updateStock(productId, quantity);
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === productId ? updated : p)),
        isLoading: false,
      }));
      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Delete product
  const deleteProduct = useCallback(async (productId: number) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await epicierProductService.deleteProduct(productId);
      setState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Find by barcode
  const findByBarcode = useCallback(async (barcode: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const product = await epicierProductService.findProductByBarcode(barcode);
      setState((prev) => ({ ...prev, isLoading: false }));
      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      setState((prev) => ({
        ...prev,
        products: [],
        lastUpdated: null,
      }));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    await clearCache();
    return getProducts(0, 50, false);
  }, [clearCache, getProducts]);

  return {
    // State
    ...state,
    // Methods
    getProducts,
    searchProducts,
    getProductById,
    getLowStockProducts,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    findByBarcode,
    clearCache,
    refresh,
  };
};
