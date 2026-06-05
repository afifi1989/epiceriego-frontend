import api from './api';

/**
 * Service for AI chatbot to parse natural language messages and extract products.
 *
 * Localization contract: this service does NOT own translation strings. The
 * caller passes a `t` function (from useLanguage) so that all assistant-facing
 * text honors the user's chosen language. Backend response codes (parsingStatus,
 * errorCode) are mapped to translation keys via the chatbot.status / chatbot.error
 * sections in src/i18n/translations.ts (kept in sync with the backend
 * ParsingStatusCodes / ParsingErrorCodes constants).
 */

/** Translator function shape — matches useLanguage().t */
export type Translator = (key: string) => string;

/**
 * Substitute {{name}} placeholders in a template. Lightweight; we don't depend
 * on a full i18n framework yet, and the placeholder set is closed (defined in
 * translations.ts), so a 5-line replace is enough.
 */
export const interpolate = (template: string, params: Record<string, string | number> = {}): string => {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
};

/** Translate then interpolate. The two-step is exported so consumers (e.g. ChatbotModal)
 *  can reuse the same formatting logic without re-implementing the helper. */
export const tFmt = (t: Translator, key: string, params?: Record<string, string | number>): string => {
  return interpolate(t(key), params);
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export interface VariantOption {
  unitId: number;
  label: string;
  price: number;
  stock: number;
  /** URL absolue résolue côté backend (fallback sur la photo du produit parent). */
  photoUrl?: string;
}

export interface ProductOption {
  productId: number;
  productUnitId?: number;
  productName: string;
  brandName?: string;
  unitLabel?: string;
  price: number;
  stock: number;
  score?: number;
  /** URL absolue résolue côté backend. */
  photoUrl?: string;
}

export interface ParsedProduct {
  productName: string;
  brand?: string;
  quantity: number;
  unit: string;
  originalText?: string;
  confidence?: number;
  isMatched: boolean;
  matchedProductId?: number;
  matchedProductUnitId?: number;
  matchedProductName?: string;
  matchedUnitLabel?: string;
  matchedPrice?: number;
  matchedStock?: number;
  matchingConfidence?: number;
  /** URL absolue de la photo du produit/variante matché. Null = placeholder mobile. */
  matchedPhotoUrl?: string;
  hasMultipleVariants?: boolean;
  alternativeUnits?: VariantOption[];
  // Inter-product ambiguity (e.g. "huile" → Afia / Lesieur / Carapelli)
  hasMultipleProducts?: boolean;
  productOptions?: ProductOption[];
  ambiguityHint?: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface ProductSuggestion {
  searchedProductName: string;
  extractedUnit?: string;
  extractedQuantity?: number;
  options: Array<{
    productId: number;
    productUnitId: number;
    productName: string;
    unitLabel: string;
    price: number;
    stock: number;
    similarity: number;
    reason: string;
    /** URL absolue résolue côté backend. */
    photoUrl?: string;
  }>;
  message: string;
}

export interface ChatbotResponse {
  commandeId: number;
  originalMessage: string;
  parsedAt: string;
  parsingStatus: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'PARTIAL_FAILURE' | 'NO_PRODUCTS' | 'FAILED';
  message: string;
  produitsIdentifies: ParsedProduct[];
  produitsNonIdentifies: ParsedProduct[];
  suggestions: ProductSuggestion[];
  totalItemsExtracted: number;
  matchedCount: number;
  unmatchedCount: number;
  overallConfidence: number;
  processingTimeMs?: number;
  errorMessage?: string;
  errorCode?: string;
}

export const chatbotService = {
  /**
   * Parse a natural language message to extract products.
   *
   * @param language ISO code (fr/ar/en/tz). Drives the backend prompt strategy
   *                 and the localization of returned product names.
   */
  parseMessage: async (
    messageContent: string,
    epicerieId: number,
    clientId: number,
    language: string = 'fr'
  ): Promise<ChatbotResponse> => {
    try {
      const response = await api.post<ChatbotResponse>('/messages/parse', {
        messageContent,
        epicerieId,
        clientId,
        language,
        minimumConfidence: 0.3,
        maxSuggestions: 5,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error parsing message:', error);
      // Surface the backend errorCode when available so the UI can resolve a
      // localized label via t(`chatbot.error.${code}`); fall back to a stable
      // sentinel that the UI translates as a generic parse error.
      const code = error.response?.data?.errorCode || 'PARSING_ERROR';
      const err = new Error(code);
      (err as any).errorCode = code;
      throw err;
    }
  },

  /**
   * Build the assistant-facing reply from a parsing response.
   *
   * <p>The translator is injected so the caller (ChatbotModal) controls the
   * language. All user-visible text comes from the chatbot.* translation keys;
   * structural data (counts, prices, names) stays as-is. Currency token comes
   * from chatbot.currency to keep the formatting locale-friendly.
   */
  generateResponseMessage: (response: ChatbotResponse, t: Translator): string => {
    if (response.parsingStatus === 'FAILED') {
      const detail = response.errorCode
        ? t(`chatbot.error.${response.errorCode}`)
        : (response.errorMessage || '');
      return tFmt(t, 'chatbot.status.FAILED', { error: detail }).trim();
    }

    if (response.parsingStatus === 'NO_PRODUCTS') {
      return t('chatbot.status.NO_PRODUCTS');
    }

    const currency = t('chatbot.currency');
    let message = '';

    // Identified products
    if (response.matchedCount > 0) {
      message += tFmt(t, 'chatbot.generated.foundProducts', { count: response.matchedCount });
      response.produitsIdentifies.forEach((product, index) => {
        message += tFmt(t, 'chatbot.generated.productLine', {
          index: index + 1,
          name: product.matchedProductName ?? '',
          unitLabel: product.matchedUnitLabel ?? '',
          price: product.matchedPrice?.toFixed(2) ?? '',
          currency,
        });
        message += tFmt(t, 'chatbot.generated.quantityLine', {
          quantity: product.quantity,
          unit: product.unit,
        });
        if (product.matchedStock !== undefined) {
          message += tFmt(t, 'chatbot.generated.stockLine', { stock: product.matchedStock });
        }
        if (product.hasMultipleVariants && product.alternativeUnits && product.alternativeUnits.length > 1) {
          message += t('chatbot.generated.multipleVariants');
          product.alternativeUnits.forEach((variant, vIdx) => {
            message += tFmt(t, 'chatbot.generated.variantLine', {
              index: vIdx + 1,
              label: variant.label,
              price: variant.price.toFixed(2),
              currency,
            });
          });
          message += t('chatbot.generated.selectVariantHint');
        }
        message += '\n';
      });
    }

    // Inter-product ambiguity (e.g. "huile" matches Afia + Lesieur + Carapelli)
    const ambiguousProducts = response.produitsNonIdentifies.filter(
      (p) => p.hasMultipleProducts && p.productOptions && p.productOptions.length > 1
    );
    const trulyUnmatched = response.produitsNonIdentifies.filter(
      (p) => !p.hasMultipleProducts
    );

    if (ambiguousProducts.length > 0) {
      ambiguousProducts.forEach((amb) => {
        message += tFmt(t, 'chatbot.generated.productAmbiguityHeader', { name: amb.productName });
        amb.productOptions!.forEach((opt, idx) => {
          const brandSuffix =
            opt.brandName && !opt.productName.toLowerCase().includes(opt.brandName.toLowerCase())
              ? ` (${opt.brandName})`
              : '';
          const unitSuffix = opt.unitLabel ? ` — ${opt.unitLabel}` : '';
          message += tFmt(t, 'chatbot.generated.productAmbiguityLine', {
            index: idx + 1,
            name: opt.productName,
            brand: brandSuffix,
            unit: unitSuffix,
            price: opt.price.toFixed(2),
            currency,
          });
        });
        // Backend ambiguityHint is FR; prefer it when present so the épicier can
        // craft a custom hint, otherwise fall back to the localized default.
        const hint = amb.ambiguityHint || t('chatbot.generated.productAmbiguityHintDefault');
        message += `\n${hint}\n`;
      });
    }

    // Truly unmatched products
    if (trulyUnmatched.length > 0) {
      message += tFmt(t, 'chatbot.generated.notFoundHeader', { count: trulyUnmatched.length });
      trulyUnmatched.forEach((product, index) => {
        message += tFmt(t, 'chatbot.generated.notFoundLine', {
          index: index + 1,
          name: product.productName,
          quantity: product.quantity,
          unit: product.unit,
        });
      });

      if (response.suggestions && response.suggestions.length > 0) {
        message += t('chatbot.generated.suggestionsHint');
      }
    }

    if (response.matchedCount > 0) {
      message += t('chatbot.generated.addToCartHint');
    }

    return message.trim();
  },
};
