import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { API_CONFIG, STORAGE_KEYS } from '../../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cartService } from '../../services/cartService';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ParsedProduct {
  matchedProductId: number;
  matchedProductUnitId: number | null;
  productName: string;
  matchedProductName: string;
  quantity: number;
  unit: string;
  matchedPrice: number;
  matchedStock: number;
  matchingConfidence: number;
  isMatched: boolean;
}

interface ChatProps {
  epicerieId: number;
  visible: boolean;
  onClose: () => void;
  onProductsAdded?: (products: ParsedProduct[]) => void;
}

export function AIChat({ epicerieId, visible, onClose, onProductsAdded }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      type: 'assistant',
      content: 'Bonjour! 👋 Décrivez les produits que vous souhaitez et je vais les identifier pour vous. Par exemple: "Je voudrais 1kg de pommes et 2L de lait"',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ParsedProduct[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [token, setToken] = useState<string>('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const getToken = async () => {
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      if (savedToken) {
        setToken(savedToken);
      }
    };
    getToken();
  }, []);

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const keyboardHeight = e.endCoordinates.height;
        setKeyboardHeight(keyboardHeight);

        // Animate input area up
        Animated.timing(translateY, {
          toValue: -keyboardHeight,
          duration: 250,
          useNativeDriver: true,
        }).start();

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
    );

    const keyboardDidHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        // Animate input area back down
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      },
    );

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, [translateY]);

  const parseMessage = async (messageContent: string) => {
    if (!messageContent.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }

    if (!token) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/messages/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messageContent: messageContent,
          epicerieId: epicerieId,
          language: 'fr',
          minimumConfidence: 0.5,
          maxSuggestions: 3,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de l\'analyse');
      }

      const result = await response.json();
      console.log('[AIChat] Parse result:', result);

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: messageContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Process results
      let assistantResponse = '';
      const productsToAdd: ParsedProduct[] = [];

      if (result.parsingStatus === 'SUCCESS') {
        assistantResponse = `✅ ${result.message}\n\n`;
        result.produitsIdentifies.forEach((product: ParsedProduct) => {
          if (product.isMatched) {
            assistantResponse += `✓ ${product.matchedProductName} - ${product.quantity}${product.unit} - €${product.matchedPrice}\n`;
            productsToAdd.push(product);
          }
        });
      } else if (result.parsingStatus === 'PARTIAL_SUCCESS') {
        assistantResponse = `⚠️ ${result.message}\n\n`;

        if (result.produitsIdentifies.length > 0) {
          assistantResponse += 'Produits trouvés:\n';
          result.produitsIdentifies.forEach((product: ParsedProduct) => {
            if (product.isMatched) {
              assistantResponse += `✓ ${product.matchedProductName} - ${product.quantity}${product.unit} - €${product.matchedPrice}\n`;
              productsToAdd.push(product);
            }
          });
        }

        if (result.produitsNonIdentifies.length > 0) {
          assistantResponse += '\nProduits non trouvés:\n';
          result.produitsNonIdentifies.forEach((product: any) => {
            assistantResponse += `✗ ${product.productName}\n`;
          });
        }

        if (result.suggestions && result.suggestions.length > 0) {
          assistantResponse += '\nSuggestions:\n';
          result.suggestions.forEach((suggestion: any) => {
            suggestion.options.forEach((option: any) => {
              assistantResponse += `• ${option.productName} (${option.unitLabel}) - €${option.price}\n`;
            });
          });
        }
      } else {
        assistantResponse = `⚠️ Les produits recherchés ne sont pas disponibles dans cette épicerie pour le moment.\n\n${result.message}`;
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: assistantResponse.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update selected products
      console.log('[AIChat] Produits à ajouter à selectedProducts:', productsToAdd);
      console.log('[AIChat] productsToAdd length:', productsToAdd.length);
      productsToAdd.forEach((p, i) => {
        console.log(`[AIChat] Produit ${i}:`, {
          matchedProductId: p.matchedProductId,
          matchedProductUnitId: p.matchedProductUnitId,
          matchedProductName: p.matchedProductName,
        });
      });

      setSelectedProducts((prev) => [...prev, ...productsToAdd]);

      setInputText('');

      // Auto scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('[AIChat] Error:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `❌ Erreur: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (selectedProducts.length === 0) {
      Alert.alert('Info', 'Aucun produit sélectionné');
      return;
    }

    try {
      console.log('[AIChat.handleAddToCart] Ajout de', selectedProducts.length, 'produits');
      console.log('[AIChat.handleAddToCart] Produits sélectionnés complets:', JSON.stringify(selectedProducts, null, 2));

      for (let i = 0; i < selectedProducts.length; i++) {
        const product = selectedProducts[i];
        console.log(`\n[AIChat.handleAddToCart] ========== PRODUIT ${i} ==========`);
        console.log(`  matchedProductId: ${product.matchedProductId}`);
        console.log(`  matchedProductUnitId: ${product.matchedProductUnitId}`);
        console.log(`  matchedProductName: ${product.matchedProductName}`);
        console.log(`  productName: ${product.productName}`);
        console.log(`  matchedPrice: ${product.matchedPrice}`);
        console.log(`  unit: ${product.unit}`);

        const cartItem = {
          productId: product.matchedProductId,
          productNom: product.matchedProductName,
          epicerieId: epicerieId,
          quantity: 1,
          unitId: product.matchedProductUnitId ?? undefined,
          unitLabel: product.unit,
          pricePerUnit: product.matchedPrice,
          totalPrice: product.matchedPrice,
          photoUrl: undefined,
        };

        console.log(`[AIChat.handleAddToCart] CartItem complet:`, JSON.stringify(cartItem, null, 2));
        await cartService.addToCart(cartItem);
        console.log(`[AIChat.handleAddToCart] ✅ Produit ${i} ajouté`);
      }

      Alert.alert(
        'Succès',
        `${selectedProducts.length} produit(s) ajouté(s) au panier`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedProducts([]);
              onClose();
              onProductsAdded?.(selectedProducts);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Erreur', `Impossible d'ajouter au panier: ${error.message}`);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.type === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Text style={[styles.messageText, item.type === 'user' && styles.userMessageText]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat IA - Assistance Produits 🤖</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Selected Products */}
        {selectedProducts.length > 0 && (
          <View style={styles.selectedProductsContainer}>
            <Text style={styles.selectedProductsTitle}>
              Produits sélectionnés ({selectedProducts.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedProducts.map((product, index) => (
                <View key={index} style={styles.selectedProductChip}>
                  <Text style={styles.selectedProductChipText}>
                    {product.matchedProductName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedProducts((prev) => prev.filter((_, i) => i !== index));
                    }}
                  >
                    <Text style={styles.removeProductButton}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Add to Cart Button */}
        {selectedProducts.length > 0 && (
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={handleAddToCart}
          >
            <Text style={styles.addToCartButtonText}>
              ✅ Ajouter {selectedProducts.length} produit(s) au panier
            </Text>
          </TouchableOpacity>
        )}

        {/* Input Area with Animation */}
        <Animated.View
          style={[
            styles.inputAreaWrapper,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Décrivez les produits que vous voulez..."
              placeholderTextColor="#333"
              value={inputText}
              onChangeText={setInputText}
              editable={!isLoading}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
              onPress={() => parseMessage(inputText)}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>Envoyer 📤</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 40,
    paddingBottom: 20,
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 15,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '85%',
    borderRadius: 12,
    padding: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  selectedProductsContainer: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#4CAF50',
  },
  selectedProductsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  selectedProductChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedProductChipText: {
    fontSize: 12,
    color: '#2e7d32',
    marginRight: 6,
  },
  removeProductButton: {
    fontSize: 18,
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  inputAreaWrapper: {
    width: '100%',
  },
  inputContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  addToCartButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 30,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  addToCartButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
