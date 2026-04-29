/**
 * Vente Directe — Point of Sale (POS) — Épicier
 *
 * Interface caisse mobile pour vendre directement à un client présent en magasin.
 * La commande créée est immédiatement DELIVERED + PICKUP.
 *
 * Flux :
 *  1. Sélectionner un client (recherche en temps réel)
 *  2. Parcourir le catalogue + ajouter des articles au panier
 *  3. Choisir le mode de paiement
 *  4. Valider → POST /api/orders/direct-sale
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clientManagementService } from '../../src/services/clientManagementService';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService } from '../../src/services/orderService';
import { receiptPrinterService } from '../../src/services/receiptPrinterService';
import { productService } from '../../src/services/productService';
import { offlineService } from '../../src/services/offline';
import { BarcodeProductScanner } from '../../src/components/shared/BarcodeProductScanner';
import { CategoryPicker } from '../../src/components/epicier/CategoryPicker';
import { CATEGORIES } from '../../src/constants/categories';
import { ClientEpicerieRelation, Epicerie, Product, ProductUnit } from '../../src/type';
import {
  PosSessionResponse,
  generateClientUuid
} from '../../src/services/posSessionService';
import { usePosSessionSync } from '../../src/hooks/usePosSessionSync';
import { deviceIdService } from '../../src/services/deviceIdService';
import { PosSessionPicker } from '../../src/components/epicier/PosSessionPicker';

// ─── Types locaux ────────────────────────────────────────────────────────────

interface CartItem {
  productId: number;
  productNom: string;
  unitId?: number;
  unitLabel: string;
  prix: number;
  quantite: number;
}

type PaymentMethod = 'CASH' | 'CARD' | 'CLIENT_ACCOUNT' | 'MOBILE';

/** Ligne de paiement (S3 — split payment). */
interface PaymentLine {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

/** Session POS indépendante — chaque onglet = une session */
interface PosSession {
  id: string;
  /** UUID stable côté client — offline-first, utilisé pour l'idempotence serveur. */
  clientUuid: string;
  /** ID serveur — null tant que pas encore synchronisé. */
  serverId?: number | null;
  client: ClientEpicerieRelation | null;
  cart: CartItem[];
  paymentMethod: PaymentMethod;
  /** S3 — si défini et non vide, le split remplace paymentMethod au checkout. */
  paymentLines: PaymentLine[] | null;
  notes: string;
}

const MAX_SESSIONS = 5;

function createSession(): PosSession {
  const clientUuid = generateClientUuid();
  return {
    id: clientUuid,
    clientUuid,
    serverId: null,
    client: null,
    cart: [],
    paymentMethod: 'CASH',
    paymentLines: null,
    notes: '',
  };
}

function hydrateFromServer(r: PosSessionResponse): PosSession {
  let cart: CartItem[] = [];
  try { cart = r.cartJson ? JSON.parse(r.cartJson) : []; } catch { cart = []; }
  return {
    id: r.clientUuid ?? String(r.id),
    clientUuid: r.clientUuid ?? `pos-hydrate-${r.id}`,
    serverId: r.id,
    client: null, // reconstruit au prochain choix client (clientId est persisté serveur)
    cart,
    paymentMethod: 'CASH',
    paymentLines: null,
    notes: r.notes ?? '',
  };
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; color: string }[] = [
  { value: 'CASH',           label: 'Espèces',       icon: 'cash',           color: '#388E3C' },
  { value: 'CARD',           label: 'Carte',         icon: 'credit-card',    color: '#1976D2' },
  { value: 'CLIENT_ACCOUNT', label: 'Compte client', icon: 'account-credit', color: '#7B1FA2' },
  { value: 'MOBILE',         label: 'Mobile',        icon: 'cellphone-text', color: '#FB8C00' },
];

const PAYMENT_COLOR: Record<PaymentMethod, string> = {
  CASH: '#388E3C', CARD: '#1976D2', CLIENT_ACCOUNT: '#7B1FA2', MOBILE: '#FB8C00'
};

const BLUE = '#2196F3';

// ─── Composant ───────────────────────────────────────────────────────────────

export default function VenteDirecteScreen() {
  const router = useRouter();

  // État global
  const [epicerieId, setEpicerieId]     = useState<number | null>(null);
  const [loadingInit, setLoadingInit]   = useState(true);

  // ── Sessions POS multi-clients ──────────────────────────────────
  const [sessions, setSessions]         = useState<PosSession[]>([createSession()]);
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);

