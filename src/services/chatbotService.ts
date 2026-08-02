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

/**
 * Alias d'unités — miroir de `ProductMatchingService.UNIT_NORMALIZATION`.
 * Ne sert qu'à retrouver l'unité canonique avant d'en déduire l'unité de base.
 */
const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg', kilogramme: 'kg', kilogrammes: 'kg', kgs: 'kg',
  g: 'g', gramme: 'g', grammes: 'g', gs: 'g',
  l: 'l', litre: 'l', litres: 'l',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl',
};

/**
 * Unité de base correspondant à une unité saisie — miroir EXACT de
 * `ProductMatchingService.convertToBaseQuantity` : g→kg, ml/cl→L, cm→m.
 * Toute unité hors barème (pièce, bouteille, boîte…) n'est pas convertie côté
 * backend, donc son libellé reste valide tel quel.
 */
const baseUnitLabel = (unit: string): string => {
  const normalized = UNIT_ALIASES[unit.toLowerCase().trim()] ?? unit.toLowerCase().trim();
  switch (normalized) {
    case 'g':
    case 'kg':
      return 'kg';
    case 'ml':
    case 'cl':
    case 'l':
      return 'L';
    case 'cm':
    case 'm':
      return 'm';
    default:
      return unit.trim();
  }
};

/** Nombre lisible : 3 décimales max (maille du stock backend), zéros inutiles retirés. */
const formatNumber = (value: number): string =>
  String(Math.round(value * 1000) / 1000);

/**
 * Couple (quantité, unité) COHÉRENT prêt à l'affichage.
 *
 * <p>C1 — le backend convertit `quantity` en unité de base pour tout item matché
 * mais laisse `unit` sur l'unité saisie : afficher les deux bruts annoncerait
 * « 0.5 g » pour 500 g (×1000 à l'envers). On réaligne donc l'unité sur la
 * valeur plutôt que l'inverse — « 0.5 kg », juste et lisible.</p>
 *
 * <p>Les items NON matchés n'ont jamais été convertis : on les rend tels quels
 * (« 500 g »). Passer TOUTES les listes par ce helper est ce qui garantit que
 * les items matchés et non matchés d'un même message ne se contredisent pas.</p>
 */
export const formatParsedQuantity = (
  product: Pick<ParsedProduct, 'quantity' | 'unit' | 'quantityInBaseUnit'>,
): { quantity: string; unit: string } => {
  const raw = Number(product?.quantity);
  const unit = (product?.unit ?? '').trim();
  if (!Number.isFinite(raw)) {
    return { quantity: '', unit };
  }
  return {
    quantity: formatNumber(raw),
    unit: product?.quantityInBaseUnit === true ? baseUnitLabel(unit) : unit,
  };
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
  /**
   * Quantité demandée. ATTENTION — l'unité dépend de {@link quantityInBaseUnit} :
   * - `quantityInBaseUnit === true`  → valeur en UNITÉ DE BASE catalogue (kg/L/m/pièces).
   *   « 500 g » vaut `0.5`. C'est le cas de tout item matché depuis l'audit C1.
   * - sinon → valeur brute telle que prononcée, exprimée dans {@link unit} (« 500 »).
   *
   * Ne jamais afficher cette valeur accolée à {@link unit} sans passer par
   * {@link formatParsedQuantity}, sous peine d'annoncer « 0.5 g » pour 500 g.
   */
  quantity: number;
  /**
   * Unité SAISIE par le client (« g », « ml », « bouteille »). Jamais réécrite
   * par le backend, même après conversion de {@link quantity} — elle reste la
   * trace de ce qui a été dit, pas l'unité de `quantity`.
   */
  unit: string;
  /**
   * C1 — `true` quand {@link quantity} a été convertie en unité de base par
   * `ProductMatchingService#matchProduct` (posé pour tout item matché, y compris
   * quand il n'y avait rien à convertir). Absent/`false` = quantité brute LLM.
   */
  quantityInBaseUnit?: boolean;
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
        // C1 — jamais `product.quantity` + `product.unit` bruts : pour un item
        // matché la quantité est en unité de base et l'unité est celle saisie.
        message += tFmt(t, 'chatbot.generated.quantityLine', formatParsedQuantity(product));
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
        // Même helper que la liste des matchés : les deux listes d'un même
        // message ne peuvent donc pas se contredire sur l'unité affichée.
        message += tFmt(t, 'chatbot.generated.notFoundLine', {
          index: index + 1,
          name: product.productName,
          ...formatParsedQuantity(product),
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
