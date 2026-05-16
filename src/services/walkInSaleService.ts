import api from './api';

/**
 * Walk-in (client de passage) sale client.
 *
 * <p>Mirrors {@code com.epiceriego.walkin.dto.WalkInSaleRequest} on the backend.
 * Same wrapError pattern as chatbotService / loyaltyCardService — errors carry
 * a stable {@code errorCode} from {@code WalkInErrorCodes} so the UI can
 * resolve a localized label via {@code t('walkIn.error.<CODE>')}.
 *
 * <p>The endpoint never receives a {@code clientId}: the backend resolves the
 * per-épicerie placeholder user itself via {@code WalkInClientService}.
 * Passing {@code receiptEmail} or {@code receiptPhone} is optional — when
 * either is set, the backend stores it on the order for a future digital
 * receipt job (paper receipt is always printable as today).
 */

export interface WalkInOrderItemRequest {
  productId: number;
  quantite: number;
  /** Optional: variant id when the product has multiple sellable units. */
  unitId?: number;
  /** Optional: continuous quantity for weight-based units (e.g. 0.5 kg). */
  requestedQuantity?: number;
}

/**
 * Mirror of {@code com.epiceriego.payment.model.PaymentMethod} on the backend.
 *
 * <p>The full enum (including {@code CLIENT_ACCOUNT}) is exposed so this DTO
 * stays compatible with the shared POS payment types. The walk-in endpoint
 * <em>rejects</em> {@code CLIENT_ACCOUNT} server-side (a passant has no credit
 * account) — this is a business rule, not a type rule. Callers must filter
 * those lines out before submitting in walk-in mode.
 */
export type WalkInPaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'CLIENT_ACCOUNT';

export interface WalkInPaymentLineRequest {
  method: WalkInPaymentMethod;
  amount: number;
  receivedAmount?: number;
  reference?: string;
  notes?: string;
}

export interface WalkInSaleRequest {
  items: WalkInOrderItemRequest[];
  /** CASH | CARD | MOBILE — CLIENT_ACCOUNT is rejected by the backend. */
  paymentMethod?: string;
  payments?: WalkInPaymentLineRequest[];
  notes?: string;
  receiptEmail?: string;
  receiptPhone?: string;
}

export interface WalkInSaleError extends Error {
  errorCode: string;
  status?: number;
}

const wrapError = (error: any, fallbackCode: string): WalkInSaleError => {
  // The backend wraps the code at the end of the message: "...[CODE]". Try to
  // pull it out so the UI can localize. Fallback to generic code otherwise.
  const raw = error?.response?.data?.message || error?.message || '';
  const match = /\[([A-Z_]+)\]\s*$/.exec(raw);
  const code = match ? match[1] : fallbackCode;
  const wrapped = new Error(raw || code) as WalkInSaleError;
  wrapped.errorCode = code;
  wrapped.status = error?.response?.status;
  return wrapped;
};

export const walkInSaleService = {
  /**
   * Submit a walk-in sale. Returns the order DTO created by the backend
   * (same shape as a regular direct sale — only the client id differs,
   * pointing at the placeholder user).
   */
  createSale: async (request: WalkInSaleRequest): Promise<any> => {
    try {
      const response = await api.post('/orders/walk-in-sale', request);
      return response.data;
    } catch (error: any) {
      console.error('[walkInSale] failed', error);
      throw wrapError(error, 'WALK_IN_ERROR');
    }
  },
};
