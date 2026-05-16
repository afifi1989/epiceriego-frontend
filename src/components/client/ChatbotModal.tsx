import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatMessage } from './ChatMessage';
import {
  chatbotService,
  ChatMessage as ChatMessageType,
  ChatbotResponse,
  ParsedProduct,
  ProductOption,
  ProductSuggestion,
  tFmt,
} from '../../services/chatbotService';
import { useLanguage } from '../../context/LanguageContext';

type SuggestionOption = ProductSuggestion['options'][number];

interface ChatbotModalProps {
  visible: boolean;
  epicerieId: number;
  epicerieName: string;
  clientId: number;
  onClose: () => void;
  onAddToCart: (products: ParsedProduct[]) => void;
}

export const ChatbotModal: React.FC<ChatbotModalProps> = ({
  visible,
  epicerieId,
  epicerieName,
  clientId,
  onClose,
  onAddToCart,
}) => {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<ChatbotResponse | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const currency = t('chatbot.currency');

  // Initialize with welcome message
  useEffect(() => {
    if (visible && messages.length === 0) {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: tFmt(t, 'chatbot.welcome', { epicerieName }),
        timestamp: new Date(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, epicerieName, language]);

  // Add a message to the chat
  const addMessage = (message: ChatMessageType) => {
    setMessages((prev) => [...prev, message]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Send user message
  const handleSend = async () => {
    if (inputText.trim() === '' || isLoading) {
      return;
    }

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    setIsLoading(true);

    try {
      // Parse message with AI — pass the user's chosen language so the backend
      // applies the matching prompt strategy and localizes returned product names.
      const response = await chatbotService.parseMessage(
        userMessage,
        epicerieId,
        clientId,
        language,
      );

      setLastResponse(response);

      // Generate and add assistant response (uses translator injected from context)
      const assistantMessage = chatbotService.generateResponseMessage(response, t);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      });

    } catch (error: any) {
      console.error('Error in chatbot:', error);
      // parseMessage throws an Error whose message is a stable errorCode (see
      // chatbotService.parseMessage). Resolve it to a localized label.
      const errorCode = error.errorCode || error.message || 'PARSING_ERROR';
      const localizedDetail = t(`chatbot.error.${errorCode}`);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: tFmt(t, 'chatbot.genericError', { message: localizedDetail }),
        timestamp: new Date(),
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add products to cart
  const handleAddToCart = () => {
    if (!lastResponse || lastResponse.produitsIdentifies.length === 0) {
      Alert.alert(t('chatbot.noProducts'), t('chatbot.noProductsToAdd'));
      return;
    }

    const count = lastResponse.produitsIdentifies.length;
    Alert.alert(
      t('chatbot.addToCartTitle'),
      tFmt(t, 'chatbot.addToCartConfirm', { count }),
      [
        { text: t('chatbot.addToCartCancel'), style: 'cancel' },
        {
          text: t('chatbot.addToCartConfirmButton'),
          onPress: () => {
            onAddToCart(lastResponse.produitsIdentifies);
            addMessage({
              id: (Date.now() + 2).toString(),
              role: 'assistant',
              content: tFmt(t, 'chatbot.addedToCart', { count }),
              timestamp: new Date(),
            });
            setLastResponse(null);
          },
        },
      ]
    );
  };

  // Resolve an inter-product ambiguity: the client tapped one of the proposed options.
  // Promote the chosen option into produitsIdentifies and remove the ambiguous entry
  // from produitsNonIdentifies, so the "Add to cart" button can pick it up.
  const handleResolveProductChoice = (ambiguous: ParsedProduct, option: ProductOption) => {
    if (!lastResponse) return;

    const resolved: ParsedProduct = {
      ...ambiguous,
      isMatched: true,
      hasMultipleProducts: false,
      productOptions: undefined,
      matchedProductId: option.productId,
      matchedProductUnitId: option.productUnitId,
      matchedProductName: option.productName,
      matchedUnitLabel: option.unitLabel,
      matchedPrice: option.price,
      matchedStock: option.stock,
    };

    const updatedIdentified = [...lastResponse.produitsIdentifies, resolved];
    const updatedUnmatched = lastResponse.produitsNonIdentifies.filter((p) => p !== ambiguous);

    setLastResponse({
      ...lastResponse,
      produitsIdentifies: updatedIdentified,
      produitsNonIdentifies: updatedUnmatched,
      matchedCount: updatedIdentified.length,
      unmatchedCount: updatedUnmatched.filter((p) => !p.hasMultipleProducts).length,
    });

    addMessage({
      id: (Date.now() + 3).toString(),
      role: 'assistant',
      content: tFmt(t, 'chatbot.itemSelected', {
        name: option.productName,
        unitSuffix: option.unitLabel ? ` (${option.unitLabel})` : '',
      }),
      timestamp: new Date(),
    });
  };

  // Resolve a suggestion: client tapped one of the proposed alternatives for an unmatched product.
  const handleResolveSuggestion = (
    suggestion: ProductSuggestion,
    option: SuggestionOption,
  ) => {
    if (!lastResponse) return;

    const target = lastResponse.produitsNonIdentifies.find(
      (p) =>
        p.productName.trim().toLowerCase() ===
        suggestion.searchedProductName.trim().toLowerCase(),
    );
    if (!target) return;

    const resolved: ParsedProduct = {
      ...target,
      isMatched: true,
      hasMultipleProducts: false,
      productOptions: undefined,
      matchedProductId: option.productId,
      matchedProductUnitId: option.productUnitId,
      matchedProductName: option.productName,
      matchedUnitLabel: option.unitLabel,
      matchedPrice: option.price,
      matchedStock: option.stock,
    };

    const updatedIdentified = [...lastResponse.produitsIdentifies, resolved];
    const updatedUnmatched = lastResponse.produitsNonIdentifies.filter((p) => p !== target);
    const updatedSuggestions = lastResponse.suggestions.filter((s) => s !== suggestion);

    setLastResponse({
      ...lastResponse,
      produitsIdentifies: updatedIdentified,
      produitsNonIdentifies: updatedUnmatched,
      suggestions: updatedSuggestions,
      matchedCount: updatedIdentified.length,
      unmatchedCount: updatedUnmatched.filter((p) => !p.hasMultipleProducts).length,
    });

    addMessage({
      id: (Date.now() + 4).toString(),
      role: 'assistant',
      content: tFmt(t, 'chatbot.itemSelected', {
        name: option.productName,
        unitSuffix: option.unitLabel ? ` (${option.unitLabel})` : '',
      }),
      timestamp: new Date(),
    });
  };

  // Clear chat
  const handleClearChat = () => {
    Alert.alert(
      t('chatbot.clearTitle'),
      t('chatbot.clearMessage'),
      [
        { text: t('chatbot.clearCancel'), style: 'cancel' },
        {
          text: t('chatbot.clearConfirm'),
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setLastResponse(null);
            // Re-add welcome message
            addMessage({
              id: Date.now().toString(),
              role: 'assistant',
              content: t('chatbot.newConversation'),
              timestamp: new Date(),
            });
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{tFmt(t, 'chatbot.headerTitle', { epicerieName })}</Text>
            <Text style={styles.headerSubtitle}>{t('chatbot.headerSubtitle')}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClearChat}
            >
              <Text style={styles.headerButtonText}>🗑️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onClose}
            >
              <Text style={styles.headerButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessage message={item} />}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.loadingText}>{t('chatbot.thinking')}</Text>
          </View>
        )}

        {/* Product-choice ambiguity resolver */}
        {lastResponse &&
          lastResponse.produitsNonIdentifies
            .filter((p) => p.hasMultipleProducts && p.productOptions && p.productOptions.length > 1)
            .map((ambiguous, ambIdx) => (
              <View key={`amb-${ambIdx}`} style={styles.ambiguityContainer}>
                <Text style={styles.ambiguityTitle}>
                  {tFmt(t, 'chatbot.ambiguityTitle', { name: ambiguous.productName })}
                </Text>
                {ambiguous.productOptions!.map((opt, optIdx) => {
                  const showBrand =
                    opt.brandName &&
                    !opt.productName.toLowerCase().includes(opt.brandName.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={`amb-${ambIdx}-opt-${optIdx}`}
                      style={styles.ambiguityOption}
                      onPress={() => handleResolveProductChoice(ambiguous, opt)}
                      disabled={isLoading}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ambiguityOptionName}>
                          {opt.productName}
                          {showBrand ? ` (${opt.brandName})` : ''}
                        </Text>
                        {opt.unitLabel ? (
                          <Text style={styles.ambiguityOptionUnit}>{opt.unitLabel}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.ambiguityOptionPrice}>
                        {opt.price.toFixed(2)} {currency}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {ambiguous.ambiguityHint ? (
                  <Text style={styles.ambiguityHint}>{ambiguous.ambiguityHint}</Text>
                ) : null}
              </View>
            ))}

        {/* Suggestions resolver — clickable alternatives for unmatched products */}
        {lastResponse &&
          lastResponse.suggestions &&
          lastResponse.suggestions
            .filter((s) => s.options && s.options.length > 0)
            .map((suggestion, sugIdx) => (
              <View key={`sug-${sugIdx}`} style={styles.suggestionsBlock}>
                <Text style={styles.suggestionsTitle}>
                  {tFmt(t, 'chatbot.suggestionsTitle', { name: suggestion.searchedProductName })}
                </Text>
                {suggestion.options.map((opt, optIdx) => (
                  <TouchableOpacity
                    key={`sug-${sugIdx}-opt-${optIdx}`}
                    style={styles.suggestionOption}
                    onPress={() => handleResolveSuggestion(suggestion, opt)}
                    disabled={isLoading}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionOptionName}>{opt.productName}</Text>
                      {opt.unitLabel ? (
                        <Text style={styles.suggestionOptionUnit}>{opt.unitLabel}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.suggestionOptionPrice}>
                      {opt.price.toFixed(2)} {currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

        {/* Add to cart button */}
        {lastResponse && lastResponse.produitsIdentifies.length > 0 && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={handleAddToCart}
            >
              <Text style={styles.addToCartText}>
                {tFmt(t, 'chatbot.addToCartButton', { count: lastResponse.produitsIdentifies.length })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={t('chatbot.inputPlaceholder')}
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (inputText.trim() === '' || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={inputText.trim() === '' || isLoading}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>

        {/* Suggestions */}
        <View style={[styles.suggestionsContainer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.suggestionChip}
            onPress={() => setInputText(t('chatbot.exampleText1'))}
            disabled={isLoading}
          >
            <Text style={styles.suggestionText}>{t('chatbot.exampleChip1')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.suggestionChip}
            onPress={() => setInputText(t('chatbot.exampleText2'))}
            disabled={isLoading}
          >
            <Text style={styles.suggestionText}>{t('chatbot.exampleChip2')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#4CAF50',
    borderBottomWidth: 1,
    borderBottomColor: '#45a049',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  messagesList: {
    paddingVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9F9F9',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  ambiguityContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF8E1',
    borderTopWidth: 1,
    borderTopColor: '#FFE082',
  },
  ambiguityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4037',
    marginBottom: 8,
  },
  ambiguityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FFB300',
  },
  ambiguityOptionName: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  ambiguityOptionUnit: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  ambiguityOptionPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F57C00',
    marginLeft: 8,
  },
  ambiguityHint: {
    fontSize: 12,
    color: '#6D4C41',
    fontStyle: 'italic',
    marginTop: 4,
  },
  addToCartButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  suggestionsBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
    borderTopWidth: 1,
    borderTopColor: '#A5D6A7',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B5E20',
    marginBottom: 8,
  },
  suggestionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#66BB6A',
  },
  suggestionOptionName: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  suggestionOptionUnit: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  suggestionOptionPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginLeft: 8,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  suggestionText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
});
