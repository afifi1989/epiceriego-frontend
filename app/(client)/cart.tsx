import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { cartService, computeItemTotal, groupCartByEpicerie, CartGroup, CartBundle } from '../../src/services/cartService';
import { clientManagementService } from '../../src/services/clientManagementService';
import { DeliveryQuote, deliveryQuoteService } from '../../src/services/deliveryQuoteService';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService, BatchOrderError } from '../../src/services/orderService';
import { paymentService } from '../../src/services/paymentService';
import { AppliedPromoCode, extractPromoRejection } from '../../src/services/promoCodeService';
import { profileService } from '../../src/services/profileService';
import shopLinkService from '../../src/services/shopLinkService';
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
  // V106 — lignes bundle persistees a part dans AsyncStorage. Combinees au
  // panier classique pour le grouping affichage + payload checkout.
  const [cartBundles, setCartBundles] = useState<CartBundle[]>([]);
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('HOME_DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [loading, setLoading] = useState(false);
  /** Loading spécifique au bouton "Finir sur WhatsApp" — distinct de `loading`
   *  (création de commande) pour éviter qu'un seul des deux flux désactive
   *  l'autre via le même flag. */
  const [waLoading, setWaLoading] = useState(false);
  /** Distinct du `loading` (placement de commande) — gère le 1er chargement
   *  AsyncStorage pour afficher un skeleton plutôt qu'un flash blanc. */
  const [cartLoading, setCartLoading] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'payment'>('delivery');

  /** Bannière d'erreur visible DANS le Modal de checkout. Doublée par un toast,
   *  mais le toast est rendu à la racine de l'app, donc masqué par le Modal
   *  natif plein écran de React Native — sans cette bannière inline, l'utilisateur
   *  voit juste le spinner s'éteindre sans message. */
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  /** Timer pour la persistance débauncée du panier. Coalesce les clics rapides
   *  sur +/- en une seule écriture AsyncStorage. */
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Last delivery coordinates obtained (saved address or GPS). Used to attach
   *  lat/lng to the order payload — the backend recomputes the fee from these. */
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  /** Mémoire de l'adresse saisie en mode HOME_DELIVERY pour pouvoir la
   *  restaurer si l'utilisateur bascule sur PICKUP puis revient sur livraison.
   *  Évite que l'adresse maison ne soit écrasée par celle de l'épicerie. */
  const homeAddressRef = useRef<string>('');

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

  type CreditInfoEntry = {
    allowCredit: boolean;
    creditLimit: number;
    balanceDue: number;
    totalAdvances: number;
    availableCredit: number;
  };

  // Map<epicerieId, CreditInfo> — supporte les paniers multi-boutiques.
  // En mono-boutique, `creditInfo` est dérivé de la 1ère entrée (compat
  // avec le rendu existant). En multi, chaque groupe est vérifié contre
  // SA propre CreditInfo dans handleOrder et affiché séparément.
  const [creditInfoByEpicerie, setCreditInfoByEpicerie] = useState<Record<number, CreditInfoEntry>>({});
  const [loadingCredit, setLoadingCredit] = useState(false);

  // Helper dérivé : 1ère épicerie du panier (utilisé par le rendu mono).
  // V106 — Fallback sur le 1er bundle pour les paniers 100% bundles, sinon
  // creditInfo serait toujours null et le bandeau CLIENT_ACCOUNT manquant.
  const primaryEpicerieId =
    cart[0]?.epicerieId ?? cartBundles[0]?.epicerieId ?? undefined;
  const creditInfo: CreditInfoEntry | null = primaryEpicerieId
    ? (creditInfoByEpicerie[primaryEpicerieId] ?? null)
    : null;

  // V95 — Code promo applique sur le panier. Reset automatique lors d'un
  // changement d'epicerie (un code est scopé a une épicerie). Sera transmis
  // dans createOrder.promoCode au checkout — le serveur fait l'application
  // reelle (verrou + redemption) lors de la creation de la commande.
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoCode | null>(null);

  // V95 — Invalide le code applique si l'epicerie du panier change ou
  // si le panier devient vide. Un code est strictement scopé a une epicerie ;
  // continuer a le presenter sur un autre panier serait trompeur (et le
  // serveur le rejetterait au checkout avec NOT_FOUND).
  // V106 — Aligne sur primaryEpicerieId pour ne pas reset le promo des
  // paniers 100% bundles (cart vide mais epicerie connue via bundles).
  useEffect(() => {
    if (appliedPromo && primaryEpicerieId == null) {
      setAppliedPromo(null);
    }
    // Note : on ne reset PAS sur un simple changement de quantite (meme
    // epicerie) — c'est le composant PromoCodeInput qui revalide via
    // /promo-codes/validate quand le subtotal bouge.
  }, [primaryEpicerieId, appliedPromo]);

  // Charger le panier CHAQUE FOIS qu'on navigue vers cette page
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadCart = async () => {
        try {
          const [savedCart, savedBundles] = await Promise.all([
            cartService.getCart(),
            cartService.getBundles(),
          ]);
          if (cancelled) return;
          setCart(savedCart);
          setCartBundles(savedBundles);

          // Load credit info pour CHAQUE épicerie du panier (multi-boutique).
          // V106 — Inclut les bundles pour ne pas oublier les paniers 100% bundles.
          if (savedCart.length > 0 || savedBundles.length > 0) {
            await loadCreditInfoForCart(savedCart, savedBundles);
          }
          // V106 — Derive l'epicerieId depuis cart en priorite (cas standard),
          // fallback sur le premier bundle pour les paniers 100% bundles.
          const firstEpicerieId =
            savedCart[0]?.epicerieId ?? savedBundles[0]?.epicerieId ?? null;
          if (firstEpicerieId) {
            try {
              const fetched = await epicerieService.getEpicerieById(firstEpicerieId);
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
   * Synchronise le champ adresse avec le type de livraison sélectionné.
   *
   * <p>En mode PICKUP, l'adresse à honorer est celle du magasin (l'épicier sait
   * où il prépare la commande, pas où le client se trouve). On la pré-remplit
   * automatiquement et on rend le champ non éditable plus bas dans le JSX
   * pour éviter toute confusion.</p>
   *
   * <p>Au retour vers HOME_DELIVERY, on restaure l'adresse "maison" que le
   * client avait saisie/sélectionnée avant la bascule — sinon il aurait à la
   * re-taper à chaque switch.</p>
   */
  useEffect(() => {
    if (!epicerie) return;
    if (deliveryType === 'PICKUP') {
      // Mémorise l'adresse maison uniquement si elle est différente — évite
      // d'écraser la sauvegarde par l'adresse du store en cas de re-render.
      if (adresse !== (epicerie.adresse || '')) {
        homeAddressRef.current = adresse;
      }
      setAdresse(epicerie.adresse || '');
    } else {
      // Retour vers HOME_DELIVERY : restaurer si dispo, sinon laisser tel
      // quel (l'utilisateur peut re-saisir via "Mon adresse" / GPS).
      if (homeAddressRef.current) {
        setAdresse(homeAddressRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryType, epicerie?.id, epicerie?.adresse]);

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
        showCheckoutWarning(
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
        showCheckoutWarning(t('common.error'), 'Aucune adresse enregistrée sur votre profil.');
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
        showCheckoutWarning(t('common.error'), 'Permission de localisation refusée.');
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
      showCheckoutError(t('common.error'), 'Impossible de récupérer votre position.');
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

  /**
   * Charge la CreditInfo pour TOUTES les épiceries du panier en parallèle.
   * Supporte le multi-boutique : chaque épicerie a son propre `allowCredit`
   * + `availableCredit`, et le bouton CLIENT_ACCOUNT n'est actif que si
   * TOUTES les boutiques autorisent le crédit avec un solde suffisant.
   *
   * V106 — Accepte aussi les bundles : on prend l'union des epicerieIds
   * presents dans cart + bundles, sinon un panier 100% bundles n'autorise
   * jamais CLIENT_ACCOUNT meme si le credit est suffisant.
   */
  const loadCreditInfoForCart = async (
    cartItems: CartItem[],
    bundles: CartBundle[] = [],
  ) => {
    const uniqueEpicerieIds = Array.from(
      new Set([
        ...cartItems.map((it) => it.epicerieId),
        ...bundles.map((b) => b.epicerieId),
      ].filter((id): id is number => !!id))
    );
    if (uniqueEpicerieIds.length === 0) {
      setCreditInfoByEpicerie({});
      return;
    }
    try {
      setLoadingCredit(true);
      const results = await Promise.all(
        uniqueEpicerieIds.map(async (id) => {
          try {
            const info = await clientManagementService.getCreditInfo(id);
            return [id, info] as const;
          } catch (e) {
            console.warn('[loadCreditInfo] échec pour épicerie', id, e);
            // Fallback : pas de crédit autorisé → CLIENT_ACCOUNT bloqué pour cette boutique.
            return [id, {
              allowCredit: false, creditLimit: 0, balanceDue: 0,
              totalAdvances: 0, availableCredit: 0,
            }] as const;
          }
        })
      );
      const next: Record<number, CreditInfoEntry> = {};
      for (const [id, info] of results) next[id] = info;
      setCreditInfoByEpicerie(next);
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
          const next = { ...item, quantity: newQuantity };
          next.totalPrice = computeItemTotal(next);
          return next;
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

  /**
   * Total du sous-panier (avant remise/livraison). Toujours recalculé via
   * {@link computeItemTotal} — on ne fait pas confiance au {@code totalPrice}
   * stocké, qui n'est qu'un cache de {@code pricePerUnit × quantity}.
   *
   * V106 — Inclut aussi les lignes bundle (snapshotPrice × quantity), sinon
   * un panier 100% bundles affiche 0 DH et le paiement carte serait pour 0.
   */
  const getTotal = () => {
    try {
      const itemsTotal = cart.reduce((sum, item) => sum + computeItemTotal(item), 0);
      const bundlesTotal = cartBundles.reduce((sum, b) => {
        const price = Number(b?.snapshotPrice);
        const qty = Number(b?.quantity);
        if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum;
        if (price < 0 || qty <= 0) return sum;
        return sum + price * qty;
      }, 0);
      return Math.round((itemsTotal + bundlesTotal) * 100) / 100;
    } catch (error) {
      console.error('[CartScreen] Erreur calcul total:', error);
      return 0;
    }
  };

  const validateCardDetails = (): boolean => {
    if (!cardDetails.cardNumber || cardDetails.cardNumber.replace(/\s/g, '').length < 13) {
      showCheckoutWarning(t('common.error'), t('cart.invalidCardNumber'));
      return false;
    }
    if (!cardDetails.cardholderName) {
      showCheckoutWarning(t('common.error'), t('cart.cardholderRequired'));
      return false;
    }
    if (!cardDetails.expiryMonth || !cardDetails.expiryYear) {
      showCheckoutWarning(t('common.error'), t('cart.invalidExpiry'));
      return false;
    }
    if (!cardDetails.cvv || cardDetails.cvv.length < 3) {
      showCheckoutWarning(t('common.error'), t('cart.invalidCvv'));
      return false;
    }
    return true;
  };

  /**
   * Affiche une erreur de checkout. Combine :
   *  - une bannière inline visible DANS le Modal (le toast au root est masqué
   *    par le Modal natif plein écran)
   *  - le toast standard, pour cohérence avec le reste de l'app et pour les
   *    cas où le Modal serait fermé entre temps.
   */
  const showCheckoutError = useCallback((title: string, message?: string) => {
    const body = message ? `${title} — ${message}` : title;
    setCheckoutError(body);
    toast.error(title, message);
  }, [toast]);

  const showCheckoutWarning = useCallback((title: string, message?: string) => {
    const body = message ? `${title} — ${message}` : title;
    setCheckoutError(body);
    toast.warning(title, message);
  }, [toast]);

  const handleOpenCheckout = () => {
    if (cart.length === 0 && cartBundles.length === 0) {
      toast.warning(t('cart.emptyCart'), t('cart.addProductsFirst'));
      return;
    }
    setCheckoutError(null);
    setShowCheckoutModal(true);
    setCheckoutStep('delivery');
  };

  /**
   * Killer feature : envoie le panier courant comme "précart" au backend, puis
   * ouvre WhatsApp avec un message contenant le token. Le bot identifie le
   * token, charge le panier, et saute directement à la confirmation — le client
   * n'a rien à retyper.
   *
   * <p>N'apparaît que pour un panier mono-épicerie (le précart est attaché à
   * une seule boutique). En multi, on cache le bouton plutôt que d'imposer un
   * choix : l'utilisateur peut soit retirer les autres boutiques, soit passer
   * par le checkout standard.</p>
   *
   * <p>En cas de 429 (quota de précarts atteint) ou autre erreur backend, on
   * affiche l'Alert plutôt qu'un toast — le message est plus actionnable :
   * "termine ou attends l'expiration des sessions en cours".</p>
   */
  const handleFinishOnWhatsApp = async () => {
    if (cart.length === 0 && cartBundles.length === 0) {
      toast.warning(t('cart.emptyCart'), t('cart.addProductsFirst'));
      return;
    }

    const groups = groupCartByEpicerie(cart, cartBundles);
    if (groups.length !== 1) {
      // Garde-fou : ce bouton ne devrait pas être visible en multi (le JSX
      // le cache déjà), mais on protège quand même contre un état incohérent.
      Alert.alert(
        'Panier multi-boutiques',
        'Pour commander sur WhatsApp, conservez les produits d\'une seule épicerie.',
      );
      return;
    }
    const group = groups[0];
    if (!group.epicerieId) {
      Alert.alert('Erreur', t('cartExtra.obsoleteItems'));
      return;
    }

    setWaLoading(true);
    try {
      const items = group.items.map(i => ({
        productId: i.productId,
        ...(i.unitId && i.unitId > 0 ? { unitId: i.unitId } : {}),
        productName: (i as any).productNom ?? '',
        unitLabel: (i as any).unitLabel ?? '',
        quantity: i.quantity,
        price: i.pricePerUnit,
      }));

      // V106 — Inclut les bundles dans le precart. Le backend les serialise
      // dans cartData et WhatsAppOrderCreator les traitera comme dans un
      // panier classique (decrement stock + BundleOrderLine).
      const bundles = group.bundles.map(b => ({
        bundleOfferId: b.bundleOfferId,
        quantity: b.quantity,
        name: b.snapshotName,
        price: b.snapshotPrice,
      }));

      const link = await shopLinkService.createPrecart(group.epicerieId, items, bundles);
      const opened = await shopLinkService.openWhatsApp(link.waUrl);
      if (!opened) {
        // Très rare : device sans WhatsApp ni navigateur. On donne au moins
        // l'URL en fallback pour que l'utilisateur la copie manuellement.
        Alert.alert(
          'WhatsApp introuvable',
          'Impossible d\'ouvrir WhatsApp sur cet appareil. Installez l\'app puis réessayez.',
        );
      }
    } catch (error: any) {
      if (error?.__subscriptionGateHandled) return;
      const status = error?.response?.status;
      const backendMsg = error?.response?.data?.message;
      if (status === 429) {
        // Quota de sessions actives atteint (cf. TooManyActivePrecartsException).
        Alert.alert(
          'Trop de sessions WhatsApp',
          backendMsg ?? 'Termine ou attends l\'expiration des sessions WhatsApp en cours.',
        );
      } else {
        Alert.alert(
          'Erreur',
          backendMsg ?? 'Impossible de préparer le panier pour WhatsApp. Réessaie.',
        );
      }
    } finally {
      setWaLoading(false);
    }
  };

  const handleContinueToPayment = () => {
    if (!adresse) {
      showCheckoutWarning(t('common.error'), t('cart.enterAddress'));
      return;
    }

    if (deliveryType === 'HOME_DELIVERY' && !telephone) {
      showCheckoutWarning(t('common.error'), t('cart.enterPhone'));
      return;
    }

    setCheckoutError(null);
    setCheckoutStep('payment');
  };

  const handleOrder = async () => {
    // Reset à chaque retry — sinon une ancienne erreur reste affichée pendant
    // qu'on charge la nouvelle tentative.
    setCheckoutError(null);

    // Validation du paiement par carte
    if (paymentMethod === 'CARD' && selectedSavedCard === null && !showCardForm) {
      showCheckoutWarning(t('common.error'), t('cart.selectOrAddCard'));
      return;
    }

    if (paymentMethod === 'CARD' && showCardForm && !validateCardDetails()) {
      return;
    }

    // Validation du paiement par crédit client.
    //
    // Couches défensives côté mobile — la vérité métier reste côté backend
    // (cf. OrderController CLIENT_ACCOUNT checks + verrou pessimiste). Ici
    // on évite juste un aller-retour réseau pour les cas évidents.
    //
    // Multi-boutique : chaque épicerie est vérifiée indépendamment contre
    // SA propre CreditInfo. Si une seule échoue, on bloque l'ensemble
    // (le backend rollback déjà tout le batch, mais on évite l'appel API).
    if (paymentMethod === 'CLIENT_ACCOUNT') {
      const groups = groupCartByEpicerie(cart, cartBundles);
      const isMulti = groups.length > 1;

      // En multi-boutique, les frais de livraison ne sont pas calculés
      // côté front (chaque épicerie a son propre quote). On valide donc
      // uniquement le subtotal par boutique — c'est une approximation
      // basse, le backend appliquera le check final avec delivery fee.
      for (const g of groups) {
        const info = creditInfoByEpicerie[g.epicerieId];
        const storeLabel = g.epicerieNom || `#${g.epicerieId}`;

        if (!info || !info.allowCredit) {
          showCheckoutWarning(
            t('common.error'),
            isMulti
              ? `${t('cart.creditNotAllowed')} — ${storeLabel}`
              : t('cart.creditNotAllowed')
          );
          return;
        }
        if (info.availableCredit <= 0) {
          showCheckoutWarning(
            t('common.error'),
            `${t('cart.insufficientCredit')}${isMulti ? ' — ' + storeLabel : ''} (${formatPrice(info.availableCredit, currency)})`
          );
          return;
        }

        // ⚠ Auparavant on validait seulement availableCredit > 0 : un client
        // avec 1 DH de marge pouvait lancer une commande de 500 DH et n'apprendre
        // le refus qu'au retour serveur. On compare maintenant au total réel
        // (subtotal − promo + frais de livraison) avant l'appel API.
        const groupSubtotal = g.items.reduce((s, i) => s + computeItemTotal(i), 0);
        const discountVal = !isMulti ? (appliedPromo?.discount ?? 0) : 0;
        const deliveryFeeVal = (!isMulti
              && deliveryType === 'HOME_DELIVERY'
              && !!deliveryQuote?.canDeliver
              && deliveryQuote.deliveryFee != null)
          ? deliveryQuote.deliveryFee
          : 0;
        const estimatedTotal = Math.max(0, groupSubtotal - discountVal + deliveryFeeVal);

        if (estimatedTotal > info.availableCredit) {
          const shortBy = estimatedTotal - info.availableCredit;
          showCheckoutWarning(
            t('cart.insufficientCredit'),
            `${t('cart.creditOverflowMessage')
              .replace('{{total}}', formatPrice(estimatedTotal, currency))
              .replace('{{available}}', formatPrice(info.availableCredit, currency))
              .replace('{{shortBy}}', formatPrice(shortBy, currency))}${
              isMulti ? ' — ' + storeLabel : ''}`
          );
          return;
        }
      }
    }

    setLoading(true);

    try {
      // Get epicerieId from cart items (all items are from same épicerie)
      if (cart.length === 0 && cartBundles.length === 0) {
        showCheckoutWarning(t('common.error'), t('cart.cartEmpty'));
        return;
      }

      // Multi-epicerie : si le panier contient des produits de plusieurs
      // boutiques, on cree N commandes en une transaction all-or-nothing
      // via /orders/batch. Sinon on garde l'appel single legacy.
      const groups = groupCartByEpicerie(cart, cartBundles);
      const isMultiEpicerie = groups.length > 1;

      if (isMultiEpicerie && paymentMethod === 'CARD') {
        showCheckoutWarning(
          t('common.error'),
          'Le paiement par carte n\'est pas disponible pour une commande multi-boutiques. Choisissez espèces ou compte client.'
        );
        return;
      }

      if (isMultiEpicerie && appliedPromo?.code) {
        // Un code promo est specifique a une boutique : on ne peut pas
        // l'appliquer a plusieurs commandes en meme temps. L'utilisateur
        // doit le retirer ou commander les boutiques separement.
        showCheckoutWarning(
          t('common.error'),
          'Le code promo ne peut s\'appliquer qu\'a une seule boutique. Retirez-le ou separez vos commandes.'
        );
        return;
      }

      // Derive l'epicerieId depuis les groups (qui incluent bundles) plutot
      // que cart[0] — un panier 100% bundles a cart vide mais groups bien
      // peuple. cart[0].epicerieId throw dans ce cas.
      const epicerieIdFromCart = groups[0]?.epicerieId;

      if (!epicerieIdFromCart || groups.some(g => !g.epicerieId)) {
        // Clear invalid cart items
        await cartService.clearCart();
        setCart([]);
        setCartBundles([]);
        showCheckoutError(t('common.error'), t('cartExtra.obsoleteItems'));
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
          // V106 — Lignes bundle (paniers groupes) pour cette epicerie.
          // Omis si le group n'en contient pas (le backend tolere les
          // payloads sans le champ, retrocompat assuree).
          ...(group.bundles && group.bundles.length > 0
            ? {
                bundles: group.bundles.map(b => ({
                  bundleOfferId: b.bundleOfferId,
                  quantity: b.quantity,
                })),
              }
            : {}),
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
          showCheckoutError(t('cart.paymentError'), String(paymentError));
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
      setCartBundles([]);
      setAppliedPromo(null);
      await Promise.all([
        cartService.clearCart(),
        cartService.clearBundles(),
      ]);

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

      // ── 1) Codes d'erreur CLIENT_ACCOUNT typés (CreditErrorResponse côté backend).
      // Le backend retourne {errorCode, message, availableCredit?, orderTotal?}.
      // On affiche un message localisé selon l'errorCode plutôt que le `message`
      // brut anglais.
      const creditErrorCode: string | undefined =
        (error instanceof BatchOrderError ? error.errorCode : undefined)
        || error?.response?.data?.errorCode;
      if (creditErrorCode) {
        const availableCredit: number | undefined =
          (error instanceof BatchOrderError ? error.availableCredit : undefined)
          ?? error?.response?.data?.availableCredit;
        const orderTotal: number | undefined =
          (error instanceof BatchOrderError ? error.orderTotal : undefined)
          ?? error?.response?.data?.orderTotal;

        const knownCodes = new Set([
          'NOT_REGISTERED_CLIENT',
          'RELATIONSHIP_PENDING',
          'CREDIT_NOT_ALLOWED',
          'INSUFFICIENT_CREDIT',
        ]);
        const codeKey = knownCodes.has(creditErrorCode) ? creditErrorCode : 'GENERIC';
        let body = t(`cart.creditErrors.${codeKey}`);
        if (creditErrorCode === 'INSUFFICIENT_CREDIT'
            && availableCredit != null && orderTotal != null) {
          const shortBy = Math.max(0, orderTotal - availableCredit);
          body = `${body}\n${t('cart.creditOverflowMessage')
            .replace('{{total}}', formatPrice(orderTotal, currency))
            .replace('{{available}}', formatPrice(availableCredit, currency))
            .replace('{{shortBy}}', formatPrice(shortBy, currency))}`;
        }
        // Refresh creditInfo en arrière-plan — l'état affiché est probablement
        // périmé (paiement entre-temps, autre commande, etc.).
        if (cart.length > 0 || cartBundles.length > 0) {
          loadCreditInfoForCart(cart, cartBundles).catch(() => {});
        }
        showCheckoutError(t('cart.creditPaymentRefused'), body);
        return;
      }

      // BatchOrderError : echec d'une commande dans le batch multi-epicerie.
      // Le backend a rollback toutes les autres → panier intact, on indique
      // a l'utilisateur laquelle de ses boutiques a pose probleme.
      if (error instanceof BatchOrderError) {
        showCheckoutError(
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
        showCheckoutError(
          t('common.error'),
          t(`promoCodes.errors.${promoReason}`) as string
        );
      } else {
        showCheckoutError(t('common.error'), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // V106 — Handlers bundles (analogues a updateQuantity/removeItem pour les items).
  const updateBundleQty = async (bundleOfferId: number, epicerieId: number, delta: number) => {
    const next = await cartService.updateBundleQty(bundleOfferId, epicerieId, delta);
    setCartBundles(next);
  };
  const removeBundleLine = async (bundleOfferId: number, epicerieId: number) => {
    const next = await cartService.removeBundle(bundleOfferId, epicerieId);
    setCartBundles(next);
  };

  /**
   * Rendu de la section bundles en tete de FlatList. Auto-masque si vide.
   * Choix : ListHeader plutot que de melanger CartItem + CartBundle dans
   * la meme `data` — evite un refactor du keyExtractor / renderItem qui
   * touche tout le rendu existant.
   */
  const renderBundleSection = () => {
    if (cartBundles.length === 0) return null;
    return (
      <View style={bundleSectionStyles.wrap}>
        <Text style={bundleSectionStyles.heading}>🎁 Paniers groupés</Text>
        {cartBundles.map((b, idx) => (
          <View key={`bundle-${b.bundleOfferId}-${b.epicerieId}`} style={bundleSectionStyles.row}>
            <TouchableOpacity
              style={bundleSectionStyles.info}
              onPress={() => router.push({
                pathname: '/(client)/bundle/[id]',
                params: { id: String(b.bundleOfferId) },
              } as any)}
              activeOpacity={0.7}
            >
              <Text style={bundleSectionStyles.name}>{b.snapshotName}</Text>
              <Text style={bundleSectionStyles.subtitle}>
                {b.items?.length ?? 0} produit{(b.items?.length ?? 0) > 1 ? 's' : ''} · {formatPrice(b.snapshotPrice, currency)} l'unité
              </Text>
            </TouchableOpacity>

            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateBundleQty(b.bundleOfferId, b.epicerieId, -1)}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{b.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateBundleQty(b.bundleOfferId, b.epicerieId, 1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeBundleLine(b.bundleOfferId, b.epicerieId)}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${b.snapshotName}`}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.itemTotal}>
              {formatPrice(b.snapshotPrice * b.quantity, currency)}
            </Text>
          </View>
        ))}
      </View>
    );
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
          {formatPrice(computeItemTotal(item), currency)}
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
    waSeparator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 10,
    },
    waSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#e0e0e0',
    },
    waSeparatorText: {
      fontSize: 12,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    waFinishButton: {
      backgroundColor: '#25D366',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    waFinishButtonDisabled: {
      opacity: 0.6,
    },
    waFinishIcon: {
      fontSize: 18,
    },
    waFinishLabel: {
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
    // ── Panneau transparent CLIENT_ACCOUNT (Fix 2) ─────────────────
    creditPanel: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
    },
    creditPanelOk: {
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0',
    },
    creditPanelDanger: {
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
    },
    creditPanelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    creditPanelLabel: {
      fontSize: 13,
      color: '#52525b',
      fontWeight: '500',
    },
    creditPanelValue: {
      fontSize: 14,
      color: '#18181b',
      fontWeight: '700',
    },
    creditProgressTrack: {
      height: 6,
      backgroundColor: '#e5e7eb',
      borderRadius: 3,
      marginTop: 8,
      marginBottom: 10,
      overflow: 'hidden',
    },
    creditProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    creditPanelRowFinal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.05)',
    },
    creditPanelFinalLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#52525b',
    },
    creditPanelFinalValue: {
      fontSize: 15,
      fontWeight: '800',
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
    // Variante read-only du TextInput pour le mode PICKUP — fond légèrement
    // grisé, texte un peu plus sombre. On garde le même padding pour éviter
    // les sauts visuels au switch HOME_DELIVERY ↔ PICKUP.
    inputReadOnly: {
      backgroundColor: '#f5f5f5',
      borderColor: '#e0e0e0',
      color: '#444',
    },
    inputReadOnlyHint: {
      fontSize: 12,
      color: '#666',
      marginTop: -6,
      marginBottom: 12,
      fontStyle: 'italic',
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
    checkoutErrorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      marginTop: 8,
      marginBottom: 8,
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fecaca',
      borderRadius: 10,
    },
    checkoutErrorIcon: {
      fontSize: 18,
      lineHeight: 22,
    },
    checkoutErrorText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: '#991b1b',
      fontWeight: '600',
    },
    checkoutErrorDismiss: {
      fontSize: 18,
      color: '#991b1b',
      fontWeight: '700',
      paddingHorizontal: 4,
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
  const cartGroups = groupCartByEpicerie(cart, cartBundles);
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
        ListHeaderComponent={renderBundleSection()}
        ListEmptyComponent={
          // Masque "panier vide" si on a des bundles — sinon le user verrait
          // "vide" alors qu'il a clairement des paniers groupes dans son cart.
          cartBundles.length > 0 ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('cart.cartEmpty')}</Text>
              <Text style={styles.emptySubText}>{t('cart.addProductsToStart')}</Text>
            </View>
          )
        }
      />

      <View style={styles.footer}>
        {/* V95 — Champ code promo : visible quand panier non-vide + epicerie connue.
            La validation se fait cote serveur via /promo-codes/validate.
            V106 — primaryEpicerieId fallback sur cartBundles[0] pour que
            les paniers 100% bundles puissent appliquer un code promo
            (le backend l'applique sur le total items+bundles). */}
        {primaryEpicerieId != null && (
          <View style={styles.promoSection}>
            <PromoCodeInput
              epicerieId={primaryEpicerieId}
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
          style={[styles.orderButton, (cart.length === 0 && cartBundles.length === 0) && styles.orderButtonDisabled]}
          onPress={handleOpenCheckout}
          disabled={cart.length === 0 && cartBundles.length === 0}
        >
          <Text style={styles.orderButtonText}>{t('cart.order')}</Text>
        </TouchableOpacity>

        {/* Killer feature : finir la commande sur WhatsApp.
            Mono-épicerie uniquement (le précart est attaché à une seule
            boutique). En multi, on cache le bouton — le checkout standard
            reste disponible au-dessus. Pas de check whatsappEnabled ici : le
            backend renverra une erreur métier explicite si la boutique n'a
            pas activé WhatsApp, et on l'affiche dans le catch. */}
        {(cart.length > 0 || cartBundles.length > 0) && cartGroups.length === 1 && (
          <>
            <View style={styles.waSeparator}>
              <View style={styles.waSeparatorLine} />
              <Text style={styles.waSeparatorText}>ou</Text>
              <View style={styles.waSeparatorLine} />
            </View>
            <TouchableOpacity
              style={[styles.waFinishButton, waLoading && styles.waFinishButtonDisabled]}
              onPress={handleFinishOnWhatsApp}
              disabled={waLoading}
              activeOpacity={0.85}
            >
              {waLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.waFinishIcon}>💬</Text>
                  <Text style={styles.waFinishLabel}>Finir sur WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Modal de Livraison et Paiement */}
      <Modal
        visible={showCheckoutModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => { setShowCheckoutModal(false); setCheckoutError(null); }}
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
              setCheckoutError(null);
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
                    style={[
                      styles.input,
                      // En mode PICKUP, l'adresse est celle du magasin et non
                      // modifiable : on visualise ça avec un fond légèrement
                      // grisé et un texte un peu plus sombre pour signaler la
                      // lecture seule sans masquer l'info.
                      deliveryType === 'PICKUP' && styles.inputReadOnly,
                    ]}
                    placeholder={deliveryType === 'HOME_DELIVERY' ? t('cart.deliveryAddress') : t('cart.storeAddress')}
                    placeholderTextColor="#999"
                    value={adresse}
                    editable={deliveryType === 'HOME_DELIVERY'}
                    multiline={deliveryType === 'PICKUP'}
                    onChangeText={(v) => {
                      setAdresse(v);
                      // Manual edit invalidates the previous fee preview — the
                      // user clearly typed a new address that doesn't match
                      // the lat/lng we still hold.
                      if (deliveryQuote) setDeliveryQuote(null);
                      lastCoordsRef.current = null;
                    }}
                  />
                  {deliveryType === 'PICKUP' && (
                    <Text style={styles.inputReadOnlyHint}>
                      🔒 {t('cart.storeAddressReadOnlyHint')}
                    </Text>
                  )}
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

                {/* Bannière d'erreur inline — visible DANS le Modal (les toasts
                    au root sont masqués par le Modal natif plein écran) */}
                {checkoutError && (
                  <View style={styles.checkoutErrorBanner}>
                    <Text style={styles.checkoutErrorIcon}>⚠️</Text>
                    <Text style={styles.checkoutErrorText} numberOfLines={4}>{checkoutError}</Text>
                    <TouchableOpacity
                      onPress={() => setCheckoutError(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Fermer"
                    >
                      <Text style={styles.checkoutErrorDismiss}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}

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
                    {(() => {
                      // Vérifie le crédit pour CHAQUE épicerie du panier (multi-store).
                      // Le bouton CLIENT_ACCOUNT n'est activé que si toutes les boutiques
                      // autorisent le crédit avec un solde suffisant pour leur sous-total.
                      const groups = groupCartByEpicerie(cart, cartBundles);
                      const allAllow = groups.every(g => {
                        const info = creditInfoByEpicerie[g.epicerieId];
                        if (!info || !info.allowCredit) return false;
                        const groupSubtotal = g.items.reduce((s, i) => s + computeItemTotal(i), 0);
                        return info.availableCredit >= groupSubtotal;
                      });
                      const disabled = !allAllow;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.optionButton,
                            paymentMethod === 'CLIENT_ACCOUNT' && styles.optionButtonActive,
                            disabled && styles.optionButtonDisabled,
                          ]}
                          onPress={() => { if (!disabled) setPaymentMethod('CLIENT_ACCOUNT'); }}
                          disabled={disabled}
                        >
                          <Text style={styles.optionEmoji}>💰</Text>
                          <Text
                            style={[
                              styles.optionButtonText,
                              paymentMethod === 'CLIENT_ACCOUNT' && styles.optionButtonTextActive,
                              disabled && styles.optionButtonTextDisabled,
                            ]}
                          >
                            {t('cart.clientAccount')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>

                  {/* Panneau de transparence crédit — affiché quand CLIENT_ACCOUNT sélectionné.
                      Mono-boutique : récap unique Total / Dispo / Reste + progression.
                      Multi-boutique : une ligne par épicerie, on bloque si une seule échoue. */}
                  {paymentMethod === 'CLIENT_ACCOUNT' && (() => {
                    const groups = groupCartByEpicerie(cart, cartBundles);
                    const isMulti = groups.length > 1;

                    const deliveryFeeVal = (deliveryType === 'HOME_DELIVERY'
                          && !!deliveryQuote?.canDeliver
                          && deliveryQuote.deliveryFee != null)
                      ? deliveryQuote.deliveryFee
                      : 0;
                    const discountVal = appliedPromo?.discount ?? 0;

                    // ── MULTI ───────────────────────────────────────────────
                    if (isMulti) {
                      return (
                        <View style={[styles.creditPanel, styles.creditPanelOk]}>
                          <Text style={[styles.creditPanelFinalLabel, { marginBottom: 8 }]}>
                            {t('cart.creditPerStore')}
                          </Text>
                          {groups.map((g) => {
                            const info = creditInfoByEpicerie[g.epicerieId];
                            const groupSubtotal = g.items.reduce((s, i) => s + computeItemTotal(i), 0);
                            if (!info || !info.allowCredit) {
                              return (
                                <View key={g.epicerieId} style={styles.creditPanelRow}>
                                  <Text style={styles.creditPanelLabel} numberOfLines={1}>
                                    {g.epicerieNom || `#${g.epicerieId}`}
                                  </Text>
                                  <Text style={[styles.creditPanelValue, { color: '#dc2626' }]}>
                                    {t('cart.creditNotAllowed')} ✗
                                  </Text>
                                </View>
                              );
                            }
                            const overflow = groupSubtotal > info.availableCredit;
                            return (
                              <View key={g.epicerieId} style={styles.creditPanelRow}>
                                <Text style={styles.creditPanelLabel} numberOfLines={1}>
                                  {g.epicerieNom || `#${g.epicerieId}`}
                                </Text>
                                <Text style={[
                                  styles.creditPanelValue,
                                  { color: overflow ? '#dc2626' : '#16a34a' },
                                ]}>
                                  {formatPrice(groupSubtotal, currency)} / {formatPrice(info.availableCredit, currency)}
                                  {overflow ? ' ✗' : ' ✓'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    }

                    // ── MONO ────────────────────────────────────────────────
                    if (!creditInfo) return null;
                    if (!creditInfo.allowCredit) {
                      return (
                        <View style={styles.creditInfoContainer}>
                          <Text style={styles.creditWarningText}>
                            {t('cart.creditNotAllowed')}
                          </Text>
                        </View>
                      );
                    }
                    const subtotal = getTotal();
                    const estimatedTotal = Math.max(0, subtotal - discountVal + deliveryFeeVal);
                    const available = creditInfo.availableCredit;
                    const remaining = available - estimatedTotal;
                    const overflows = remaining < 0;
                    const progressRaw = available > 0 ? estimatedTotal / available : 1;
                    const progressPct = Math.min(100, Math.max(0, progressRaw * 100));

                    return (
                      <View style={[
                        styles.creditPanel,
                        overflows ? styles.creditPanelDanger : styles.creditPanelOk,
                      ]}>
                        <View style={styles.creditPanelRow}>
                          <Text style={styles.creditPanelLabel}>{t('cart.totalOrder')}</Text>
                          <Text style={styles.creditPanelValue}>{formatPrice(estimatedTotal, currency)}</Text>
                        </View>
                        <View style={styles.creditPanelRow}>
                          <Text style={styles.creditPanelLabel}>{t('cart.availableCredit')}</Text>
                          <Text style={styles.creditPanelValue}>{formatPrice(available, currency)}</Text>
                        </View>
                        <View style={styles.creditProgressTrack}>
                          <View style={[
                            styles.creditProgressFill,
                            { width: `${progressPct}%` },
                            overflows ? { backgroundColor: '#dc2626' } : { backgroundColor: '#16a34a' },
                          ]} />
                        </View>
                        <View style={styles.creditPanelRowFinal}>
                          <Text style={[
                            styles.creditPanelFinalLabel,
                            overflows && { color: '#dc2626' },
                          ]}>
                            {overflows ? t('cart.creditShortBy') : t('cart.creditRemainingAfter')}
                          </Text>
                          <Text style={[
                            styles.creditPanelFinalValue,
                            overflows ? { color: '#dc2626' } : { color: '#16a34a' },
                          ]}>
                            {overflows
                              ? `- ${formatPrice(Math.abs(remaining), currency)}`
                              : formatPrice(remaining, currency)}
                            {overflows ? ' ✗' : ' ✓'}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

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
              {/* Bannière d'erreur inline — visible DANS le Modal (les toasts
                  au root sont masqués par le Modal natif plein écran) */}
              {checkoutError && (
                <View style={[styles.checkoutErrorBanner, { marginBottom: 12, marginHorizontal: 0 }]}>
                  <Text style={styles.checkoutErrorIcon}>⚠️</Text>
                  <Text style={styles.checkoutErrorText} numberOfLines={5}>{checkoutError}</Text>
                  <TouchableOpacity
                    onPress={() => setCheckoutError(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer"
                  >
                    <Text style={styles.checkoutErrorDismiss}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
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

// V106 — Section bundles en tete de cart (ListHeader). Visuellement distincte
// des items unitaires (background creme, bordure douce) pour communiquer au
// client qu'il s'agit d'offres groupees, pas de produits a la piece.
const bundleSectionStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF8E1',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    paddingTop: 8,
    paddingBottom: 4,
  },
  heading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E65100',
    letterSpacing: 0.3,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFECB3',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#212121' },
  subtitle: { fontSize: 12, color: '#8D6E63', marginTop: 2 },
});
