import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PromoCodeInput from '../../src/components/client/PromoCodeInput';
import { Skeleton, useToast } from '../../src/components/feedback';
import { useCurrency } from '../../src/context/CurrencyContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { cartService, groupCartByEpicerie, CartGroup } from '../../src/services/cartService';
import { clientManagementService } from '../../src/services/clientManagementService';
import { DeliveryQuote, deliveryQuoteService } from '../../src/services/deliveryQuoteService';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService, BatchOrderError } from '../../src/services/orderService';
import { paymentService } from '../../src/services/paymentService';
import { AppliedPromoCode, extractPromoRejection } from '../../src/services/promoCodeService';
import { profileService } from '../../src/services/profileService';
import { CardPaymentDetails, CartItem, DeliveryType, Epicerie, PaymentMethod, SavedPaymentMethod } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';
import * as Location from 'expo-location';

/** Délai de débouncing pour la persistance AsyncStorage des mutations cart.
 *  Suffisant pour coalescer des clics rapides sur +/-, imperceptible pour
 *  l'utilisateur et bien plus court que la navigation moyenne. */
const CART_PERSIST_DEBOUNCE_MS = 200;

export default function CartScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  // Devise propagée par (epicerie)/[id].tsx — si le client a quitté
  // l'écran de l'épicerie sans vider le contexte, on récupère encore
  // la bonne devise. Sinon fallback "DH" via formatPrice.
  const { currency } = useCurrency();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('HOME_DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [loading, setLoading] = useState(false);
  /** Distinct du `loading` (placement de commande) — gère le 1er chargement
   *  AsyncStorage pour afficher un skeleton plutôt qu'un flash blanc. */
  const [cartLoading, setCartLoading] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'payment'>('delivery');

  /** Timer pour la persistance débauncée du panier. Coalesce les clics rapides
   *  sur +/- en une seule écriture AsyncStorage. */
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Last delivery coordinates obtained (saved address or GPS). Used to attach
   *  lat/lng to the order payload — the backend recomputes the fee from these. */
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

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

  // États pour crédit client
  // Delivery quote state — populated lazily when the user provides coordinates
  // (saved address or GPS). The cart shows a fee preview based on this; the
  // backend recomputes the same value on order submission so the user can't
  // tamper with it. `null` means "no quote yet" (manual address typed, or
  // location not yet picked up).
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);

  const [creditInfo, setCreditInfo] = useState<{
    allowCredit: boolean;
    creditLimit: number;
    balanceDue: number;
    totalAdvances: number;
    availableCredit: number;
  } | null>(null);
  const [loadingCredit, setLoadingCredit] = useState(false);

  // V95 — Code promo applique sur le panier. Reset automatique lors d'un
  // changement d'epicerie (un code est scopé a une épicerie). Sera transmis
  // dans createOrder.promoCode au checkout — le serveur fait l'application
  // reelle (verrou + redemption) lors de la creation de la commande.
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoCode | null>(null);

  // V95 — Invalide le code applique si l'epicerie du panier change ou
  // si le panier devient vide. Un code est strictement scopé a une epicerie ;
  // continuer a le presenter sur un autre panier serait trompeur (et le
  // serveur le rejetterait au checkout avec NOT_FOUND).
  const currentEpicerieIdInCart = cart.length > 0 ? cart[0]?.epicerieId ?? null : null;
  useEffect(() => {
    if (appliedPromo && currentEpicerieIdInCart == null) {
      setAppliedPromo(null);
    }
    // Note : on ne reset PAS sur un simple changement de quantite (meme
    // epicerie) — c'est le composant PromoCodeInput qui revalide via
    // /promo-codes/validate quand le subtotal bouge.
  }, [currentEpicerieIdInCart, appliedPromo]);

  // Charger le panier CHAQUE FOIS qu'on navigue vers cette page
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadCart = async () => {
        try {
          const savedCart = await cartService.getCart();
          if (cancelled) return;
          setCart(savedCart);

          // Load credit info + epicerie config if cart has items
          if (savedCart.length > 0 && savedCart[0].epicerieId) {
            const epicerieId = savedCart[0].epicerieId;
            await loadCreditInfo(epicerieId);
            try {
              const fetched = await epicerieService.getEpicerieById(epicerieId);
              if (!cancelled) {
                setEpicerie(fetched);
                // Auto-snap to PICKUP when the store cannot offer home delivery
                // at all (no livreur or NONE mode) so the UI never starts in
                // an impossible state.
                if (fetched.deliveryMode === 'NONE' || !fetched.hasLivreur) {
                  setDeliveryType('PICKUP');
                }
              }
            } catch (e) {
              console.warn('[CartScreen] Could not load epicerie:', e);
            }
          }
        } catch (error) {
          console.error('[CartScreen] ❌ Erreur chargement panier:', error);
          if (!cancelled) toast.error(t('common.error'), t('cart.loadError') ?? '');
        } finally {
          if (!cancelled) setCartLoading(false);
        }
      };

      loadCart();
      return () => { cancelled = true; };
    }, [toast, t])
  );

  // Si le composant est démonté avec un timer pending, on flush la dernière
  // valeur du panier en synchrone-best-effort pour ne pas perdre la mutation.
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Sauvegarde le panier dans AsyncStorage avec débouncing. Les mutations
   * locales (`+/-`, suppression) s'appliquent à `cart` synchroniquement et
   * cette fonction persiste en arrière-plan, sans bloquer le rendu.
   */
  const persistCart = useCallback((next: CartItem[]) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      cartService.saveCart(next).catch(err =>
        console.error('[CartScreen] persistCart failed:', err)
      );
    }, CART_PERSIST_DEBOUNCE_MS);
  }, []);

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
      // Detect whether the user has lat/lng on their profile so we can show
      // (or hide) the "Mon adresse enregistrée" shortcut.
      try {
        const me = await profileService.getMyProfile();
        setHasSavedAddress(!!(me && me.latitude != null && me.longitude != null));
      } catch {
        setHasSavedAddress(false);
      }
    } catch {
      console.log('Pas d\'informations de livraison par défaut');
    }
  };

  /**
   * Fetch a delivery quote from the backend using the given coords. Surfaces
   * loading state and gracefully degrades to `null` on error — the user can
   * still place the order without a fee preview, the server will recompute.
   */
  const fetchQuote = useCallback(async (lat: number, lng: number) => {
    if (!epicerie) return;
    setQuoteLoading(true);
    try {
      const q = await deliveryQuoteService.quote(epicerie.id, lat, lng);
      setDeliveryQuote(q);
      // If the épicerie cannot deliver to this point, auto-switch to PICKUP
      // so the user immediately sees a viable next step instead of being stuck.
      if (!q.canDeliver && deliveryType === 'HOME_DELIVERY') {
        setDeliveryType('PICKUP');
        toast.warning(
          t('common.error'),
          q.mode === 'NONE'
            ? 'Cette épicerie ne livre pas — retrait en boutique uniquement.'
            : 'Adresse hors zone de livraison — basculé sur retrait en boutique.',
        );
      }
    } catch (e) {
      console.warn('[CartScreen] Quote failed:', e);
      setDeliveryQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [epicerie, deliveryType, t, toast]);

  /** Use the address + lat/lng saved on the user's profile. */
  const useSavedAddress = useCallback(async () => {
    try {
      const me = await profileService.getMyProfile();
      if (!me || me.latitude == null || me.longitude == null) {
        toast.warning(t('common.error'), 'Aucune adresse enregistrée sur votre profil.');
        return;
      }
      if (me.adresse) setAdresse(me.adresse);
      if (me.telephone) setTelephone(me.telephone);
      lastCoordsRef.current = { lat: me.latitude, lng: me.longitude };
      await fetchQuote(me.latitude, me.longitude);
    } catch (e) {
      console.warn('[CartScreen] useSavedAddress failed:', e);
    }
  }, [fetchQuote, t, toast]);

  /** Ask for GPS permission, get a fresh fix, and fetch the quote. */
  const useGpsLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.warning(t('common.error'), 'Permission de localisation refusée.');
        return;
      }
      setQuoteLoading(true);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      lastCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      // Best-effort reverse geocode for the printable address. If it fails we
      // still have the coords for the quote — the user can edit the address
      // text manually before submitting.
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (places && places.length > 0) {
          const p = places[0];
          const parts = [p.street, p.city, p.region].filter(Boolean);
          if (parts.length > 0) setAdresse(parts.join(', '));
        }
      } catch { /* noop */ }
      await fetchQuote(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      console.warn('[CartScreen] GPS failed:', e);
      toast.error(t('common.error'), 'Impossible de récupérer votre position.');
    } finally {
      setQuoteLoading(false);
    }
  }, [fetchQuote, t, toast]);

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

  const loadCreditInfo = async (epicerieId: number) => {
    try {
      setLoadingCredit(true);
      console.log('[loadCreditInfo] Chargement info crédit pour épicerie:', epicerieId);
      const info = await clientManagementService.getCreditInfo(epicerieId);
      console.log('[loadCreditInfo] Info crédit chargée:', info);
      setCreditInfo(info);
    } catch (error) {
      console.error('[loadCreditInfo] Erreur chargement crédit:', error);
      setCreditInfo(null);
    } finally {
      setLoadingCredit(false);
    }
  };

  /**
   * Mise à jour instantanée de la quantité d'un article.
   * Mutation locale immédiate (feedback UI sans latence) + persistance débauncée.
   * Si la quantité descend à 0, l'article est retiré.
   */
  const updateQuantity = useCallback((productId: number, delta: number, unitId?: number) => {
    setCart(prev => {
      const next = prev
        .map(item => {
          const isSame = item.productId === productId &&
            (unitId === undefined || item.unitId === unitId);
          if (!isSame) return item;
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return {
            ...item,
            quantity:   newQuantity,
            totalPrice: item.pricePerUnit * newQuantity,
          };
        })
        .filter((i): i is CartItem => i !== null);
      persistCart(next);
      return next;
    });
  }, [persistCart]);

  /**
   * Suppression instantanée d'un article. Affiche un toast pour confirmer
   * l'action (le clic sur ✕ étant moins explicite qu'un menu de confirmation).
   */
  const removeItem = useCallback((productId: number, unitId: number | undefined, productNom: string) => {
    setCart(prev => {
      const next = prev.filter(i =>
        !(i.productId === productId && (unitId === undefined || i.unitId === unitId))
      );
      persistCart(next);
      return next;
    });
    toast.info(t('cart.itemRemoved') ?? 'Article retiré', productNom);
  }, [persistCart, toast, t]);

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
      toast.warning(t('common.error'), t('cart.invalidCardNumber'));
      return false;
    }
    if (!cardDetails.cardholderName) {
      toast.warning(t('common.error'), t('cart.cardholderRequired'));
      return false;
    }
    if (!cardDetails.expiryMonth || !cardDetails.expiryYear) {
      toast.warning(t('common.error'), t('cart.invalidExpiry'));
      return false;
    }
    if (!cardDetails.cvv || cardDetails.cvv.length < 3) {
      toast.warning(t('common.error'), t('cart.invalidCvv'));
      return false;
    }
    return true;
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      toast.warning(t('cart.emptyCart'), t('cart.addProductsFirst'));
      return;
    }
    setShowCheckoutModal(true);
    setCheckoutStep('delivery');
  };

  const handleContinueToPayment = () => {
    if (!adresse) {
      toast.warning(t('common.error'), t('cart.enterAddress'));
      return;
    }

    if (deliveryType === 'HOME_DELIVERY' && !telephone) {
      toast.warning(t('common.error'), t('cart.enterPhone'));
      return;
    }

    setCheckoutStep('payment');
  };

  const handleOrder = async () => {
    // Validation du paiement par carte
    if (paymentMethod === 'CARD' && selectedSavedCard === null && !showCardForm) {
      toast.warning(t('common.error'), t('cart.selectOrAddCard'));
      return;
    }

    if (paymentMethod === 'CARD' && showCardForm && !validateCardDetails()) {
      return;
    }

    // Validation du paiement par crédit client
    if (paymentMethod === 'CLIENT_ACCOUNT') {
      if (!creditInfo?.allowCredit) {
        toast.warning(t('common.error'), t('cart.creditNotAllowed'));
        return;
      }

      if (creditInfo.availableCredit <= 0) {
        toast.warning(
          t('common.error'),
          `${t('cart.insufficientCredit')} (${formatPrice(creditInfo.availableCredit, currency)})`
        );
        return;
      }
    }

    setLoading(true);

    try {
      // Get epicerieId from cart items (all items are from same épicerie)
      if (cart.length === 0) {
        toast.warning(t('common.error'), t('cart.cartEmpty'));
        return;
      }

      // Multi-epicerie : si le panier contient des produits de plusieurs
      // boutiques, on cree N commandes en une transaction all-or-nothing
      // via /orders/batch. Sinon on garde l'appel single legacy.
      const groups = groupCartByEpicerie(cart);
      const isMultiEpicerie = groups.length > 1;

      if (isMultiEpicerie && paymentMethod === 'CARD') {
        toast.warning(
          t('common.error'),
          'Le paiement par carte n\'est pas disponible pour une commande multi-boutiques. Choisissez espèces ou compte client.'
        );
        return;
      }

      if (isMultiEpicerie && appliedPromo?.code) {
        // Un code promo est specifique a une boutique : on ne peut pas
        // l'appliquer a plusieurs commandes en meme temps. L'utilisateur
        // doit le retirer ou commander les boutiques separement.
        toast.warning(
          t('common.error'),
          'Le code promo ne peut s\'appliquer qu\'a une seule boutique. Retirez-le ou separez vos commandes.'
        );
        return;
      }

      const epicerieIdFromCart = cart[0].epicerieId;

      if (!epicerieIdFromCart || groups.some(g => !g.epicerieId)) {
        // Clear invalid cart items
        await cartService.clearCart();
        setCart([]);
        toast.error(t('common.error'), t('cartExtra.obsoleteItems'));
        return;
      }

      // Helper : construit le payload d'UNE commande pour une epicerie donnee.
      // Sert pour le single ET le batch (DRY).
      const buildRequest = (group: CartGroup) => {
        const base: any = {
          epicerieId: group.epicerieId,
          items: group.items.map((item) => ({
            productId: item.productId,
            quantite: item.quantity,
            ...(item.unitId && item.unitId > 0 ? { unitId: item.unitId } : {}),
            unitLabel: item.unitLabel,
            requestedQuantity: item.requestedQuantity,
            itemType: 'PRODUCT' as const,
          })),
          deliveryType: deliveryType,
          adresseLivraison: adresse,
          paymentMethod: paymentMethod,
        };
        // Promo code uniquement en mono-boutique (check au-dessus).
        if (!isMultiEpicerie && appliedPromo?.code) {
          base.promoCode = appliedPromo.code;
        }
        if (deliveryType === 'HOME_DELIVERY' && lastCoordsRef.current) {
          base.latitudeLivraison = lastCoordsRef.current.lat;
          base.longitudeLivraison = lastCoordsRef.current.lng;
          base.telephoneLivraison = telephone;
        }
        return base;
      };

      let response: any;
      if (isMultiEpicerie) {
        // Batch all-or-nothing : 1 requete, N commandes
        const requests = groups.map(buildRequest);
        console.log('=== BATCH REQUEST ===', requests.length, 'commandes');
        const orders = await orderService.createOrderBatch(requests);
        response = orders[0] ?? null; // pour la suite (paiement par carte
                                       // deja exclu pour multi, donc inutilise)
      } else {
        const orderData = buildRequest(groups[0]);
        console.log('=== REQUÊTE CRÉÉE ===');
        console.log('Données complètes:', JSON.stringify(orderData, null, 2));
        console.log('================');
        response = await orderService.createOrder(orderData);
      }

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
          toast.error(t('cart.paymentError'), String(paymentError));
          return;
        }
      }

      const deliveryLabel = deliveryType === 'HOME_DELIVERY' ? t('cart.homeDelivery') : t('cart.storePickup');
      const paymentLabel = paymentMethod === 'CASH' ? t('cart.cash') :
                          paymentMethod === 'CARD' ? t('cart.card') :
                          t('cart.clientAccount');

      // ✅ Vider le panier après succès (V95 : reset aussi le code promo —
      // sans cela, un code "1 fois par client" pourrait apparaitre encore
      // applique pour la commande suivante alors qu'il n'est plus utilisable).
      setCart([]);
      setAppliedPromo(null);
      await cartService.clearCart();

      // UX 2026: pas de dialogue à fermer manuellement. Toast + redirect
      // immédiat — l'utilisateur voit la confirmation et atterrit là où il
      // peut suivre sa commande.
      setShowCheckoutModal(false);
      toast.success(
        t('common.success'),
        `${deliveryLabel} • ${paymentLabel}`
      );
      router.replace('/(client)');
    } catch (error: any) {
      console.error('[CartScreen] handleOrder failed:', error);

      // BatchOrderError : echec d'une commande dans le batch multi-epicerie.
      // Le backend a rollback toutes les autres → panier intact, on indique
      // a l'utilisateur laquelle de ses boutiques a pose probleme.
      if (error instanceof BatchOrderError) {
        toast.error(
          'Aucune commande creee',
          `Echec sur l'une de vos boutiques (commande #${error.failedIndex + 1}) : ${error.message}. Aucune autre commande n'a ete creee.`
        );
        return;
      }

      const errorMessage = error.response?.data?.message || error.message || String(error);

      // V95 — Detection du refus de code promo cote serveur. Le preview
      // peut etre devenu obsolete (course concurrente sur le quota global,
      // expiration entre temps, etc.). On retire le code applique et on
      // affiche le message localise de la raison plutot que le brut.
      const promoReason = extractPromoRejection(errorMessage);
      if (promoReason) {
        setAppliedPromo(null);
        toast.error(
          t('common.error'),
          t(`promoCodes.errors.${promoReason}`) as string
        );
      } else {
        toast.error(t('common.error'), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const handleProductClick = () => {
      if (item.productId && item.epicerieId) {
        router.push(`/(client)/(epicerie)/product/${item.productId}?epicerieId=${item.epicerieId}`);
      }
    };

    return (
      <View style={styles.cartItem}>
        <TouchableOpacity
          style={styles.itemInfo}
          onPress={handleProductClick}
          activeOpacity={0.7}
        >
          <Text style={styles.itemName}>{item.productNom}</Text>
          {item.unitLabel && (
            <Text style={styles.itemUnit}>{item.unitLabel}</Text>
          )}
          <Text style={styles.itemPrice}>{formatPrice(item.pricePerUnit || 0, currency)}</Text>
          <Text style={styles.seeDetailsText}>👉 {t('products.seeMore')}</Text>
        </TouchableOpacity>
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
          onPress={() => removeItem(item.productId, item.unitId, item.productNom)}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${item.productNom}`}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.itemTotal}>
          {formatPrice(item.totalPrice || 0, currency)}
        </Text>
      </View>
    );
  };

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
    seeDetailsText: {
      fontSize: 12,
      color: '#4CAF50',
      fontWeight: '600',
      marginTop: 4,
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
    optionButtonDisabled: {
      opacity: 0.5,
      backgroundColor: '#f0f0f0',
    },
    optionButtonTextDisabled: {
      color: '#999',
    },
    optionEmojiDisabled: {
      opacity: 0.5,
    },
    deliveryHint: {
      marginTop: 6,
      fontSize: 12,
      color: '#888',
      fontStyle: 'italic',
    },
    addressActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
      marginBottom: 12,
    },
    addressActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#4CAF50',
      backgroundColor: '#F1F8E9',
      gap: 6,
    },
    addressActionEmoji: {
      fontSize: 14,
    },
    addressActionLabel: {
      fontSize: 13,
      color: '#2E7D32',
      fontWeight: '600',
    },
    quoteCard: {
      marginTop: 4,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#E0E0E0',
      backgroundColor: '#FAFAFA',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quoteCardOk: {
      borderColor: '#A5D6A7',
      backgroundColor: '#F1F8E9',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    quoteCardKo: {
      borderColor: '#FFCC80',
      backgroundColor: '#FFF3E0',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    quoteCardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#2E7D32',
      marginBottom: 4,
    },
    quoteCardTitleKo: {
      fontSize: 13,
      fontWeight: '700',
      color: '#E65100',
      marginBottom: 4,
    },
    quoteCardLine: {
      fontSize: 12,
      color: '#555',
      marginBottom: 6,
    },
    quoteCardFee: {
      fontSize: 16,
      fontWeight: '700',
      color: '#1B5E20',
    },
    quoteCardSubText: {
      fontSize: 12,
      color: '#777',
      marginTop: 4,
    },
    subTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    subTotalLabel: {
      fontSize: 13,
      color: '#666',
    },
    subTotalValue: {
      fontSize: 13,
      color: '#333',
      fontWeight: '600',
    },
    // V95 — Code promo : zone d'input + ligne de remise dans le footer
    promoSection: {
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#e0e0e0',
    },
    discountLabel: {
      color: '#2e7d32',
      fontWeight: '600',
    },
    discountValue: {
      color: '#2e7d32',
      fontWeight: '700',
    },
    creditInfoContainer: {
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: '#f0f7ff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#d0e7ff',
    },
    creditInfoText: {
      fontSize: 14,
      color: '#1976D2',
      fontWeight: '600',
      marginBottom: 4,
    },
    creditWarningText: {
      fontSize: 13,
      color: '#f44336',
      fontWeight: '500',
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
      marginBottom: 0,
    },
    finalizeContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
  });

  // Skeleton lors du 1er chargement: 3 lignes de panier en placeholder.
  // Évite le flash blanc -> empty state -> liste, qui faisait croire que
  // le panier était vide pendant ~50ms.
  if (cartLoading) {
    return (
      <View style={styles.container}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.cartItem}>
            <View style={styles.itemInfo}>
              <Skeleton variant="text" width="65%" style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="35%" style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="25%" />
            </View>
            <Skeleton variant="rect" width={72} height={32} style={{ marginHorizontal: 12, borderRadius: 16 }} />
            <Skeleton variant="circle" width={32} height={32} />
          </View>
        ))}
      </View>
    );
  }

  // Detecte les multi-boutiques pour afficher un bandeau d'info clair.
  const cartGroups = groupCartByEpicerie(cart);
  const isMultiBoutique = cartGroups.length > 1;

  return (
    <View style={styles.container}>
      {isMultiBoutique && (
        <View style={multiBoutiqueStyles.banner}>
          <Text style={multiBoutiqueStyles.icon}>🛍️</Text>
          <View style={{ flex: 1 }}>
            <Text style={multiBoutiqueStyles.title}>
              {cartGroups.length} boutiques dans votre panier
            </Text>
            <Text style={multiBoutiqueStyles.subtitle}>
              {cartGroups.length} commandes seront créées en même temps. Si une seule
              échoue, aucune ne sera validée.
            </Text>
          </View>
        </View>
      )}

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
        {/* V95 — Champ code promo : visible quand panier non-vide + epicerie connue.
            La validation se fait cote serveur via /promo-codes/validate. */}
        {cart.length > 0 && cart[0]?.epicerieId != null && (
          <View style={styles.promoSection}>
            <PromoCodeInput
              epicerieId={cart[0].epicerieId}
              subtotal={getTotal()}
              channel="APP"
              value={appliedPromo}
              onApplied={setAppliedPromo}
              onRemoved={() => setAppliedPromo(null)}
              currency={currency}
              disabled={loading}
            />
          </View>
        )}

        {(() => {
          // Decomposition affichee uniquement si livraison OU promo present.
          // Pour PICKUP sans promo : on garde l'affichage compact (juste Total).
          const showDelivery = deliveryType === 'HOME_DELIVERY'
            && !!deliveryQuote?.canDeliver
            && deliveryQuote.deliveryFee != null;
          const deliveryFeeVal = showDelivery ? (deliveryQuote!.deliveryFee ?? 0) : 0;
          const discountVal = appliedPromo?.discountAmount ?? 0;
          const finalTotal = Math.max(0, getTotal() - discountVal + deliveryFeeVal);
          const showDecomposition = showDelivery || appliedPromo != null;

          return (
            <>
              {showDecomposition && (
                <>
                  <View style={styles.subTotalRow}>
                    <Text style={styles.subTotalLabel}>Sous-total</Text>
                    <Text style={styles.subTotalValue}>{formatPrice(getTotal(), currency)}</Text>
                  </View>
                  {appliedPromo && (
                    <View style={styles.subTotalRow}>
                      <Text style={[styles.subTotalLabel, styles.discountLabel]}>
                        {t('promoCodes.discountLabel')} ({appliedPromo.code})
                      </Text>
                      <Text style={[styles.subTotalValue, styles.discountValue]}>
                        −{formatPrice(appliedPromo.discountAmount, currency)}
                      </Text>
                    </View>
                  )}
                  {showDelivery && (
                    <View style={styles.subTotalRow}>
                      <Text style={styles.subTotalLabel}>Livraison</Text>
                      <Text style={styles.subTotalValue}>+{formatPrice(deliveryFeeVal, currency)}</Text>
                    </View>
                  )}
                </>
              )}
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>{t('cart.total')}</Text>
                <Text style={styles.totalAmount}>{formatPrice(finalTotal, currency)}</Text>
              </View>
            </>
          );
        })()}

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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
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
                {(() => {
                  // The HOME_DELIVERY toggle is only meaningful when the
                  // épicerie is willing AND able to deliver. Hide / disable
                  // it otherwise so the client doesn't pick a dead-end.
                  const homeDeliveryAvailable = !!epicerie
                    && epicerie.deliveryMode !== 'NONE'
                    && epicerie.hasLivreur === true;
                  return (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>{t('cart.chooseDeliveryType')}</Text>
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        deliveryType === 'HOME_DELIVERY' && styles.optionButtonActive,
                        !homeDeliveryAvailable && styles.optionButtonDisabled,
                      ]}
                      onPress={() => homeDeliveryAvailable && setDeliveryType('HOME_DELIVERY')}
                      disabled={!homeDeliveryAvailable}
                    >
                      <Text style={[styles.optionEmoji, !homeDeliveryAvailable && styles.optionEmojiDisabled]}>🏠</Text>
                      <Text
                        style={[
                          styles.optionButtonText,
                          deliveryType === 'HOME_DELIVERY' && styles.optionButtonTextActive,
                          !homeDeliveryAvailable && styles.optionButtonTextDisabled,
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
                  {!homeDeliveryAvailable && (
                    <Text style={styles.deliveryHint}>
                      {epicerie?.deliveryMode === 'NONE'
                        ? '❕ Cette épicerie ne livre pas — retrait en boutique uniquement.'
                        : '❕ Aucun livreur disponible — retrait en boutique uniquement.'}
                    </Text>
                  )}
                </View>
                  );
                })()}

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
                    onChangeText={(v) => {
                      setAdresse(v);
                      // Manual edit invalidates the previous fee preview — the
                      // user clearly typed a new address that doesn't match
                      // the lat/lng we still hold.
                      if (deliveryQuote) setDeliveryQuote(null);
                      lastCoordsRef.current = null;
                    }}
                  />
                  {deliveryType === 'HOME_DELIVERY' && (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder={t('cart.phoneNumber')}
                        placeholderTextColor="#999"
                        value={telephone}
                        onChangeText={setTelephone}
                        keyboardType="phone-pad"
                      />

                      {/* Address sources: profile or GPS. Each refreshes the quote. */}
                      <View style={styles.addressActionsRow}>
                        {hasSavedAddress && (
                          <TouchableOpacity
                            style={styles.addressActionBtn}
                            onPress={useSavedAddress}
                            disabled={quoteLoading}
                          >
                            <Text style={styles.addressActionEmoji}>📍</Text>
                            <Text style={styles.addressActionLabel}>Mon adresse</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.addressActionBtn}
                          onPress={useGpsLocation}
                          disabled={quoteLoading}
                        >
                          <Text style={styles.addressActionEmoji}>🛰️</Text>
                          <Text style={styles.addressActionLabel}>Utiliser GPS</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Quote preview card */}
                      {quoteLoading ? (
                        <View style={styles.quoteCard}>
                          <ActivityIndicator size="small" color="#4CAF50" />
                          <Text style={styles.quoteCardSubText}>Calcul des frais…</Text>
                        </View>
                      ) : deliveryQuote ? (
                        deliveryQuote.canDeliver && deliveryQuote.deliveryFee != null ? (
                          <View style={[styles.quoteCard, styles.quoteCardOk]}>
                            <Text style={styles.quoteCardTitle}>✅ Livraison disponible</Text>
                            <Text style={styles.quoteCardLine}>
                              {deliveryQuote.mode === 'FLAT_RATE'
                                ? 'Forfait livraison'
                                : `${deliveryQuote.zoneName ?? 'Zone'}${
                                    deliveryQuote.distanceKm != null
                                      ? ` · ${deliveryQuote.distanceKm.toFixed(1)} km`
                                      : ''
                                  }`}
                            </Text>
                            <Text style={styles.quoteCardFee}>
                              {formatPrice(deliveryQuote.deliveryFee, currency)}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.quoteCard, styles.quoteCardKo]}>
                            <Text style={styles.quoteCardTitleKo}>⚠️ Livraison indisponible</Text>
                            <Text style={styles.quoteCardSubText}>
                              {deliveryQuote.mode === 'NONE'
                                ? 'Cette épicerie ne livre pas. Choisissez le retrait en boutique.'
                                : 'Adresse hors zone de livraison. Choisissez le retrait en boutique.'}
                            </Text>
                          </View>
                        )
                      ) : (
                        <Text style={styles.quoteCardSubText}>
                          ℹ️ Utilisez votre adresse enregistrée ou le GPS pour calculer les frais.
                        </Text>
                      )}
                    </>
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
                  {deliveryType === 'HOME_DELIVERY' && deliveryQuote?.canDeliver && deliveryQuote.deliveryFee != null && (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Frais de livraison:</Text>
                      <Text style={styles.summaryValue}>
                        {formatPrice(deliveryQuote.deliveryFee, currency)}
                      </Text>
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
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        paymentMethod === 'CLIENT_ACCOUNT' && styles.optionButtonActive,
                        (!creditInfo?.allowCredit || (creditInfo && creditInfo.availableCredit <= 0)) && styles.optionButtonDisabled,
                      ]}
                      onPress={() => {
                        if (creditInfo?.allowCredit && creditInfo.availableCredit > 0) {
                          setPaymentMethod('CLIENT_ACCOUNT');
                        }
                      }}
                      disabled={!creditInfo?.allowCredit || (creditInfo && creditInfo.availableCredit <= 0)}
                    >
                      <Text style={styles.optionEmoji}>💰</Text>
                      <Text
                        style={[
                          styles.optionButtonText,
                          paymentMethod === 'CLIENT_ACCOUNT' && styles.optionButtonTextActive,
                          (!creditInfo?.allowCredit || (creditInfo && creditInfo.availableCredit <= 0)) && styles.optionButtonTextDisabled,
                        ]}
                      >
                        {t('cart.clientAccount')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Affichage du crédit disponible pour CLIENT_ACCOUNT */}
                  {creditInfo && (
                    <View style={styles.creditInfoContainer}>
                      {creditInfo.allowCredit ? (
                        <View>
                          <Text style={styles.creditInfoText}>
                            {t('cart.availableCredit')}: {formatPrice(creditInfo.availableCredit, currency)}
                          </Text>
                          {creditInfo.availableCredit <= 0 && (
                            <Text style={styles.creditWarningText}>
                              {t('cart.insufficientCredit')}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.creditWarningText}>
                          {t('cart.creditNotAllowed')}
                        </Text>
                      )}
                    </View>
                  )}

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

              </View>
            )}
          </ScrollView>

          {/* Bouton Finaliser — fixé en bas, toujours visible */}
          {checkoutStep === 'payment' && (
            <View style={[styles.finalizeContainer, { paddingBottom: insets.bottom + 12 }]}>
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
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const multiBoutiqueStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eef6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  subtitle: { fontSize: 12, color: '#1e3a8a', marginTop: 2, lineHeight: 16 },
});
