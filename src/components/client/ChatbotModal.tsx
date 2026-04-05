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
} from '../../services/chatbotService';

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
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<ChatbotResponse | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  // Initialize with welcome message
  useEffect(() => {
    if (visible && messages.length === 0) {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Bonjour ! Je suis votre assistant pour ${epicerieName}. 🛒\n\nJe peux vous aider à commander des produits. Dites-moi simplement ce que vous voulez, par exemple :\n\n• "Je voudrais 1kg de pommes et 2 bouteilles de lait"\n• "J'ai besoin de 500g de tomates et un pain"\n• "2 kg de pommes de terre et 1L d'huile d'olive"\n\nQue puis-je faire pour vous ?`,
        timestamp: new Date(),
      });
    }
  }, [visible, epicerieName]);

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
      // Parse message with AI
      const response = await chatbotService.parseMessage(
        userMessage,
        epicerieId,
        clientId
      );

      setLastResponse(response);

      // Generate and add assistant response
      const assistantMessage = chatbotService.generateResponseMessage(response);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      });

    } catch (error: any) {
      console.error('Error in chatbot:', error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Désolé, une erreur s'est produite : ${error.message}. Veuillez réessayer.`,
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
      Alert.alert('Aucun produit', 'Aucun produit n\'a été identifié pour être ajouté au panier.');
      return;
    }

    Alert.alert(
      'Ajouter au panier',
      `Voulez-vous ajouter ${lastResponse.produitsIdentifies.length} produit(s) au panier ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ajouter',
          onPress: () => {
            onAddToCart(lastResponse.produitsIdentifies);
            addMessage({
              id: (Date.now() + 2).toString(),
              role: 'assistant',
              content: `✅ ${lastResponse.produitsIdentifies.length} produit(s) ajouté(s) au panier !\n\nVoulez-vous commander autre chose ?`,
              timestamp: new Date(),
            });
            setLastResponse(null);
          },
        },
      ]
    );
  };

  // Clear chat
  const handleClearChat = () => {
    Alert.alert(
      'Effacer la conversation',
      'Voulez-vous vraiment effacer toute la conversation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setLastResponse(null);
            // Re-add welcome message
            addMessage({
              id: Date.now().toString(),
              role: 'assistant',
              content: `Nouvelle conversation ! Que puis-je faire pour vous ?`,
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
            <Text style={styles.headerTitle}>🤖 Assistant {epicerieName}</Text>
            <Text style={styles.headerSubtitle}>Commandez par chat</Text>
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
            <Text style={styles.loadingText}>L'assistant réfléchit...</Text>
          </View>
        )}

        {/* Add to cart button */}
        {lastResponse && lastResponse.produitsIdentifies.length > 0 && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={handleAddToCart}
            >
              <Text style={styles.addToCartText}>
                📦 Ajouter {lastResponse.produitsIdentifies.length} produit(s) au panier
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Tapez votre message..."
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
            onPress={() => setInputText('1kg de pommes et 2 bouteilles de lait')}
            disabled={isLoading}
          >
            <Text style={styles.suggestionText}>🍎 Exemple 1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.suggestionChip}
            onPress={() => setInputText('500g de tomates et un pain')}
            disabled={isLoading}
          >
            <Text style={styles.suggestionText}>🍞 Exemple 2</Text>
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