  // ── Device ID persistant (Axe POS / S6) ─────────────────────────
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    deviceIdService.get().then(setDeviceId);
  }, []);

  // ── Sync serveur (Axe POS / S1+S6) ─────────────────────────────
  // Additive : n'interfère pas avec la logique existante en mémoire.
  // S6 : toutes les écritures passent par offlineService.writeOrQueue
  const posSync = usePosSessionSync({
    debounceMs: 800,
    deviceId: deviceId ?? undefined,
    computeTotal: (s: any) => (s.cart as CartItem[])
      .reduce((sum, it) => sum + it.prix * it.quantite, 0),
    computeItemCount: (s: any) => (s.cart as CartItem[]).length
  });

  // ── Picker multi-device (Axe POS / S6) ─────────────────────────
  const [pickerSessions, setPickerSessions] = useState<PosSessionResponse[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Hydratation au mount (Axe POS / S6) — stratégie multi-device :
  //   - 0 sessions ouvertes serveur → garder la session vierge par défaut
  //   - 1 session ouverte → reprise automatique silencieuse
  //   - 2+ sessions ouvertes → afficher le picker pour laisser le choix
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !deviceId) return;
    hydratedRef.current = true;
    posSync.hydrate().then(serverSessions => {
      if (serverSessions.length === 0) return;
      if (serverSessions.length === 1) {
        setSessions([hydrateFromServer(serverSessions[0])]);
        setActiveSessionIdx(0);
      } else {
        setPickerSessions(serverSessions);
        setPickerVisible(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const handlePickerResume = useCallback((session: PosSessionResponse) => {
    setSessions([hydrateFromServer(session)]);
    setActiveSessionIdx(0);
    setPickerVisible(false);
  }, []);

  const handlePickerNew = useCallback(() => {
    setSessions([createSession()]);
    setActiveSessionIdx(0);
    setPickerVisible(false);
  }, []);

  const handlePickerAbandonAll = useCallback(() => {
    pickerSessions.forEach(s => { posSync.abandonSession(s.id); });
    setSessions([createSession()]);
    setActiveSessionIdx(0);
    setPickerVisible(false);
  }, [pickerSessions, posSync]);

  // Sync debouncée à chaque changement du panier de la session active.
  useEffect(() => {
    const session = sessions[activeSessionIdx];
    if (!session) return;
    // Skip sync tant que le panier est vide ET qu'on n'a pas de serverId :
    // évite de créer des sessions fantômes sur le serveur au démarrage.
    if (!session.serverId && session.cart.length === 0) return;

    posSync.scheduleSync(session as any, (response) => {
      // Mémorise le serverId renvoyé par le backend
      if (!session.serverId && response.id) {
        setSessions(prev => prev.map(s =>
          s.clientUuid === session.clientUuid ? { ...s, serverId: response.id } : s
        ));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions[activeSessionIdx]?.cart,
      sessions[activeSessionIdx]?.client?.id,
      sessions[activeSessionIdx]?.notes]);

  // Raccourcis vers la session active
  const activeSession = sessions[activeSessionIdx] ?? sessions[0];
  const selectedClient = activeSession.client;
  const cart           = activeSession.cart;
  const paymentMethod  = activeSession.paymentMethod;
  const notes          = activeSession.notes;

  /** Met à jour un champ de la session active de manière immutable */
  const updateSession = useCallback(<K extends keyof PosSession>(field: K, value: PosSession[K]) => {
    setSessions(prev => prev.map((s, i) => i === activeSessionIdx ? { ...s, [field]: value } : s));
  }, [activeSessionIdx]);

  const setSelectedClient = useCallback((c: ClientEpicerieRelation | null) => updateSession('client', c), [updateSession]);
  const setCart            = useCallback((updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setSessions(prev => prev.map((s, i) => {
      if (i !== activeSessionIdx) return s;
      const newCart = typeof updater === 'function' ? updater(s.cart) : updater;
      return { ...s, cart: newCart };
    }));
  }, [activeSessionIdx]);
  const setPaymentMethod  = useCallback((m: PaymentMethod) => updateSession('paymentMethod', m), [updateSession]);
  const setPaymentLines   = useCallback((lines: PaymentLine[] | null) => updateSession('paymentLines', lines), [updateSession]);
  const setNotes          = useCallback((n: string) => updateSession('notes', n), [updateSession]);
  const paymentLines      = activeSession.paymentLines;

  // Client
  const [clients, setClients]           = useState<ClientEpicerieRelation[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);

  // Produits
  const [products, setProducts]         = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // UI états
  const [showCart, setShowCart]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Sélection variante
  const [unitPickerProduct, setUnitPickerProduct] = useState<Product | null>(null);
  const [unitQty, setUnitQty]           = useState('1');
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);

  // Modal de confirmation + calculateur monnaie
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [amountGiven, setAmountGiven]   = useState<string>('');

  // Scanner code-barre
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeLoading, setBarcodeLoading]         = useState(false);

  // Filtre catégorie
  const [selectedCategoryId, setSelectedCategoryId]       = useState<number | undefined>(undefined);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | undefined>(undefined);
  const [showCategoryPicker, setShowCategoryPicker]       = useState(false);

  // ── Panier (totaux calculés) ──────────────────────────────────────────────
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.prix * item.quantite, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantite, 0),
    [cart]
  );

  const amountGivenNum = parseFloat(amountGiven.replace(',', '.')) || 0;
  const change         = amountGivenNum >= cartTotal ? +(amountGivenNum - cartTotal).toFixed(2) : 0;
  const isInsufficient = amountGivenNum > 0 && amountGivenNum < cartTotal;

  // ── Init (avec cache offline) ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const epicerie = await offlineService.fetchWithCache<Epicerie>({
          namespace: 'epicerie',
          key: 'my-epicerie',
          fetcher: () => epicerieService.getMyEpicerie(),
        });
        if (!epicerie) throw new Error('Aucune donnée disponible');
        setEpicerieId(epicerie.id);

        const [prods, cls] = await Promise.all([
          offlineService.fetchWithCache<Product[]>({
            namespace: 'products',
            key: `epicerie_${epicerie.id}`,
            fetcher: () => productService.getProductsByEpicerie(epicerie.id),
          }),
          offlineService.fetchWithCache<ClientEpicerieRelation[]>({
            namespace: 'clients',
            key: `epicerie_${epicerie.id}_clients`,
            fetcher: () => clientManagementService.getEpicerieClients(epicerie.id, 0, 100),
          }),
        ]);
        if (prods) setProducts(prods.filter(p => p.isAvailable !== false));
        if (cls) setClients(cls.filter(c => c.status === 'ACCEPTED'));
      } catch (err: any) {
        if (offlineService.isOnline()) {
          Alert.alert('Erreur', err.message || 'Chargement impossible');
        }
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  // ── Filtrages ────────────────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.clientNom?.toLowerCase().includes(q) ||
      c.clientEmail?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  const filteredProducts = useMemo(() => {
    let result = products;
    const q = productSearch.trim().toLowerCase();
    if (q) result = result.filter(p => p.nom?.toLowerCase().includes(q));
    if (selectedCategoryId !== undefined)
      result = result.filter(p => p.categoryId === selectedCategoryId);
    return result;
  }, [products, productSearch, selectedCategoryId]);

  const getSelectedCategoryLabel = () => {
    if (selectedCategoryId === undefined) return null;
    const cat = CATEGORIES.find(c => c.id === selectedCategoryId);
    if (!cat) return null;
    if (selectedSubCategoryId) {
      const sub = cat.subcategories?.find(s => s.id === selectedSubCategoryId);
      if (sub) return `${cat.label} › ${sub.label}`;
    }
    return cat.label;
  };

  // ── Panier ───────────────────────────────────────────────────────────────

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const key = item.unitId ?? `p-${item.productId}`;
      const idx = prev.findIndex(c =>
        (c.unitId != null ? c.unitId === item.unitId : c.productId === item.productId && !c.unitId)
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantite: updated[idx].quantite + item.quantite };
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  const updateQty = useCallback((index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantite + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantite: newQty };
      }
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Rechargement produits ─────────────────────────────────────────────────

  const reloadProducts = useCallback(async () => {
    if (!epicerieId) return;
    try {
      const prods = await productService.getProductsByEpicerie(epicerieId);
      setProducts(prods.filter(p => p.isAvailable !== false));
    } catch {
      // silently ignore refresh errors
    }
  }, [epicerieId]);

  // ── Gestion des sessions POS ──────────────────────────────────────────────

  const addSession = useCallback(() => {
    if (sessions.length >= MAX_SESSIONS) {
      Alert.alert('Limite atteinte', `Maximum ${MAX_SESSIONS} ventes simultanées.`);
      return;
    }
    const newSession = createSession();
    setSessions(prev => [...prev, newSession]);
    setActiveSessionIdx(sessions.length);
  }, [sessions.length]);

  const closeSession = useCallback((index: number) => {
    if (sessions.length <= 1) {
      // Dernière session → juste la réinitialiser
      setSessions([createSession()]);
      setActiveSessionIdx(0);
      return;
    }
    setSessions(prev => prev.filter((_, i) => i !== index));
    setActiveSessionIdx(prev => {
      if (index < prev) return prev - 1;
      if (index === prev) return Math.max(0, prev - 1);
      return prev;
    });
  }, [sessions.length]);

  const switchSession = useCallback((index: number) => {
    if (index >= 0 && index < sessions.length) {
      setActiveSessionIdx(index);
    }
  }, [sessions.length]);

  // ── Sélection produit / variante ─────────────────────────────────────────

  const handleProductPress = (product: Product) => {
    const availableUnits = (product.units ?? []).filter(u => u.isAvailable && u.stock > 0);

    if (availableUnits.length === 0 && product.stock <= 0) {
      Alert.alert('Stock insuffisant', `"${product.nom}" est en rupture de stock.`);
      return;
    }

    if (availableUnits.length === 0) {
      // Produit sans variantes — ajouter directement
      addToCart({
        productId: product.id,
        productNom: product.nom,
        unitLabel: 'Unité',
        prix: product.prix,
        quantite: 1,
      });
      return;
    }

    // Ouvrir le picker de variantes
    setUnitPickerProduct(product);
    setSelectedUnit(availableUnits[0]);
    setUnitQty('1');
  };

  const confirmUnitSelection = () => {
    if (!unitPickerProduct || !selectedUnit) return;
    const qty = parseFloat(unitQty) || 1;
    if (qty <= 0) {
      Alert.alert('Quantité invalide', 'La quantité doit être supérieure à 0.');
      return;
    }
    if (selectedUnit.stock < qty) {
      Alert.alert('Stock insuffisant', `Stock disponible : ${selectedUnit.stock}`);
      return;
    }
    addToCart({
      productId: unitPickerProduct.id,
      productNom: unitPickerProduct.nom,
      unitId: selectedUnit.id,
      unitLabel: selectedUnit.label,
      prix: selectedUnit.prix,
      quantite: qty,
    });
    setUnitPickerProduct(null);
  };

  // ── Scan code-barre ──────────────────────────────────────────────────────

  const handleBarcodeScanned = async (barcode: string) => {
    setBarcodeLoading(true);
    try {
      const result = await productService.getProductByBarcode(barcode);

      // Chercher le produit complet dans la liste locale
      const product = products.find(p => p.id === result.id);
      if (!product) {
        Alert.alert('Produit introuvable', 'Ce code-barre ne correspond à aucun produit de votre catalogue.');
        setBarcodeLoading(false);
        return;
      }

      setShowBarcodeScanner(false);

      const availableUnits = (product.units ?? []).filter(u => u.isAvailable && u.stock > 0);

      if (availableUnits.length === 0 && product.stock <= 0) {
        Alert.alert('Rupture de stock', `"${product.nom}" est en rupture de stock.`);
        return;
      }

      if (availableUnits.length === 0) {
        // Produit sans variantes → ajout direct
        addToCart({
          productId: product.id,
          productNom: product.nom,
          unitLabel: 'Unité',
          prix: product.prix,
          quantite: 1,
        });
        return;
      }

      // Pré-sélectionner l'unité identifiée par le code-barre si disponible
      const matchedUnit = result.matchedUnitId
        ? availableUnits.find(u => u.id === result.matchedUnitId) ?? availableUnits[0]
        : availableUnits[0];

      setUnitPickerProduct(product);
      setSelectedUnit(matchedUnit);
      setUnitQty('1');
    } catch (err: any) {
      Alert.alert('Code-barre non reconnu', err?.message || 'Aucun produit associé à ce code-barre.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  // ── Validation commande ───────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!selectedClient) { Alert.alert('Client manquant', 'Sélectionnez un client.'); return; }
    if (cart.length === 0) { Alert.alert('Panier vide', 'Ajoutez au moins un article.'); return; }
    setAmountGiven('');
    setShowConfirmModal(true);
  };

  const doSubmit = async () => {
    if (!selectedClient) return;
    setSubmitting(true);

    // S3 — Split payment : si paymentLines défini et somme == total, on l'envoie.
    const useSplit = paymentLines && paymentLines.length > 0;
    if (useSplit) {
      const sum = paymentLines!.reduce((s, l) => s + l.amount, 0);
      if (Math.abs(sum - cartTotal) > 0.01) {
        Alert.alert(
          'Split payment invalide',
          `Somme des moyens (${sum.toFixed(2)}) ≠ total (${cartTotal.toFixed(2)})`
        );
        return;
      }
    }

    const salePayload: any = {
      clientId: selectedClient.clientId,
      items: cart.map(item => ({
        productId: item.productId,
        ...(item.unitId != null ? { unitId: item.unitId } : {}),
        quantite: Math.ceil(item.quantite),
        ...(item.quantite % 1 !== 0 ? { requestedQuantity: item.quantite } : {}),
      })),
      notes: notes.trim() || undefined,
    };
    if (useSplit) {
      salePayload.payments = paymentLines!.map(l => ({
        method: l.method,
        amount: l.amount,
        reference: l.reference || undefined
      }));
    } else {
      salePayload.paymentMethod = paymentMethod;
    }

    try {
      const result = await offlineService.writeOrQueue({
        domain: 'orders',
        method: 'POST',
        endpoint: '/orders/direct-sale',
        payload: salePayload,
        invalidateCache: ['orders', 'products'],
        description: `Vente directe ${selectedClient.clientNom} — ${cartTotal.toFixed(2)} DH`,
      });

      const clientNomSaved = selectedClient.clientNom;
      const totalSaved = cartTotal;

      // Marque la session POS comme CHECKED_OUT côté serveur (non bloquant).
      if (result.online) {
        const orderId = (result.data as any)?.id;
        if (orderId && activeSession.serverId) {
          posSync.markCheckedOut(activeSession.serverId, orderId);
        }
      }

      // Réinitialiser la session active après vente réussie — nouveau
      // clientUuid pour éviter de réutiliser l'ancien (CHECKED_OUT côté serveur).
      setSessions(prev => prev.map((s, i) =>
        i === activeSessionIdx ? createSession() : s
      ));
      setShowCart(false);
      setShowConfirmModal(false);
      reloadProducts();

      if (result.online) {
        const order = result.data as any;

        // Auto-print (silencieux si désactivé / échoue)
        receiptPrinterService.printReceiptSilent(order.id);

        Alert.alert(
          '✅ Vente enregistrée',
          `Total : ${totalSaved.toFixed(2)} DH\nCommande créée pour ${clientNomSaved}`,
          [
            {
              text: '🖨️ Imprimer/Partager',
              onPress: async () => {
                try {
                  await receiptPrinterService.printReceipt(order.id);
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message ?? 'Impossible d\'imprimer');
                }
              },
            },
            {
              text: '📧 Email',
              onPress: async () => {
                try {
                  await orderService.sendReceiptByEmail(order.id);
                  Alert.alert('✅', 'Reçu envoyé par email');
                } catch (e: any) {
                  Alert.alert('Erreur', e.message || 'Impossible d\'envoyer le reçu');
                }
              },
            },
            { text: 'Nouvelle vente' },
          ]
        );
      } else {
        Alert.alert(
          '📦 Vente enregistrée hors-ligne',
          `${totalSaved.toFixed(2)} DH pour ${clientNomSaved}\nSera synchronisée au retour du réseau.`,
          [
            { text: 'Nouvelle vente' },
            { text: 'Retour', onPress: () => router.back() },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de créer la vente');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vente directe</Text>
        </View>
        <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── En-tête ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vente directe</Text>
          {/* Bouton panier */}
          <TouchableOpacity style={styles.cartBtn} onPress={() => setShowCart(true)}>
            <MaterialCommunityIcons name="cart" size={24} color="#fff" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Onglets sessions multi-clients ── */}
        <View style={styles.sessionBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionBarContent}>
            {sessions.map((session, idx) => {
              const isActive = idx === activeSessionIdx;
              const label = session.client?.clientNom ?? `Vente ${idx + 1}`;
              const itemCount = session.cart.reduce((s, c) => s + c.quantite, 0);
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.sessionTab, isActive && styles.sessionTabActive]}
                  onPress={() => switchSession(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sessionTabText, isActive && styles.sessionTabTextActive]} numberOfLines={1}>
                    {label}
                  </Text>
                  {itemCount > 0 && (
                    <View style={[styles.sessionBadge, isActive && styles.sessionBadgeActive]}>
                      <Text style={styles.sessionBadgeText}>{itemCount}</Text>
                    </View>
                  )}
                  {sessions.length > 1 && (
                    <TouchableOpacity
                      onPress={() => closeSession(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.sessionCloseBtn}
                    >
                      <Ionicons name="close" size={12} color={isActive ? '#fff' : '#999'} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
            {sessions.length < MAX_SESSIONS && (
              <TouchableOpacity style={styles.sessionAddBtn} onPress={addSession} activeOpacity={0.7}>
                <Ionicons name="add" size={20} color={BLUE} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Sélection client ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>👤 Client</Text>
            <TouchableOpacity
              style={[styles.clientSelector, selectedClient && styles.clientSelectorFilled]}
              onPress={() => { setClientSearch(''); setShowClientModal(true); }}
              activeOpacity={0.75}
            >
              {selectedClient ? (
                <View style={styles.clientSelected}>
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>
                      {(selectedClient.clientNom ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{selectedClient.clientNom}</Text>
                    <Text style={styles.clientEmail}>{selectedClient.clientEmail}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedClient(null)} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.clientPlaceholder}>
                  <Ionicons name="person-add" size={20} color={BLUE} />
                  <Text style={styles.clientPlaceholderText}>Sélectionner un client</Text>
                  <Ionicons name="chevron-forward" size={18} color="#bbb" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Catalogue produits ── */}
          <View style={styles.section}>
            <View style={styles.catalogHeader}>
              <Text style={styles.sectionLabel}>🛒 Catalogue</Text>
              <Text style={styles.catalogCount}>{filteredProducts.length} produit(s)</Text>
            </View>

            {/* Recherche produit + bouton catégorie + bouton scan */}
            <View style={styles.searchRow}>
              <View style={[styles.searchBar, { flex: 1 }]}>
                <Ionicons name="search" size={16} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholder="Rechercher un produit…"
                  placeholderTextColor="#bbb"
                  returnKeyType="search"
                />
                {productSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setProductSearch('')}>
                    <Ionicons name="close" size={16} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.filterBtn, selectedCategoryId !== undefined && styles.filterBtnActive]}
                onPress={() => setShowCategoryPicker(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="tag-outline"
                  size={22}
                  color={selectedCategoryId !== undefined ? '#fff' : BLUE}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => setShowBarcodeScanner(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Chip catégorie active */}
            {selectedCategoryId !== undefined && (
              <View style={styles.activeCategoryRow}>
                <View style={styles.activeCategoryChip}>
                  <Text style={styles.activeCategoryText} numberOfLines={1}>
                    🏷️ {getSelectedCategoryLabel()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setSelectedCategoryId(undefined); setSelectedSubCategoryId(undefined); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#1565C0" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Grille produits */}
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {filteredProducts.map(product => {
                  const inCart = cart.some(c => c.productId === product.id);
                  const stock = product.totalStock ?? product.stock ?? 0;
                  const hasUnits = (product.units?.length ?? 0) > 0;
                  const minPrice = hasUnits
                    ? Math.min(...(product.units ?? []).map(u => u.prix))
                    : product.prix;

                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.productCard,
                        inCart && styles.productCardInCart,
                        stock <= 0 && styles.productCardOutOfStock,
                      ]}
                      onPress={() => handleProductPress(product)}
                      activeOpacity={0.8}
                      disabled={stock <= 0 && (product.units ?? []).every(u => u.stock <= 0)}
                    >
                      {inCart && (
                        <View style={styles.inCartBadge}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                      <View style={styles.productImageContainer}>
                        {product.photoUrl ? (
                          <Image
                            source={{ uri: product.photoUrl }}
                            style={styles.productImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.productImagePlaceholder}>📦</Text>
                        )}
                      </View>
                      <Text style={styles.productName} numberOfLines={2}>{product.nom}</Text>
                      <Text style={styles.productPrice}>
                        {hasUnits ? 'à partir de ' : ''}{minPrice.toFixed(2)} DH
                      </Text>
                      {hasUnits && (
                        <Text style={styles.productUnitsHint}>
                          {product.units?.length} variante(s)
                        </Text>
                      )}
                      <View style={[
                        styles.stockPill,
                        { backgroundColor: stock > 5 ? '#e8f5e9' : stock > 0 ? '#fff3e0' : '#ffebee' }
                      ]}>
                        <Text style={[
                          styles.stockPillText,
                          { color: stock > 5 ? '#2e7d32' : stock > 0 ? '#e65100' : '#c62828' }
                        ]}>
                          {stock > 0 ? `Stock: ${stock}` : 'Rupture'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Espace bas pour le panneau panier */}
          <View style={{ height: cart.length > 0 ? 10 : 20 }} />
        </ScrollView>

        {/* ── Panneau panier inline ── */}
        {cart.length > 0 && (
          <View style={styles.cartPanel}>
            {/* En-tête du panneau */}
            <View style={styles.cartPanelHeader}>
              <View style={styles.cartPanelTitleRow}>
                <MaterialCommunityIcons name="cart-check" size={18} color={BLUE} />
                <Text style={styles.cartPanelTitle}>Panier — {cartCount} article(s)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCart(true)} style={styles.cartPanelEditBtn}>
                <Ionicons name="create-outline" size={18} color={BLUE} />
                <Text style={styles.cartPanelEditText}>Modifier</Text>
              </TouchableOpacity>
            </View>

            {/* Liste articles (scrollable horizontalement) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cartPanelItems}
            >
              {cart.map((item, idx) => (
                <View key={idx} style={styles.cartPanelItem}>
                  <Text style={styles.cartPanelItemName} numberOfLines={1}>{item.productNom}</Text>
                  <Text style={styles.cartPanelItemUnit} numberOfLines={1}>{item.unitLabel}</Text>
                  <View style={styles.cartPanelItemBottom}>
                    <Text style={styles.cartPanelItemQty}>×{item.quantite}</Text>
                    <Text style={styles.cartPanelItemPrice}>{(item.prix * item.quantite).toFixed(2)} DH</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Total + Valider */}
            <View style={styles.cartPanelFooter}>
              <View style={styles.cartPanelTotalBox}>
                <Text style={styles.cartPanelTotalLabel}>Total</Text>
                <Text style={styles.cartPanelTotalValue}>{cartTotal.toFixed(2)} DH</Text>
              </View>
              <TouchableOpacity
                style={[styles.cartPanelValidateBtn, (!selectedClient) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!selectedClient}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.cartPanelValidateText}>Valider</Text>
              </TouchableOpacity>
            </View>
            {!selectedClient && (
              <Text style={styles.cartPanelWarning}>⚠️ Sélectionnez un client avant de valider</Text>
            )}
          </View>
        )}

      </KeyboardAvoidingView>

      {/* ══════════════════════════════════════════════════════════════════════
          Sélecteur de catégorie
      ══════════════════════════════════════════════════════════════════════ */}
      <CategoryPicker
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(categoryId, subcategoryId) => {
          setSelectedCategoryId(categoryId);
          setSelectedSubCategoryId(subcategoryId);
          setShowCategoryPicker(false);
        }}
        selectedCategoryId={selectedCategoryId}
        selectedSubcategoryId={selectedSubCategoryId}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          Scanner code-barre produit
      ══════════════════════════════════════════════════════════════════════ */}
      <BarcodeProductScanner
        visible={showBarcodeScanner}
        onScanned={handleBarcodeScanned}
        onClose={() => setShowBarcodeScanner(false)}
        isLoading={barcodeLoading}
        title="Scanner un produit"
        subtitle="Pointez vers le code-barre du produit à ajouter"
        accentColor={BLUE}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          Modal : sélection client
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionner un client</Text>
            <TouchableOpacity onPress={() => setShowClientModal(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar} style={{ margin: 16, marginTop: 8 }}>
            <Ionicons name="search" size={16} color="#999" />
            <TextInput
              style={styles.searchInput}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Rechercher par nom ou email…"
              placeholderTextColor="#bbb"
              autoFocus
            />
          </View>

          <FlatList
            data={filteredClients}
            keyExtractor={item => item.clientId.toString()}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucun client trouvé</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.clientRow}
                onPress={() => { setSelectedClient(item); setShowClientModal(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarText}>
                    {(item.clientNom ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientRowName}>{item.clientNom}</Text>
                  <Text style={styles.clientRowEmail}>{item.clientEmail}</Text>
                </View>
                {item.allowCredit && (
                  <View style={styles.creditBadge}>
                    <Text style={styles.creditBadgeText}>Crédit</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal : sélection de variante produit
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!unitPickerProduct}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUnitPickerProduct(null)}
      >
        {unitPickerProduct && (
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{unitPickerProduct.nom}</Text>
              <TouchableOpacity onPress={() => setUnitPickerProduct(null)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.unitSectionLabel}>Choisir une variante</Text>

              {(unitPickerProduct.units ?? [])
                .filter(u => u.isAvailable)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map(unit => (
                  <TouchableOpacity
                    key={unit.id}
                    style={[
                      styles.unitRow,
                      selectedUnit?.id === unit.id && styles.unitRowSelected,
                      unit.stock <= 0 && styles.unitRowDisabled,
                    ]}
                    onPress={() => unit.stock > 0 && setSelectedUnit(unit)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unitLabel}>{unit.label}</Text>
                      <Text style={styles.unitStock}>
                        Stock : {unit.stock > 0 ? unit.stock : 'Rupture'}
                      </Text>
                    </View>
                    <Text style={styles.unitPrice}>{unit.prix.toFixed(2)} DH</Text>
                    {selectedUnit?.id === unit.id && (
                      <Ionicons name="checkmark-circle" size={22} color={BLUE} style={{ marginLeft: 10 }} />
                    )}
                  </TouchableOpacity>
                ))
              }

              {/* Quantité */}
              <Text style={[styles.unitSectionLabel, { marginTop: 20 }]}>Quantité</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setUnitQty(q => String(Math.max(0.5, parseFloat(q) - (selectedUnit?.unitType === 'PIECE' ? 1 : 0.5))))}
                >
                  <Ionicons name="remove" size={20} color={BLUE} />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={unitQty}
                  onChangeText={setUnitQty}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setUnitQty(q => String(parseFloat(q) + (selectedUnit?.unitType === 'PIECE' ? 1 : 0.5)))}
                >
                  <Ionicons name="add" size={20} color={BLUE} />
                </TouchableOpacity>
              </View>

              {selectedUnit && (
                <View style={styles.unitPreview}>
                  <Text style={styles.unitPreviewLabel}>Sous-total estimé</Text>
                  <Text style={styles.unitPreviewTotal}>
                    {(selectedUnit.prix * (parseFloat(unitQty) || 1)).toFixed(2)} DH
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.confirmUnitBtn, !selectedUnit && styles.confirmUnitBtnDisabled]}
                onPress={confirmUnitSelection}
                disabled={!selectedUnit}
              >
                <MaterialCommunityIcons name="cart-plus" size={20} color="#fff" />
                <Text style={styles.confirmUnitBtnText}>Ajouter au panier</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal : panier + validation
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showCart}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCart(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Panier ({cartCount})</Text>
            <TouchableOpacity onPress={() => setShowCart(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>

            {/* Articles */}
            {cart.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="cart-off" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Panier vide</Text>
              </View>
            ) : (
              cart.map((item, idx) => (
                <View key={idx} style={styles.cartRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{item.productNom}</Text>
                    <Text style={styles.cartItemUnit}>{item.unitLabel} — {item.prix.toFixed(2)} DH</Text>
                  </View>
                  <View style={styles.cartQtyControl}>
                    <TouchableOpacity style={styles.cartQtyBtn} onPress={() => updateQty(idx, -1)}>
                      <Ionicons name="remove" size={16} color={BLUE} />
                    </TouchableOpacity>
                    <Text style={styles.cartQtyText}>{item.quantite}</Text>
                    <TouchableOpacity style={styles.cartQtyBtn} onPress={() => updateQty(idx, 1)}>
                      <Ionicons name="add" size={16} color={BLUE} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cartItemTotal}>{(item.prix * item.quantite).toFixed(2)} DH</Text>
                  <TouchableOpacity onPress={() => removeFromCart(idx)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{cartTotal.toFixed(2)} DH</Text>
            </View>

            {/* Mode de paiement */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionLabel}>💳 Mode de paiement</Text>
              <TouchableOpacity
                onPress={() => {
                  if (paymentLines) {
                    setPaymentLines(null); // retour single
                  } else {
                    // Démarrer split avec 1 ligne = total en cash
                    setPaymentLines([{ method: paymentMethod, amount: cartTotal }]);
                  }
                }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: paymentLines ? '#e53935' : '#2196F3',
                  backgroundColor: paymentLines ? '#ffebee' : '#e3f2fd'
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '800',
                  color: paymentLines ? '#e53935' : '#2196F3'
                }}>
                  {paymentLines ? '✕ Split ON' : '⚡ Split'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode single (rétro-compat) */}
            {!paymentLines && (
              <View style={styles.paymentOptions}>
                {PAYMENT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.paymentOption,
                      paymentMethod === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '18' }
                    ]}
                    onPress={() => setPaymentMethod(opt.value)}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon as any}
                      size={22}
                      color={paymentMethod === opt.value ? opt.color : '#888'}
                    />
                    <Text style={[
                      styles.paymentOptionLabel,
                      paymentMethod === opt.value && { color: opt.color, fontWeight: '700' }
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Mode split (S3) */}
            {paymentLines && (() => {
              const sum = paymentLines.reduce((s, l) => s + l.amount, 0);
              const remaining = cartTotal - sum;
              return (
                <View style={{ gap: 8 }}>
                  {paymentLines.map((line, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {PAYMENT_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setPaymentLines(paymentLines.map((l, i) =>
                            i === idx ? { ...l, method: opt.value } : l
                          ))}
                          style={{
                            paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6,
                            borderWidth: 1.5,
                            borderColor: line.method === opt.value ? opt.color : '#e0e0e0',
                            backgroundColor: line.method === opt.value ? opt.color + '18' : '#fff'
                          }}
                        >
                          <MaterialCommunityIcons name={opt.icon as any} size={16}
                            color={line.method === opt.value ? opt.color : '#888'} />
                        </TouchableOpacity>
                      ))}
                      <TextInput
                        value={String(line.amount)}
                        onChangeText={(v) => {
                          const parsed = parseFloat(v.replace(',', '.')) || 0;
                          setPaymentLines(paymentLines.map((l, i) => i === idx ? { ...l, amount: parsed } : l));
                        }}
                        keyboardType="decimal-pad"
                        style={{
                          flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
                          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
                          textAlign: 'right', fontWeight: '700', fontSize: 15, color: '#333'
                        }}
                      />
                      {paymentLines.length > 1 && (
                        <TouchableOpacity onPress={() => setPaymentLines(paymentLines.filter((_, i) => i !== idx))}>
                          <Ionicons name="close-circle" size={22} color="#e53935" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={() => setPaymentLines([
                      ...paymentLines,
                      { method: 'CLIENT_ACCOUNT', amount: Math.max(0, remaining) }
                    ])}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: 10, borderRadius: 8,
                      borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2196F3'
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#2196F3" />
                    <Text style={{ color: '#2196F3', fontWeight: '700' }}>Ajouter un moyen</Text>
                  </TouchableOpacity>
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between',
                    padding: 10, borderRadius: 8,
                    backgroundColor: Math.abs(remaining) < 0.01 ? '#e8f5e9' : '#fff3e0'
                  }}>
                    <Text style={{ fontWeight: '700', color: '#333' }}>Restant à affecter</Text>
                    <Text style={{
                      fontWeight: '800', fontSize: 16,
                      color: Math.abs(remaining) < 0.01 ? '#2e7d32' : '#e65100'
                    }}>
                      {remaining.toFixed(2)} DH
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Notes */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>📝 Notes (optionnel)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Remarques sur la vente…"
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={3}
            />

            {/* Bouton valider */}
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || cart.length === 0 || !selectedClient) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || cart.length === 0 || !selectedClient}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                  <Text style={styles.submitBtnText}>
                    Valider la vente — {cartTotal.toFixed(2)} DH
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {!selectedClient && (
              <Text style={styles.warningText}>⚠️ Sélectionnez un client avant de valider</Text>
            )}

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal : confirmation + calculateur monnaie
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showConfirmModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmer la vente</Text>
            <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">

            {/* Récap client */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmRowIcon}><Ionicons name="person" size={18} color={BLUE} /></View>
              <Text style={styles.confirmRowText}>
                <Text style={styles.confirmRowLabel}>Client  </Text>
                {selectedClient?.clientNom}
              </Text>
            </View>

            <View style={styles.confirmRow}>
              <View style={styles.confirmRowIcon}><Ionicons name="bag" size={18} color={BLUE} /></View>
              <Text style={styles.confirmRowText}>
                <Text style={styles.confirmRowLabel}>Articles  </Text>
                {cartCount} article{cartCount > 1 ? 's' : ''}
              </Text>
            </View>

            {/* Total mis en évidence */}
            <View style={styles.confirmTotalBox}>
              <Text style={styles.confirmTotalLabel}>Total à payer</Text>
              <Text style={styles.confirmTotalValue}>{cartTotal.toFixed(2)} DH</Text>
            </View>

            <View style={styles.confirmRow}>
              <View style={styles.confirmRowIcon}><Ionicons name="card" size={18} color={BLUE} /></View>
              <Text style={styles.confirmRowText}>
                <Text style={styles.confirmRowLabel}>Paiement  </Text>
                {PAYMENT_OPTIONS.find(p => p.value === paymentMethod)?.label}
              </Text>
            </View>

            {/* ── Calculateur monnaie (espèces uniquement) ── */}
            {paymentMethod === 'CASH' && (
              <>
                <View style={styles.separator} />

                <Text style={styles.changeTitle}>
                  💵  Montant remis par le client
                </Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountGiven}
                  onChangeText={setAmountGiven}
                  placeholder="0.00"
                  placeholderTextColor="#bbb"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus
                />

                {/* Insuffisant */}
                {isInsufficient && (
                  <View style={styles.insufficientBox}>
                    <Ionicons name="warning" size={16} color="#e53935" />
                    <Text style={styles.insufficientText}>
                      Montant insuffisant — manque {(cartTotal - amountGivenNum).toFixed(2)} DH
                    </Text>
                  </View>
                )}

                {/* Monnaie à rendre */}
                {amountGivenNum > 0 && !isInsufficient && amountGivenNum !== cartTotal && (
                  <View style={styles.changeBox}>
                    <View>
                      <Text style={styles.changeBoxLabel}>Monnaie à rendre</Text>
                    </View>
                    <Text style={styles.changeBoxAmount}>{change.toFixed(2)} DH</Text>
                  </View>
                )}

                {/* Compte exact */}
                {amountGivenNum > 0 && amountGivenNum === cartTotal && (
                  <View style={styles.exactBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#388e3c" />
                    <Text style={styles.exactText}>Compte exact — aucune monnaie à rendre</Text>
                  </View>
                )}
              </>
            )}

          </ScrollView>

          {/* Footer boutons */}
          <View style={styles.confirmFooter}>
            <TouchableOpacity
              style={styles.confirmCancelBtn}
              onPress={() => setShowConfirmModal(false)}
            >
              <Text style={styles.confirmCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmValidateBtn, submitting && { opacity: 0.6 }]}
              onPress={doSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.confirmValidateText}>Valider la vente</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </Modal>

      {/* ── Picker multi-device (Axe POS / S6) ─────────────────────── */}
      <PosSessionPicker
        visible={pickerVisible}
        sessions={pickerSessions}
        currentDeviceId={deviceId}
        onResume={handlePickerResume}
        onNew={handlePickerNew}
        onAbandonAll={handlePickerAbandonAll}
        onClose={() => setPickerVisible(false)}
      />

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BLUE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' },

  // Session tabs
  sessionBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 6,
  },
  sessionBarContent: {
    paddingHorizontal: 10,
    gap: 6,
    alignItems: 'center',
  },
  sessionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxWidth: 160,
  },
  sessionTabActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  sessionTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    maxWidth: 90,
  },
  sessionTabTextActive: {
    color: '#fff',
  },
  sessionBadge: {
    backgroundColor: '#999',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sessionBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sessionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  sessionCloseBtn: {
    padding: 2,
    marginLeft: 2,
  },
  sessionAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: BLUE,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  cartBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#FF5722', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Body
  body: { flex: 1, backgroundColor: '#f5f7fa' },

  // Section
  section: { padding: 14 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 },

  // Client selector
  clientSelector: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  clientSelectorFilled: { borderColor: BLUE },
  clientPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14,
  },
  clientPlaceholderText: { flex: 1, fontSize: 15, color: '#999' },
  clientSelected: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  clientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#222' },
  clientEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  clearBtn: { padding: 4 },

  // Catalogue
  catalogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catalogCount: { fontSize: 12, color: '#999' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  filterBtn: {
    borderRadius: 10,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BLUE,
    backgroundColor: '#fff',
  },
  filterBtnActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  scanBtn: {
    backgroundColor: BLUE,
    borderRadius: 10,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  activeCategoryText: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
    maxWidth: 200,
  },

  // Grille produits
  productGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  productCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 12,
    padding: 12, borderWidth: 1.5, borderColor: '#e0e0e0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  productCardInCart: { borderColor: BLUE, backgroundColor: '#f0f7ff' },
  productCardOutOfStock: { opacity: 0.5 },
  inCartBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  productName: { fontSize: 13, fontWeight: '700', color: '#222', marginBottom: 4, lineHeight: 18 },
  productPrice: { fontSize: 14, fontWeight: '700', color: BLUE, marginBottom: 4 },
  productUnitsHint: { fontSize: 11, color: '#888', marginBottom: 4 },
  stockPill: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  stockPillText: { fontSize: 11, fontWeight: '600' },
  productImageContainer: {
    width: '100%', height: 80, borderRadius: 8,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, overflow: 'hidden',
  },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: { fontSize: 28 },

  // Panneau panier inline
  cartPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1.5, borderTopColor: '#e3f2fd',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  cartPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
  },
  cartPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartPanelTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  cartPanelEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: BLUE + '40', backgroundColor: '#e3f2fd',
  },
  cartPanelEditText: { fontSize: 12, fontWeight: '600', color: BLUE },
  cartPanelItems: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  cartPanelItem: {
    width: 110, backgroundColor: '#f8fbff',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#dceeff',
  },
  cartPanelItemName: { fontSize: 12, fontWeight: '700', color: '#222', marginBottom: 2 },
  cartPanelItemUnit: { fontSize: 11, color: '#888', marginBottom: 6 },
  cartPanelItemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartPanelItemQty: {
    fontSize: 11, fontWeight: '700', color: '#fff',
    backgroundColor: BLUE, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
  },
  cartPanelItemPrice: { fontSize: 12, fontWeight: '700', color: BLUE },
  cartPanelFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  cartPanelTotalBox: { flex: 1 },
  cartPanelTotalLabel: { fontSize: 11, color: '#888', marginBottom: 1 },
  cartPanelTotalValue: { fontSize: 20, fontWeight: '800', color: '#222' },
  cartPanelValidateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#388E3C', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 13,
    shadowColor: '#388E3C', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  cartPanelValidateText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartPanelWarning: {
    textAlign: 'center', fontSize: 12, color: '#f57c00',
    paddingBottom: 8,
  },

  // Modals communs
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#222', flex: 1, marginRight: 10 },

  // Client list modal
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  clientRowName: { fontSize: 15, fontWeight: '600', color: '#222' },
  clientRowEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  creditBadge: {
    backgroundColor: '#EDE7F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  creditBadgeText: { fontSize: 11, color: '#7B1FA2', fontWeight: '600' },

  // Unit picker modal
  unitSectionLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 10 },
  unitRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 10, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa',
  },
  unitRowSelected: { borderColor: BLUE, backgroundColor: '#e3f2fd' },
  unitRowDisabled: { opacity: 0.45 },
  unitLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  unitStock: { fontSize: 12, color: '#888', marginTop: 2 },
  unitPrice: { fontSize: 16, fontWeight: '700', color: BLUE },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  qtyInput: {
    flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#333',
    borderBottomWidth: 2, borderBottomColor: BLUE, paddingVertical: 6,
  },
  unitPreview: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f0f7ff', borderRadius: 10, padding: 14, marginBottom: 16,
  },
  unitPreviewLabel: { fontSize: 13, color: '#555' },
  unitPreviewTotal: { fontSize: 20, fontWeight: '800', color: BLUE },
  confirmUnitBtn: {
    backgroundColor: BLUE, borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  confirmUnitBtnDisabled: { opacity: 0.5 },
  confirmUnitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Panier modal
  cartRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  cartItemName: { fontSize: 14, fontWeight: '700', color: '#222' },
  cartItemUnit: { fontSize: 12, color: '#888', marginTop: 2 },
  cartQtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartQtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  cartQtyText: { fontSize: 14, fontWeight: '700', color: '#333', minWidth: 24, textAlign: 'center' },
  cartItemTotal: { fontSize: 14, fontWeight: '700', color: BLUE, minWidth: 60, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderTopWidth: 2, borderTopColor: '#f0f0f0', marginBottom: 20,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 22, fontWeight: '800', color: BLUE },

  // Paiement
  paymentOptions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  paymentOption: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e0e0e0', gap: 6,
  },
  paymentOptionLabel: { fontSize: 12, fontWeight: '600', color: '#888', textAlign: 'center' },

  // Notes
  notesInput: {
    backgroundColor: '#f9f9f9', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#333', height: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#388E3C', borderRadius: 12, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 10,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  warningText: { textAlign: 'center', fontSize: 13, color: '#f57c00', marginTop: 6 },

  // Misc
  emptyState: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 14, color: '#bbb' },

  // ── Confirmation modal ──────────────────────────────────────────────────────
  confirmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  confirmRowIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center',
  },
  confirmRowText: { flex: 1, fontSize: 14, color: '#333' },
  confirmRowLabel: { fontWeight: '700', color: '#555' },
  confirmTotalBox: {
    backgroundColor: BLUE, borderRadius: 14, padding: 16,
    alignItems: 'center', marginVertical: 14,
  },
  confirmTotalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  confirmTotalValue: { fontSize: 28, fontWeight: '800', color: '#fff' },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 4 },

  // Change calculator
  changeTitle: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 4 },
  amountInput: {
    borderWidth: 1.5, borderColor: BLUE, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 20, fontWeight: '700', color: '#333', textAlign: 'center',
    backgroundColor: '#f0f7ff', marginBottom: 10,
  },
  insufficientBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff3e0', borderRadius: 10, padding: 10, marginBottom: 8,
  },
  insufficientText: { fontSize: 13, color: '#e65100', flex: 1 },
  changeBox: {
    backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  changeBoxLabel: { fontSize: 14, fontWeight: '600', color: '#2e7d32' },
  changeBoxAmount: { fontSize: 22, fontWeight: '800', color: '#2e7d32' },
  exactBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 8,
  },
  exactText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },

  // Footer buttons
  confirmFooter: { flexDirection: 'row', gap: 10, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8 },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  confirmValidateBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#388E3C', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  confirmValidateText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
