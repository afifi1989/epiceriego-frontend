import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { orderService } from '../../src/services/orderService';
import { paymentService } from '../../src/services/paymentService';
import { cartService } from '../../src/services/cartService';
import { CardPaymentDetails, CartItem, DeliveryType, PaymentMethod, SavedPaymentMethod } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';
import { useLanguage } from '../../src/context/LanguageContext';

export default function CartScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('HOME_DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [loading, setLoading] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'payment'>('delivery');

  // États pour paiement par carte
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedSavedCard, setSelectedSavedCard] = useState<number | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardPaymentDetails>({
    cardNumber: '',
    cardholderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    saveForLater: false,
  });

  // Charger le panier CHAQUE FOIS qu'on navigue vers cette page
  useFocusEffect(
    useCallback(() => {
      const loadCart = async () => {
        try {
          const savedCart = await cartService.getCart();
          console.log('[CartScreen] 🔄 Panier reloadé au focus:', savedCart.length, 'articles');
          setCart(savedCart);
        } catch (error) {
          console.error('[CartScreen] ❌ Erreur chargement panier:', error);
        }
      };

      loadCart();
    }, [])
  );

  useEffect(() => {
    loadDefaultDeliveryInfo();
  }, []);

  useEffect(() => {
    if (paymentMethod === 'CARD' && showCheckoutModal) {
      loadSavedPaymentMethods();
    }
  }, [paymentMethod, showCheckoutModal]);

  const loadDefaultDeliveryInfo = async () => {
    try {
      const deliveryInfo = await orderService.getDefaultDeliveryInfo();
      setAdresse(deliveryInfo.adresseLivraison || '');
      setTelephone(deliveryInfo.telephoneLivraison || '');
    } catch {
      console.log('Pas d\'informations de livraison par défaut');
    }
  };

  const loadSavedPaymentMethods = async () => {
    try {
      const methods = await paymentService.getSavedPaymentMethods();
      setSavedPaymentMethods(methods);
      if (methods.length > 0) {
        setSelectedSavedCard(methods[0].id);
      }
    } catch {
      console.log('Pas de cartes enregistrées');
    }
  };

  const updateQuantity = async (productId: number, delta: number, unitId?: number) => {
    try {
      console.log('[updateQuantity] Mise à jour produit ID:', productId, 'unitId:', unitId, 'delta:', delta);
      const updatedCart = await cartService.updateQuantity(productId, delta, unitId);
      console.log('[updateQuantity] ✅ Panier mis à jour:', updatedCart.length, 'articles');
      setCart(updatedCart);
    } catch (error) {
      console.error('[updateQuantity] ❌ Erreur mise à jour panier:', error);
    }
  };

  const getTotal = () => {
    try {
      return cart.reduce((sum, item) => {
        const itemTotal = item.totalPrice || (item.pricePerUnit * item.quantity) || 0;
        return sum + itemTotal;
      }, 0);
    } catch (error) {
      console.error('[CartScreen] Erreur calcul total:', error);
      return 0;
    }
  };

  const validateCardDetails = (): boolean => {
    if (!cardDetails.cardNumber || cardDetails.cardNumber.replace(/\s/g, '').length < 13) {
      Alert.alert(t('common.error'), t('cart.invalidCardNumber'));
      return false;
    }
    if (!cardDetails.cardholderName) {
      Alert.alert(t('common.error'), t('cart.cardholderRequired'));
      return false;
    }
    if (!cardDetails.expiryMonth || !cardDetails.expiryYear) {
      Alert.alert(t('common.error'), t('cart.invalidExpiry'));
      return false;
    }
    if (!cardDetails.cvv || cardDetails.cvv.length < 3) {
      Alert.alert(t('common.error'), t('cart.invalidCvv'));
      return false;
    }
    return true;
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(t('cart.emptyCart'), t('cart.addProductsFirst'));
      return;
    }
    setShowCheckoutModal(true);
    setCheckoutStep('delivery');
  };

  const handleContinueToPayment = () => {
    if (!adresse) {
      Alert.alert(t('common.error'), t('cart.enterAddress'));
      return;
    }

    if (deliveryType === 'HOME_DELIVERY' && !telephone) {
      Alert.alert(t('common.error'), t('cart.enterPhone'));
      return;
    }

    setCheckoutStep('payment');
  };

  const handleOrder = async () => {
    // Validation du paiement par carte
    if (paymentMethod === 'CARD' && selectedSavedCard === null && !showCardForm) {
      Alert.alert(t('common.error'), t('cart.selectOrAddCard'));
      return;
    }

    if (paymentMethod === 'CARD' && showCardForm && !validateCardDetails()) {
      return;
    }

    setLoading(true);

    try {
      // Get epicerieId from cart items (all items are from same épicerie)
      if (cart.length === 0) {
        Alert.alert(t('common.error'), t('cart.cartEmpty'));
        return;
      }

      const epicerieIdFromCart = cart[0].epicerieId;
      console.log('[CartScreen] epicerieId from cart[0]:', epicerieIdFromCart);
      console.log('[CartScreen] cart[0]:', JSON.stringify(cart[0], null, 2));

      if (!epicerieIdFromCart) {
        // Clear invalid cart items
        await cartService.clearCart();
        setCart([]);

        Alert.alert(
          t('common.error'),
          'Les articles de votre panier sont obsolètes. Veuillez ajouter les produits à nouveau.'
        );
        return;
      }

      const baseOrderData = {
        epicerieId: epicerieIdFromCart,
        items: cart.map(item => ({
          productId: item.productId,
          unitId: item.unitId,
          quantite: item.quantity,
        })),
        deliveryType: deliveryType,
        adresseLivraison: adresse,
        paymentMethod: paymentMethod,
      };

      const orderData = deliveryType === 'HOME_DELIVERY'
        ? { ...baseOrderData, telephoneLivraison: telephone }
        : baseOrderData;

      console.log('=== REQUÊTE CRÉÉE ===');
      console.log('Données complètes:', JSON.stringify(orderData, null, 2));
      console.log('================');

      const response = await orderService.createOrder(orderData);

      console.log('=== RÉPONSE DU SERVEUR ===');
      console.log('Commande créée:', JSON.stringify(response, null, 2));
      console.log('========================');

      // Si paiement par carte, traiter le paiement
      if (paymentMethod === 'CARD') {
        try {
          console.log('=== TRAITEMENT PAIEMENT ===');

          if (selectedSavedCard && !showCardForm) {
            console.log('Paiement avec carte enregistrée ID:', selectedSavedCard);
            await paymentService.processPaymentWithSavedCard(
              selectedSavedCard,
              getTotal(),
              response.id
            );
          } else if (showCardForm) {
            console.log('Paiement avec nouvelle carte');
            await paymentService.processCardPayment(
              cardDetails,
              getTotal(),
              response.id
            );

            if (cardDetails.saveForLater) {
              await paymentService.savePaymentMethod(cardDetails, false);
            }
          }
          console.log('=========================');
        } catch (paymentError) {
          console.error('❌ Erreur paiement:', paymentError);
          Alert.alert(t('cart.paymentError'), String(paymentError));
          return;
        }
      }

      const deliveryLabel = deliveryType === 'HOME_DELIVERY' ? t('cart.homeDelivery') : t('cart.storePickup');
      const paymentLabel = paymentMethod === 'CASH' ? t('cart.cash') : t('cart.card');

      // ✅ Vider le panier après succès
      setCart([]);
      await cartService.clearCart();

      Alert.alert(
        t('common.success'),
        `${t('cart.orderCreatedWith')} ${deliveryLabel} ${t('cart.andPayment')} ${paymentLabel} ${t('cart.created')}`,
        [
          {
            text: t('common.ok'),
            onPress: () => {
              setShowCheckoutModal(false);
              router.replace('/(client)');
            },
          },
        ]
      );
    } catch (error: any) {
      console.log('=== ERREUR ===');
      console.log('Erreur complète:', error);
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('==============');

      const errorMessage = error.response?.data?.message || error.message || String(error);
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.productNom}</Text>
        {item.unitLabel && (
          <Text style={styles.itemUnit}>{item.unitLabel}</Text>
        )}
        <Text style={styles.itemPrice}>{formatPrice(item.pricePerUnit || 0)}</Text>
      </View>
      <View style={styles.quantityControl}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.productId, -1, item.unitId)}
        >
          <Text style={styles.quantityButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.productId, 1, item.unitId)}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => {
          cartService.removeFromCart(item.productId, item.unitId);
          setCart(cart.filter(ci => ci.productId !== item.productId || ci.unitId !== item.unitId));
        }}
      >
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.itemTotal}>
        {formatPrice(item.totalPrice || 0)}
      </Text>
    </View>
  );

  // Modal de Checkout
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    list: {
      paddingBottom: 80,
    },
    cartItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
    },
    itemUnit: {
      fontSize: 12,
      color: '#999',
      fontStyle: 'italic',
      marginBottom: 4,
    },
    itemPrice: {
      fontSize: 14,
      color: '#4CAF50',
      fontWeight: '600',
    },
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 12,
    },
    quantityButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#4CAF50',
      justifyContent: 'center',
      alignItems: 'center',
    },
    quantityButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    quantity: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      minWidth: 30,
      textAlign: 'center',
    },
    itemTotal: {
      fontSize: 16,
      fontWeight: '700',
      color: '#4CAF50',
      minWidth: 70,
      textAlign: 'right',
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#ffebee',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    removeButtonText: {
      color: '#c62828',
      fontSize: 18,
      fontWeight: 'bold',
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    totalSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 0,
      paddingVertical: 8,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#666',
    },
    totalAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#4CAF50',
    },
    orderButton: {
      backgroundColor: '#4CAF50',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    orderButtonDisabled: {
      opacity: 0.5,
    },
    orderButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      minHeight: 300,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubText: {
      fontSize: 14,
      color: '#999',
      textAlign: 'center',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: '#fff',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
      marginTop: 10,
    },
    backButton: {
      fontSize: 16,
      color: '#4CAF50',
      fontWeight: '600',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
    },
    modalContent: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    stepIndicator: {
      fontSize: 14,
      color: '#4CAF50',
      fontWeight: '600',
      marginBottom: 20,
    },
    formSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 12,
    },
    optionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    optionButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#e0e0e0',
      alignItems: 'center',
      backgroundColor: '#f9f9f9',
    },
    optionButtonActive: {
      borderColor: '#4CAF50',
      backgroundColor: '#e8f5e9',
    },
    optionEmoji: {
      fontSize: 24,
      marginBottom: 8,
    },
    optionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#666',
    },
    optionButtonTextActive: {
      color: '#4CAF50',
    },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 12,
      color: '#333',
    },
    continueButton: {
      backgroundColor: '#4CAF50',
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
    },
    continueButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    summarySection: {
      backgroundColor: '#f5f5f5',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 20,
    },
    summarySectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
    },
    summaryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    summaryLabel: {
      fontSize: 13,
      color: '#666',
      fontWeight: '500',
    },
    summaryValue: {
      fontSize: 13,
      color: '#333',
      fontWeight: '600',
    },
    cardSection: {
      marginTop: 12,
      marginBottom: 16,
    },
    cardSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      marginBottom: 12,
    },
    cardOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: '#f9f9f9',
    },
    cardOptionActive: {
      borderColor: '#4CAF50',
      backgroundColor: '#e8f5e9',
    },
    cardOptionContent: {
      flex: 1,
    },
    cardOptionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
    },
    cardOptionExpiry: {
      fontSize: 12,
      color: '#999',
      marginTop: 2,
    },
    cardOptionCheck: {
      fontSize: 18,
      color: '#4CAF50',
      fontWeight: 'bold',
    },
    emptyCardsText: {
      fontSize: 13,
      color: '#999',
      fontStyle: 'italic',
      marginBottom: 12,
    },
    addNewCardButton: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#4CAF50',
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    addNewCardButtonText: {
      color: '#4CAF50',
      fontWeight: '600',
      fontSize: 14,
    },
    cardFormContainer: {
      backgroundColor: '#f9f9f9',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 12,
    },
    cardExpiryContainer: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginBottom: 12,
    },
    expiryInput: {
      flex: 1,
    },
    expirySlash: {
      fontSize: 16,
      color: '#666',
      marginBottom: 12,
    },
    cvvInput: {
      flex: 0.8,
    },
    saveCardCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: '#4CAF50',
      borderColor: '#4CAF50',
    },
    checkboxCheck: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    saveCardText: {
      fontSize: 13,
      color: '#666',
      flex: 1,
    },
    cancelCardButton: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelCardButtonText: {
      color: '#666',
      fontWeight: '600',
      fontSize: 14,
    },
    finalizeButton: {
      marginBottom: 40,
    },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={cart}
        renderItem={renderCartItem}
        keyExtractor={(item) => `${item.productId}-${item.unitId || 'no-unit'}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('cart.cartEmpty')}</Text>
            <Text style={styles.emptySubText}>{t('cart.addProductsToStart')}</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>{t('cart.total')}</Text>
          <Text style={styles.totalAmount}>{formatPrice(getTotal())}</Text>
        </View>
        <TouchableOpacity
          style={[styles.orderButton, cart.length === 0 && styles.orderButtonDisabled]}
          onPress={handleOpenCheckout}
          disabled={cart.length === 0}
        >
          <Text style={styles.orderButtonText}>{t('cart.order')}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Livraison et Paiement */}
      <Modal
        visible={showCheckoutModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              if (checkoutStep === 'payment') {
                setCheckoutStep('delivery');
              } else {
                setShowCheckoutModal(false);
              }
            }}>
              <Text style={styles.backButton}>← {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {checkoutStep === 'delivery' ? t('cart.deliveryType') : t('cart.paymentMethod')}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {checkoutStep === 'delivery' ? (
              // Étape 1: Livraison
              <View>
                <Text style={styles.stepIndicator}>{t('cart.step1')}</Text>

                {/* Type de Livraison */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>{t('cart.chooseDeliveryType')}</Text>
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        deliveryType === 'HOME_DELIVERY' && styles.optionButtonActive,
                      ]}
                      onPress={() => setDeliveryType('HOME_DELIVERY')}
                    >
                      <Text style={styles.optionEmoji}>🏠</Text>
                      <Text
                        style={[
                          styles.optionButtonText,
                          deliveryType === 'HOME_DELIVERY' && styles.optionButtonTextActive,
                        ]}
                      >
                        {t('cart.atHome')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        deliveryType === 'PICKUP' && styles.optionButtonActive,
                      ]}
                      onPress={() => setDeliveryType('PICKUP')}
                    >
                      <Text style={styles.optionEmoji}>🏪</Text>
                      <Text
                        style={[
                          styles.optionButtonText,
                          deliveryType === 'PICKUP' && styles.optionButtonTextActive,
                        ]}
                      >
                        {t('cart.storePickup')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Adresse */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>
                    {deliveryType === 'HOME_DELIVERY' ? t('cart.deliveryAddress') : t('cart.storeAddress')}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={deliveryType === 'HOME_DELIVERY' ? t('cart.deliveryAddress') : t('cart.storeAddress')}
                    placeholderTextColor="#999"
                    value={adresse}
                    onChangeText={setAdresse}
                  />
                  {deliveryType === 'HOME_DELIVERY' && (
                    <TextInput
                      style={styles.input}
                      placeholder={t('cart.phoneNumber')}
                      placeholderTextColor="#999"
                      value={telephone}
                      onChangeText={setTelephone}
                      keyboardType="phone-pad"
                    />
                  )}
                </View>

                {/* Bouton Continuer */}
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinueToPayment}
                >
                  <Text style={styles.continueButtonText}>{t('cart.continueToPayment')} →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Étape 2: Paiement
              <View>
                <Text style={styles.stepIndicator}>{t('cart.step2')}</Text>

                {/* Résumé de la livraison */}
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>{t('cart.deliverySummary')}</Text>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('cart.type')}:</Text>
                    <Text style={styles.summaryValue}>
                      {deliveryType === 'HOME_DELIVERY' ? `🏠 ${t('cart.atHome')}` : `🏪 ${t('cart.storePickup')}`}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{t('cart.address')}:</Text>
                    <Text style={styles.summaryValue}>{adresse}</Text>
                  </View>
                  {deliveryType === 'HOME_DELIVERY' && (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>{t('cart.phone')}:</Text>
                      <Text style={styles.summaryValue}>{telephone}</Text>
                    </View>
                  )}
                </View>

                {/* Méthode de Paiement */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>{t('cart.paymentMethod')}</Text>
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        paymentMethod === 'CASH' && styles.optionButtonActive,
                      ]}
                      onPress={() => setPaymentMethod('CASH')}
                    >
                      <Text style={styles.optionEmoji}>💵</Text>
                      <Text
                        style={[
                          styles.optionButtonText,
                          paymentMethod === 'CASH' && styles.optionButtonTextActive,
                        ]}
                      >
                        {t('cart.cash')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        paymentMethod === 'CARD' && styles.optionButtonActive,
                      ]}
                      onPress={() => setPaymentMethod('CARD')}
                    >
                      <Text style={styles.optionEmoji}>💳</Text>
                      <Text
                        style={[
                          styles.optionButtonText,
                          paymentMethod === 'CARD' && styles.optionButtonTextActive,
                        ]}
                      >
                        {t('cart.bankCard')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cartes ou Formulaire */}
                  {paymentMethod === 'CARD' && (
                    <View style={styles.cardSection}>
                      {!showCardForm && (
                        <View>
                          {savedPaymentMethods.length > 0 && (
                            <Text style={styles.cardSectionTitle}>{t('cart.savedCards')}</Text>
                          )}
                          {savedPaymentMethods.map((card) => (
                            <TouchableOpacity
                              key={card.id}
                              style={[
                                styles.cardOption,
                                selectedSavedCard === card.id && styles.cardOptionActive,
                              ]}
                              onPress={() => setSelectedSavedCard(card.id)}
                            >
                              <View style={styles.cardOptionContent}>
                                <Text style={styles.cardOptionLabel}>
                                  {card.cardholderName} - •••• {card.lastFourDigits}
                                </Text>
                                <Text style={styles.cardOptionExpiry}>
                                  {card.expiryMonth}/{card.expiryYear}
                                </Text>
                              </View>
                              {selectedSavedCard === card.id && (
                                <Text style={styles.cardOptionCheck}>✓</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                          {savedPaymentMethods.length === 0 && (
                            <Text style={styles.emptyCardsText}>{t('cart.noSavedCards')}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.addNewCardButton}
                            onPress={() => {
                              setShowCardForm(true);
                              setCardDetails({
                                cardNumber: '',
                                cardholderName: '',
                                expiryMonth: '',
                                expiryYear: '',
                                cvv: '',
                                saveForLater: false,
                              });
                            }}
                          >
                            <Text style={styles.addNewCardButtonText}>+ {t('cart.addNewCard')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {showCardForm && (
                        <View style={styles.cardFormContainer}>
                          <Text style={styles.cardSectionTitle}>{t('cart.cardInformation')}</Text>
                          <TextInput
                            style={styles.input}
                            placeholder={t('cart.cardNumberPlaceholder')}
                            placeholderTextColor="#999"
                            value={cardDetails.cardNumber}
                            onChangeText={(text) =>
                              setCardDetails({
                                ...cardDetails,
                                cardNumber: text.replace(/\D/g, '').slice(0, 16),
                              })
                            }
                            keyboardType="numeric"
                            maxLength={16}
                          />
                          <TextInput
                            style={styles.input}
                            placeholder={t('cart.cardholderName')}
                            placeholderTextColor="#999"
                            value={cardDetails.cardholderName}
                            onChangeText={(text) =>
                              setCardDetails({
                                ...cardDetails,
                                cardholderName: text.toUpperCase(),
                              })
                            }
                          />
                          <View style={styles.cardExpiryContainer}>
                            <TextInput
                              style={[styles.input, styles.expiryInput]}
                              placeholder="MM"
                              placeholderTextColor="#999"
                              value={cardDetails.expiryMonth}
                              onChangeText={(text) =>
                                setCardDetails({
                                  ...cardDetails,
                                  expiryMonth: text.slice(0, 2),
                                })
                              }
                              keyboardType="numeric"
                              maxLength={2}
                            />
                            <Text style={styles.expirySlash}>/</Text>
                            <TextInput
                              style={[styles.input, styles.expiryInput]}
                              placeholder="YY"
                              placeholderTextColor="#999"
                              value={cardDetails.expiryYear}
                              onChangeText={(text) =>
                                setCardDetails({
                                  ...cardDetails,
                                  expiryYear: text.slice(0, 2),
                                })
                              }
                              keyboardType="numeric"
                              maxLength={2}
                            />
                            <TextInput
                              style={[styles.input, styles.cvvInput]}
                              placeholder="CVV"
                              placeholderTextColor="#999"
                              value={cardDetails.cvv}
                              onChangeText={(text) =>
                                setCardDetails({
                                  ...cardDetails,
                                  cvv: text.slice(0, 4),
                                })
                              }
                              keyboardType="numeric"
                              maxLength={4}
                              secureTextEntry
                            />
                          </View>

                          <TouchableOpacity
                            style={styles.saveCardCheckbox}
                            onPress={() =>
                              setCardDetails({
                                ...cardDetails,
                                saveForLater: !cardDetails.saveForLater,
                              })
                            }
                          >
                            <View style={[styles.checkbox, cardDetails.saveForLater && styles.checkboxChecked]}>
                              {cardDetails.saveForLater && <Text style={styles.checkboxCheck}>✓</Text>}
                            </View>
                            <Text style={styles.saveCardText}>{t('cart.saveCardForLater')}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cancelCardButton}
                            onPress={() => {
                              setShowCardForm(false);
                              if (savedPaymentMethods.length > 0) {
                                setSelectedSavedCard(savedPaymentMethods[0].id);
                              }
                            }}
                          >
                            <Text style={styles.cancelCardButtonText}>{t('common.cancel')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Bouton Finaliser */}
                <TouchableOpacity
                  style={[styles.continueButton, styles.finalizeButton]}
                  onPress={handleOrder}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.continueButtonText}>{t('cart.finalizeOrder')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
