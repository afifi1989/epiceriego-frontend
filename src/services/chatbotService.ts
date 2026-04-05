import api from './api';

/**
 * Service for AI chatbot to parse natural language messages and extract products
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export interface ParsedProduct {
  productName: string;
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
   * Parse a natural language message to extract products
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
        minimumConfidence: 0.5,
        maxSuggestions: 3,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error parsing message:', error);
      throw new Error(error.response?.data?.message || 'Erreur lors de l\'analyse du message');
    }
  },

  /**
   * Generate a response message for the user based on parsing results
   */
  generateResponseMessage: (response: ChatbotResponse): string => {
    if (response.parsingStatus === 'FAILED') {
      return `Désolé, je n'ai pas pu analyser votre message. ${response.errorMessage || 'Veuillez réessayer.'}`;
    }

    if (response.parsingStatus === 'NO_PRODUCTS') {
      return "Je n'ai détecté aucun produit dans votre message. Pouvez-vous préciser ce que vous souhaitez commander ? Par exemple : '1kg de pommes et 2 bouteilles de lait'";
    }

    let message = '';

    // Produits identifiés
    if (response.matchedCount > 0) {
      message += `✅ J'ai trouvé ${response.matchedCount} produit(s) :\n\n`;
      response.produitsIdentifies.forEach((product, index) => {
        message += `${index + 1}. **${product.matchedProductName}** (${product.matchedUnitLabel}) - ${product.matchedPrice?.toFixed(2)} DH\n`;
        message += `   Quantité : ${product.quantity} ${product.unit}\n`;
        if (product.matchedStock !== undefined) {
          message += `   Stock : ${product.matchedStock}\n`;
        }
        message += '\n';
      });
    }

    // Produits non identifiés
    if (response.unmatchedCount > 0) {
      message += `\n❓ Je n'ai pas trouvé ${response.unmatchedCount} produit(s) :\n\n`;
      response.produitsNonIdentifies.forEach((product, index) => {
        message += `${index + 1}. "${product.productName}" (${product.quantity} ${product.unit})\n`;
      });

      // Suggestions
      if (response.suggestions && response.suggestions.length > 0) {
        message += '\n💡 Suggestions :\n\n';
        response.suggestions.forEach((suggestion) => {
          message += `Pour "${suggestion.searchedProductName}" :\n`;
          suggestion.options.slice(0, 2).forEach((option, idx) => {
            message += `  ${idx + 1}. ${option.productName} (${option.unitLabel}) - ${option.price.toFixed(2)} DH\n`;
          });
          message += '\n';
        });
      }
    }

    if (response.matchedCount > 0) {
      message += '\n📦 Voulez-vous ajouter ces produits au panier ?';
    }

    return message.trim();
  },
};
