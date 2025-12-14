/**
 * Custom hook for order management
 * Handles order state and API interactions
 */

import { useState, useCallback } from 'react';
import epicierOrderService from '../services/epicierOrderService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OrderListItem {
  id: number;
  clientName: string;
  itemCount: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface PaginatedOrders {
  content: OrderListItem[];
  totalElements: number;
  totalPages: number;
}

interface UseOrdersState {
  orders: OrderListItem[];
  newOrders: OrderListItem[];
  preparingOrders: OrderListItem[];
  readyOrders: OrderListItem[];
  isLoading: boolean;
  error: string | null;
  stats: {
    newCount: number;
    preparingCount: number;
    readyCount: number;
    totalCount: number;
  };
  lastUpdated: number | null;
}

const CACHE_KEY = 'epicier_orders_cache';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (shorter for orders)

export const useOrders = () => {
  const [state, setState] = useState<UseOrdersState>({
    orders: [],
    newOrders: [],
    preparingOrders: [],
    readyOrders: [],
    isLoading: false,
    error: null,
    stats: {
      newCount: 0,
      preparingCount: 0,
      readyCount: 0,
      totalCount: 0,
    },
    lastUpdated: null,
  });

  // Load orders from cache
  const loadFromCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { orders, newOrders, preparingOrders, readyOrders, timestamp } =
          JSON.parse(cached);
        const now = Date.now();

        if (now - timestamp < CACHE_DURATION) {
          setState((prev) => ({
            ...prev,
            orders,
            newOrders,
            preparingOrders,
            readyOrders,
            lastUpdated: timestamp,
            stats: {
              newCount: newOrders.length,
              preparingCount: preparingOrders.length,
              readyCount: readyOrders.length,
              totalCount: orders.length,
            },
          }));
          return true;
        }
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    }
    return false;
  }, []);

  // Save orders to cache
  const saveToCache = useCallback(
    async (
      orders: OrderListItem[],
      newOrders: OrderListItem[],
      preparingOrders: OrderListItem[],
      readyOrders: OrderListItem[]
    ) => {
      try {
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            orders,
            newOrders,
            preparingOrders,
            readyOrders,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        console.error('Error saving to cache:', error);
      }
    },
    []
  );

  // Get all orders with status filtering
  const getOrders = useCallback(async (status?: string, useCache = true) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Try cache first
      if (useCache && !status) {
        const fromCache = await loadFromCache();
        if (fromCache) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return state.orders;
        }
      }

      // Fetch new orders
      const newOrdersData: PaginatedOrders =
        await epicierOrderService.getNewOrders(0, 50);
      const newOrders = newOrdersData?.content || [];

      // Fetch preparing orders
      const preparingData: PaginatedOrders =
        await epicierOrderService.getOrders('PREPARING', 0, 50);
      const preparingOrders = preparingData?.content || [];

      // Fetch ready orders
      const readyData: PaginatedOrders =
        await epicierOrderService.getOrders('READY', 0, 50);
      const readyOrders = readyData?.content || [];

      const allOrders = [...newOrders, ...preparingOrders, ...readyOrders];

      setState((prev) => ({
        ...prev,
        orders: allOrders,
        newOrders,
        preparingOrders,
        readyOrders,
        isLoading: false,
        lastUpdated: Date.now(),
        stats: {
          newCount: newOrders.length,
          preparingCount: preparingOrders.length,
          readyCount: readyOrders.length,
          totalCount: allOrders.length,
        },
      }));

      // Cache all results
      await saveToCache(allOrders, newOrders, preparingOrders, readyOrders);

      return allOrders;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, [state.orders, loadFromCache, saveToCache]);

  // Get new orders
  const getNewOrders = useCallback(async (page = 0, size = 50) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data: PaginatedOrders = await epicierOrderService.getNewOrders(
        page,
        size
      );
      setState((prev) => ({
        ...prev,
        newOrders: data.content || [],
        isLoading: false,
      }));
      return data.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Get orders by status
  const getOrdersByStatus = useCallback(
    async (status: string, page = 0, size = 50) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        const data: PaginatedOrders = await epicierOrderService.getOrders(
          status,
          page,
          size
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        return data.content || [];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur';
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        throw error;
      }
    },
    []
  );

  // Get order details
  const getOrderDetails = useCallback(async (orderId: number) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const order = await epicierOrderService.getOrderDetails(orderId);
      setState((prev) => ({ ...prev, isLoading: false }));
      return order;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Record product scan
  const recordProductScan = useCallback(async (orderId: number, barcode: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const updated = await epicierOrderService.recordProductScan(
        orderId,
        barcode
      );
      setState((prev) => ({ ...prev, isLoading: false }));
      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Update scanned quantity
  const updateScannedQuantity = useCallback(
    async (orderId: number, itemId: number, quantity: number) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        const updated = await epicierOrderService.updateScannedQuantity(
          orderId,
          itemId,
          quantity
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  // Mark item unavailable
  const markItemUnavailable = useCallback(
    async (orderId: number, itemId: number) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        const updated = await epicierOrderService.markItemUnavailable(
          orderId,
          itemId
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  // Complete order
  const completeOrder = useCallback(async (orderId: number, notes?: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await epicierOrderService.completeOrder(orderId, notes);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        orders: prev.orders.filter((o) => o.id !== orderId),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Update order status
  const updateOrderStatus = useCallback(
    async (orderId: number, status: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        await epicierOrderService.updateOrderStatus(orderId, status);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          orders: prev.orders.map((o) =>
            o.id === orderId ? { ...o, status } : o
          ),
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      setState((prev) => ({
        ...prev,
        orders: [],
        newOrders: [],
        preparingOrders: [],
        readyOrders: [],
        lastUpdated: null,
      }));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    await clearCache();
    return getOrders(undefined, false);
  }, [clearCache, getOrders]);

  return {
    // State
    ...state,
    // Methods
    getOrders,
    getNewOrders,
    getOrdersByStatus,
    getOrderDetails,
    recordProductScan,
    updateScannedQuantity,
    markItemUnavailable,
    completeOrder,
    updateOrderStatus,
    clearCache,
    refresh,
  };
};
