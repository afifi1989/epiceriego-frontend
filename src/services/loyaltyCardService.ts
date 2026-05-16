import api from './api';

/**
 * Service for the dematerialized loyalty card feature.
 *
 * <p>Mirrors the backend contract defined in
 * {@code com.epiceriego.loyalty.card.LoyaltyCardController}. Errors are
 * surfaced as {@link Error} instances whose {@code errorCode} property is one
 * of the stable codes from the backend's {@code LoyaltyCardErrorCodes} —
 * callers should resolve the user-facing label via
 * {@code t('cards.error.<CODE>')} rather than reading the raw message.
 *
 * <p>Same convention as {@code chatbotService} so consumers can reuse the
 * same error-handling shape across features.
 */

/** DTO mirror of {@code com.epiceriego.loyalty.card.dto.LoyaltyCardScanResponse}.
 *  Used when the épicier-side app resolves a customer from a scanned QR. */
export interface LoyaltyCardScanResult {
  clientId: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  relationId: number;
  allowCredit: boolean;
  /** Backend BigDecimal serialized as number; null = unlimited (when allowCredit). */
  creditLimit: number | null;
}

/** DTO mirror of {@code com.epiceriego.loyalty.card.dto.LoyaltyCardDTO}. */
export interface LoyaltyCard {
  relationId: number;
  epicerieId: number;
  epicerieName: string;
  epicerieLogoUrl?: string | null;
  /** ISO-8601 string from LocalDateTime — render with locale-aware formatter. */
  issuedAt: string;
  active: boolean;
  /** Signed JWT to encode in the QR. Null when {@code active} is false. */
  qrToken?: string | null;
  /** Epoch millis for absolute expiry — easier than parsing the JWT in JS. */
  qrExpiresAt?: number | null;
}

export interface LoyaltyCardError extends Error {
  errorCode: string;
  status?: number;
}

const wrapError = (error: any, fallbackCode: string): LoyaltyCardError => {
  const code = error?.response?.data?.errorCode || fallbackCode;
  const message = error?.response?.data?.message || error?.message || code;
  const wrapped = new Error(message) as LoyaltyCardError;
  wrapped.errorCode = code;
  wrapped.status = error?.response?.status;
  return wrapped;
};

export const loyaltyCardService = {
  /**
   * Fetch every active loyalty card for the authenticated client.
   * Empty array is a normal state for a brand-new account, not an error.
   */
  getMyCards: async (): Promise<LoyaltyCard[]> => {
    try {
      const response = await api.get<LoyaltyCard[]>('/me/loyalty-cards');
      return response.data;
    } catch (error: any) {
      console.error('[loyaltyCard] getMyCards failed', error);
      throw wrapError(error, 'LOYALTY_CARD_ERROR');
    }
  },

  /**
   * Re-issue the QR for one card. Used after the cached QR aged past 24h.
   * A {@code CARD_REVOKED} response means the card should be removed from
   * the local list — the relation no longer exists server-side.
   */
  refreshQr: async (epicerieId: number): Promise<LoyaltyCard> => {
    try {
      const response = await api.post<LoyaltyCard>(
        `/me/loyalty-cards/${epicerieId}/refresh-qr`,
      );
      return response.data;
    } catch (error: any) {
      console.error('[loyaltyCard] refreshQr failed', error);
      throw wrapError(error, 'LOYALTY_CARD_ERROR');
    }
  },

  /**
   * Resolve a scanned QR (épicier-side). The backend performs every security
   * check — signature, expiry, store match, relation still ACCEPTED, caller
   * authorisation — so a successful response means the customer is safe to
   * autoselect at the till.
   *
   * <p>Errors carry one of the {@code LoyaltyCardErrorCodes} values:
   * SIGNATURE_INVALID / CARD_EXPIRED / CARD_WRONG_EPICERIE / CARD_REVOKED /
   * CARD_INVALID_TYPE / NOT_AUTHORIZED.
   */
  scanCard: async (epicerieId: number, qrToken: string): Promise<LoyaltyCardScanResult> => {
    try {
      const response = await api.post<LoyaltyCardScanResult>(
        `/epiceries/${epicerieId}/loyalty-cards/scan`,
        { qrToken },
      );
      return response.data;
    } catch (error: any) {
      console.error('[loyaltyCard] scan failed', error);
      throw wrapError(error, 'LOYALTY_CARD_ERROR');
    }
  },
};

/**
 * Compute remaining minutes until expiry. Returns 0 when expired and null
 * when {@code qrExpiresAt} is missing (card is inactive).
 */
export const minutesUntilExpiry = (qrExpiresAt?: number | null): number | null => {
  if (!qrExpiresAt) return null;
  const ms = qrExpiresAt - Date.now();
  if (ms <= 0) return 0;
  return Math.floor(ms / 60_000);
};
