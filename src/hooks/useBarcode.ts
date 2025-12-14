/**
 * Custom hook for barcode scanning and validation
 * Handles barcode validation, parsing, and caching
 */

import { useState, useCallback, useRef } from 'react';
import barcodeService from '../services/barcodeService';
import { Vibration } from 'react-native';

interface BarcodeInfo {
  barcode: string;
  format: string;
  isValid: boolean;
  epicerieId?: number;
  sequenceNumber?: number;
}

interface BarcodeHistory {
  barcode: string;
  timestamp: number;
  format: string;
  isValid: boolean;
}

interface UseBarcodeState {
  lastScanned: string | null;
  lastBarcodeInfo: BarcodeInfo | null;
  isValidating: boolean;
  error: string | null;
  history: BarcodeHistory[];
}

const MAX_HISTORY = 20;

export const useBarcode = () => {
  const [state, setState] = useState<UseBarcodeState>({
    lastScanned: null,
    lastBarcodeInfo: null,
    isValidating: false,
    error: null,
    history: [],
  });

  const scanTimeoutRef = useRef<NodeJS.Timeout>();

  // Validate and parse barcode
  const validateBarcode = useCallback(async (barcode: string) => {
    try {
      setState((prev) => ({ ...prev, isValidating: true, error: null }));

      const cleanBarcode = barcodeService.cleanBarcode(barcode);

      if (!barcodeService.isValidBarcode(cleanBarcode)) {
        const error = `Code-barre invalide: ${cleanBarcode}`;
        setState((prev) => ({
          ...prev,
          isValidating: false,
          error,
        }));
        return null;
      }

      const barcodeInfo = barcodeService.getBarcodeInfo(cleanBarcode);

      const historyItem: BarcodeHistory = {
        barcode: cleanBarcode,
        timestamp: Date.now(),
        format: barcodeInfo.format,
        isValid: barcodeInfo.isValid,
      };

      setState((prev) => ({
        ...prev,
        lastScanned: cleanBarcode,
        lastBarcodeInfo: barcodeInfo,
        isValidating: false,
        history: [historyItem, ...prev.history].slice(0, MAX_HISTORY),
      }));

      // Vibrate on success
      Vibration.vibrate(50);

      return barcodeInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur de validation';
      setState((prev) => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
      }));
      return null;
    }
  }, []);

  // Validate multiple barcodes
  const validateMultiple = useCallback(
    async (barcodes: string[]) => {
      try {
        setState((prev) => ({ ...prev, isValidating: true, error: null }));

        const results = await Promise.all(
          barcodes.map((barcode) => {
            const cleaned = barcodeService.cleanBarcode(barcode);
            const isValid = barcodeService.isValidBarcode(cleaned);
            return {
              barcode: cleaned,
              isValid,
              format: isValid ? barcodeService.detectFormat(cleaned) : 'UNKNOWN',
            };
          })
        );

        setState((prev) => ({ ...prev, isValidating: false }));
        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur';
        setState((prev) => ({
          ...prev,
          isValidating: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  // Detect barcode format
  const detectFormat = useCallback((barcode: string) => {
    const cleaned = barcodeService.cleanBarcode(barcode);
    return barcodeService.detectFormat(cleaned);
  }, []);

  // Extract epicerie ID from internal barcode
  const extractEpicerieId = useCallback((barcode: string) => {
    const cleaned = barcodeService.cleanBarcode(barcode);
    const format = barcodeService.detectFormat(cleaned);

    if (format === 'INTERNAL') {
      return barcodeService.extractEpicerieId(cleaned);
    }
    return null;
  }, []);

  // Extract sequence number from internal barcode
  const extractSequenceNumber = useCallback((barcode: string) => {
    const cleaned = barcodeService.cleanBarcode(barcode);
    const format = barcodeService.detectFormat(cleaned);

    if (format === 'INTERNAL') {
      return barcodeService.extractSequenceNumber(cleaned);
    }
    return null;
  }, []);

  // Format barcode for display
  const formatForDisplay = useCallback((barcode: string) => {
    const cleaned = barcodeService.cleanBarcode(barcode);
    return barcodeService.formatBarcodeForDisplay(cleaned);
  }, []);

  // Check for duplicates in history
  const isDuplicate = useCallback(
    (barcode: string, timeWindow = 5000) => {
      const cleaned = barcodeService.cleanBarcode(barcode);
      const now = Date.now();

      return state.history.some(
        (item) =>
          item.barcode === cleaned &&
          now - item.timestamp < timeWindow
      );
    },
    [state.history]
  );

  // Get last scanned barcode
  const getLastScanned = useCallback(() => {
    return state.lastScanned;
  }, [state.lastScanned]);

  // Get barcode history
  const getHistory = useCallback(() => {
    return state.history;
  }, [state.history]);

  // Clear history
  const clearHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      history: [],
      lastScanned: null,
      lastBarcodeInfo: null,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Find similar barcodes (for typo detection)
  const findSimilar = useCallback(
    (barcode: string, tolerance = 2) => {
      const cleaned = barcodeService.cleanBarcode(barcode);

      return state.history.filter((item) => {
        if (item.barcode === cleaned) return false;

        // Simple Levenshtein distance
        let distance = 0;
        const maxLen = Math.max(item.barcode.length, cleaned.length);

        for (let i = 0; i < maxLen; i++) {
          if (item.barcode[i] !== cleaned[i]) {
            distance++;
          }
        }

        return distance <= tolerance;
      });
    },
    [state.history]
  );

  // Debounced validation (to avoid rapid duplicate scans)
  const validateDebounced = useCallback(
    (barcode: string, delay = 500) => {
      return new Promise<BarcodeInfo | null>((resolve) => {
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }

        scanTimeoutRef.current = setTimeout(async () => {
          const result = await validateBarcode(barcode);
          resolve(result);
        }, delay);
      });
    },
    [validateBarcode]
  );

  // Get statistics
  const getStats = useCallback(() => {
    const total = state.history.length;
    const valid = state.history.filter((h) => h.isValid).length;
    const invalid = total - valid;

    const formats = state.history.reduce(
      (acc, item) => {
        acc[item.format] = (acc[item.format] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total,
      valid,
      invalid,
      validPercentage: total > 0 ? Math.round((valid / total) * 100) : 0,
      formats,
    };
  }, [state.history]);

  return {
    // State
    lastScanned: state.lastScanned,
    lastBarcodeInfo: state.lastBarcodeInfo,
    isValidating: state.isValidating,
    error: state.error,
    history: state.history,
    // Methods
    validateBarcode,
    validateMultiple,
    validateDebounced,
    detectFormat,
    extractEpicerieId,
    extractSequenceNumber,
    formatForDisplay,
    isDuplicate,
    getLastScanned,
    getHistory,
    clearHistory,
    clearError,
    findSimilar,
    getStats,
  };
};
