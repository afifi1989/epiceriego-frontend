import api from './api';

/**
 * Walk-in to virtual client conversion (épicier side).
 *
 * <p>Mirrors {@code com.epiceriego.walkin.WalkInConversionController} on the
 * backend. The two operations are intentionally separate from
 * {@code walkInSaleService} (which handles the *creation* of anonymous sales)
 * — converting a recurring passant to a real client is a different user
 * journey, surfaces different UI, and uses different permissions
 * (CLIENT_VIEW for read, CLIENT_INVITE for write).
 */

export interface WalkInConversionSuggestion {
  receiptEmail: string;
  /** Number of non-cancelled walk-in orders carrying this email. */
  orderCount: number;
  /** Cumulative revenue of those orders (currency snapshot per order). */
  totalSpent: number;
  /** ISO-8601 of the most recent walk-in order — sorts more relevant
   *  customers first and lets the UI age the suggestions. */
  lastSeenAt: string;
}

export interface ConvertWalkInRequest {
  receiptEmail: string;
  name: string;
  phone?: string;
}

export interface ConvertWalkInResult {
  clientId: number;
  relationId: number;
  /** How many past walk-in orders were re-attributed to the new client. */
  ordersTransferred: number;
}

export const walkInConversionService = {
  /**
   * List recurring anonymous customers (≥ minCount walk-in orders sharing
   * the same receipt email). Default threshold matches the backend (3).
   */
  getSuggestions: async (
    epicerieId: number,
    minCount?: number,
  ): Promise<WalkInConversionSuggestion[]> => {
    try {
      const url = `/epiceries/${epicerieId}/walk-in-suggestions`;
      const params = minCount != null ? { minCount } : undefined;
      const response = await api.get<WalkInConversionSuggestion[]>(url, { params });
      return response.data;
    } catch (error: any) {
      console.error('[walkInConversion] getSuggestions failed', error);
      throw new Error(
        error?.response?.data?.message ||
          'Impossible de charger les suggestions de conversion',
      );
    }
  },

  /**
   * Promote a recurring walk-in customer to a virtual client. The backend
   * creates the {@code ClientEpicerie ACCEPTED} relation and re-attributes
   * past walk-in orders carrying the same email to the new client.
   */
  convert: async (
    epicerieId: number,
    request: ConvertWalkInRequest,
  ): Promise<ConvertWalkInResult> => {
    try {
      const url = `/epiceries/${epicerieId}/walk-in-conversions`;
      const response = await api.post<ConvertWalkInResult>(url, request);
      return response.data;
    } catch (error: any) {
      console.error('[walkInConversion] convert failed', error);
      throw new Error(
        error?.response?.data?.message ||
          'Impossible de convertir ce passant en client',
      );
    }
  },
};
