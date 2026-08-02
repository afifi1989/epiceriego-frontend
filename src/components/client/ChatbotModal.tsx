import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Image,
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
  VariantOption,
  tFmt,
} from '../../services/chatbotService';
import { quickReorderService, QuickReorderSuggestion, QuickReorderItem } from '../../services/quickReorderService';
import bundleOfferService, { BundleOffer } from '../../services/bundleOfferService';
import {
  clientPreferencesService,
  ClientPreference,
  preferredVariantFor,
} from '../../services/clientPreferencesService';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../context/LanguageContext';
import { formatDate } from '../../utils/dateFormat';

type SuggestionOption = ProductSuggestion['options'][number];

// ── Persistance de session (audit UX sprint 4) ──────────────────────────────
// Avant : fermer la modal (même par accident) perdait TOUTE la conversation,
// y compris les ambiguïtés en cours de résolution. On persiste désormais la
// session par (épicerie, client) avec une courte TTL : une réouverture rapide
// reprend là où on en était ; au-delà, on repart d'un accueil propre (le
// contexte produit est probablement périmé).

/** Durée de vie d'une session de conversation interrompue. */
const CHAT_SESSION_TTL_MS = 30 * 60 * 1000;

const chatSessionKey = (epicerieId: number, clientId: number) =>
  `@chatbot_session_${epicerieId}_${clientId}`;

/** Forme sérialisée (les Date deviennent des ISO strings dans le JSON). */
interface PersistedChatSession {
  savedAt: number;
  messages: (Omit<ChatMessageType, 'timestamp'> & { timestamp: string })[];
  lastResponse: ChatbotResponse | null;
}

/**
 * Applique le profil d'achat du client a une reponse de parsing pour reduire
 * les frictions, AVANT affichage :
 *
 *  - Cas variante (Lait → 1L/500ml) : si le client a une variante habituelle
 *    presente dans les alternatives, on la pre-selectionne et on retire le
 *    picker (1 tap economise).
 *  - Cas produit ambigu (huile → Afia/Lesieur) : si une des options est un
 *    produit que le client commande deja (top produits), on la choisit
 *    automatiquement — signal plus fort qu'une preference de marque.
 *
 * Fonction PURE (pas de state, pas d'I/O) : facile a raisonner et testable.
 * Renvoie la reponse transformee + des notes a afficher dans la conversation.
 * Si {@code prefs} est null, renvoie la reponse inchangee (degradation propre).
 */
const applyPreferences = (
  response: ChatbotResponse,
  prefs: ClientPreference | null,
  t: (k: string) => string,
): { response: ChatbotResponse; notes: string[] } => {
  if (!prefs) return { response, notes: [] };

  const notes: string[] = [];

  // 1) Pre-selection de variante sur les produits deja matches.
  const identified: ParsedProduct[] = response.produitsIdentifies.map((p) => {
    if (!p.hasMultipleVariants || !p.alternativeUnits || p.alternativeUnits.length < 2) return p;
    const prefUnit = preferredVariantFor(prefs, p.matchedProductId ?? null);
    const match = prefUnit != null ? p.alternativeUnits.find((v) => v.unitId === prefUnit) : null;
    if (!match) return p;
    notes.push(tFmt(t, 'chatbot.pref.variantAuto', { label: match.label }));
    return {
      ...p,
      matchedProductUnitId: match.unitId,
      matchedUnitLabel: match.label,
      matchedPrice: match.price,
      matchedStock: match.stock,
      hasMultipleVariants: false,
      alternativeUnits: undefined,
    };
  });

  // 2) Resolution auto des ambigüites produit via les top produits du client.
  const topIds = new Set(prefs.topProducts.map((tp) => tp.productId));
  const freqById = new Map(prefs.topProducts.map((tp) => [tp.productId, tp.orderCount]));
  const stillAmbiguous: ParsedProduct[] = [];

  for (const amb of response.produitsNonIdentifies) {
    if (amb.hasMultipleProducts && amb.productOptions && amb.productOptions.length > 1) {
      const preferred = amb.productOptions
        .filter((o) => topIds.has(o.productId))
        .sort((a, b) => (freqById.get(b.productId) ?? 0) - (freqById.get(a.productId) ?? 0))[0];
      if (preferred) {
        identified.push({
          ...amb,
          isMatched: true,
          hasMultipleProducts: false,
          productOptions: undefined,
          matchedProductId: preferred.productId,
          matchedProductUnitId: preferred.productUnitId,
          matchedProductName: preferred.productName,
          matchedUnitLabel: preferred.unitLabel,
          matchedPrice: preferred.price,
          matchedStock: preferred.stock,
        });
        notes.push(tFmt(t, 'chatbot.pref.productAuto', { name: preferred.productName }));
        continue;
      }
    }
    stillAmbiguous.push(amb);
  }

  return {
    response: {
      ...response,
      produitsIdentifies: identified,
      produitsNonIdentifies: stillAmbiguous,
      matchedCount: identified.length,
      unmatchedCount: stillAmbiguous.filter((p) => !p.hasMultipleProducts).length,
    },
    notes,
  };
};

/**
 * Vignette produit 44×44 utilisée dans les 3 blocs de choix (ambigüités, variantes,
 * suggestions). `uri` est l'URL absolue résolue côté backend ; si null/vide on rend
 * un placeholder emoji pour ne pas casser l'alignement des lignes.
 */
const ProductThumbnail: React.FC<{ uri?: string; size?: number }> = ({ uri, size = 44 }) => {
  const dims = { width: size, height: size, borderRadius: 6, marginEnd: 10 };
  if (uri) {
    return <Image source={{ uri }} style={dims} resizeMode="cover" />;
  }
  return (
    <View
      style={[
        dims,
        { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Text style={{ fontSize: 22 }}>📦</Text>
    </View>
  );
};

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
  /** Suggestion "Reprendre votre dernière commande" — null si pas d'historique
   *  ou si le client a déjà cliqué "Nouvelle commande" / "Reprendre". Une fois
   *  consommée, on ne la ré-affiche pas tant que le modal reste ouvert. */
  const [quickReorder, setQuickReorder] = useState<QuickReorderSuggestion | null>(null);
  // V106 — Bundles disponibles dans cette epicerie. Charges en arriere-plan
  // au mount, affiches en suggestion-card si non-vide. Pas de blocage.
  const [bundleSuggestions, setBundleSuggestions] = useState<BundleOffer[]>([]);
  const [bundlesDismissed, setBundlesDismissed] = useState(false);
  // Profil d'achat derive du client (P2). Charge en arriere-plan, sert a
  // pre-selectionner variante/marque et a proposer les habitudes. null tant
  // que non charge ou si le client n'a pas d'historique — degradation propre.
  const [preferences, setPreferences] = useState<ClientPreference | null>(null);
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const currency = t('chatbot.currency');

  // À l'ouverture : restaure la session récente (< TTL) si elle existe, sinon
  // message d'accueil neuf. Une fermeture accidentelle ne perd plus le fil.
  useEffect(() => {
    if (!visible || messages.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(chatSessionKey(epicerieId, clientId));
        if (raw) {
          const session: PersistedChatSession = JSON.parse(raw);
          const isFresh = Date.now() - session.savedAt < CHAT_SESSION_TTL_MS;
          if (isFresh && session.messages?.length > 0 && !cancelled) {
            setMessages(session.messages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })));
            setLastResponse(session.lastResponse ?? null);
            return;
          }
        }
      } catch {
        // Session illisible/corrompue → on repart simplement de l'accueil.
      }
      if (!cancelled) {
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: tFmt(t, 'chatbot.welcome', { epicerieName }),
          timestamp: new Date(),
        });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, epicerieName, language]);

  // Sauvegarde best-effort de la conversation à chaque évolution (messages ou
  // panier en attente). Écriture asynchrone non bloquante ; jamais d'erreur
  // remontée à l'utilisateur — la persistance est un confort, pas une feature.
  useEffect(() => {
    if (!visible || messages.length === 0) return;
    const session: PersistedChatSession = {
      savedAt: Date.now(),
      messages: messages.map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
      })),
      lastResponse,
    };
    AsyncStorage.setItem(chatSessionKey(epicerieId, clientId), JSON.stringify(session))
      .catch(() => {});
  }, [visible, messages, lastResponse, epicerieId, clientId]);

  // Fetch quick reorder suggestion en arrière-plan dès l'ouverture du chatbot.
  // Échec silencieux (pas d'historique, hors-ligne, etc.) — la fonctionnalité
  // est "nice to have" et ne doit jamais bloquer l'UX.
  useEffect(() => {
    if (!visible) {
      setQuickReorder(null);
      return;
    }
    let cancelled = false;
    quickReorderService.getSuggestion(epicerieId).then(sug => {
      if (!cancelled) setQuickReorder(sug);
    });
    return () => { cancelled = true; };
  }, [visible, epicerieId]);

  // Profil d'achat (P2). Echec silencieux : la personnalisation est "nice to
  // have", son absence laisse le parcours chatbot strictement identique.
  useEffect(() => {
    if (!visible) {
      setPreferences(null);
      return;
    }
    let cancelled = false;
    clientPreferencesService.getPreferences(epicerieId, clientId).then(prefs => {
      if (!cancelled) setPreferences(prefs);
    });
    return () => { cancelled = true; };
  }, [visible, epicerieId, clientId]);

  // V106 — Charge les bundles dispos de l'epicerie au mount du modal.
  // Failure silencieuse (offline, gating, etc.) — la carte n'apparait
  // simplement pas et l'utilisateur peut continuer son parcours chatbot
  // sans friction.
  useEffect(() => {
    if (!visible) {
      setBundleSuggestions([]);
      setBundlesDismissed(false);
      return;
    }
    let cancelled = false;
    bundleOfferService.listAvailableForEpicerie(epicerieId)
      .then(list => { if (!cancelled) setBundleSuggestions(list); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [visible, epicerieId]);

  // Add a message to the chat
  const addMessage = (message: ChatMessageType) => {
    setMessages((prev) => [...prev, message]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Send user message. `overrideText` permet d'envoyer un texte programmatique
  // (chips d'habitudes) sans dependre de l'etat asynchrone de inputText.
  const handleSend = async (overrideText?: string) => {
    const source = overrideText ?? inputText;
    if (source.trim() === '' || isLoading) {
      return;
    }

    const userMessage = source.trim();
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

      // Greffe personnalisation (P3) : pre-selection variante/marque via le
      // profil d'achat. Pure et tolerante au profil null.
      const { response: tuned, notes } = applyPreferences(response, preferences, t);
      setLastResponse(tuned);

      // Generate and add assistant response (uses translator injected from context)
      const assistantMessage = chatbotService.generateResponseMessage(tuned, t);
      const fullMessage = notes.length > 0
        ? `${assistantMessage}\n\n${notes.join('\n')}`.trim()
        : assistantMessage;
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullMessage,
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
      // Feedback DANS la conversation plutôt qu'une Alert bloquante : c'est le
      // pattern naturel d'un chat, et un toast serait invisible ici (le
      // ToastProvider est monté sous la Modal native qui héberge le chatbot).
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: t('chatbot.noProductsToAdd'),
        timestamp: new Date(),
      });
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

  /**
   * Resolve a variant ambiguity: the product was matched but has multiple sales units
   * (e.g. "Lait" → 1L / 500ml). The client tapped one variant — we apply it and clear
   * the {@code hasMultipleVariants} flag so the picker disappears.
   *
   * <p>Mutation est isolée à ce produit ; les autres items du panier ne sont pas
   * touchés. Idempotent : un re-tap sur le même variant ne fait rien de mal.</p>
   */
  const handleResolveVariantChoice = (product: ParsedProduct, variant: VariantOption) => {
    if (!lastResponse) return;

    const updatedIdentified = lastResponse.produitsIdentifies.map(p => {
      if (p !== product) return p;
      return {
        ...p,
        matchedProductUnitId: variant.unitId,
        matchedUnitLabel: variant.label,
        matchedPrice: variant.price,
        matchedStock: variant.stock,
        hasMultipleVariants: false,
        alternativeUnits: undefined,
      };
    });

    setLastResponse({
      ...lastResponse,
      produitsIdentifies: updatedIdentified,
    });

    addMessage({
      id: (Date.now() + 5).toString(),
      role: 'assistant',
      content: tFmt(t, 'chatbot.itemSelected', {
        name: product.matchedProductName ?? product.productName,
        unitSuffix: ` (${variant.label})`,
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

  /**
   * Convertit un {@link QuickReorderItem} en {@link ParsedProduct} pour pouvoir
   * réutiliser le pipeline `onAddToCart` existant. On ne prend que les items
   * disponibles (filtre côté caller). Le champ `unit` est laissé vide — le
   * `matchedUnitLabel` suffit pour l'affichage et le cart.
   */
  const quickReorderItemToParsedProduct = (item: QuickReorderItem): ParsedProduct => ({
    productName: item.productName,
    // `QuickReorderItem.quantity` est en unité de base (recopie de
    // OrderItem.baseQuantity) : on pose le flag pour que `onAddToCart` applique
    // le même traitement qu'à un item matché par le NLU (requestedQuantity en
    // unité de base, `quantite` arrondi au supérieur).
    quantity: item.quantity,
    quantityInBaseUnit: true,
    // NB : `unit` porte ici le libellé de VARIANTE (« 500g »), pas une unité de
    // mesure — il ne sert que de repli à `matchedUnitLabel`. Ces items ne
    // passent jamais par generateResponseMessage (rendu par la card dédiée).
    unit: item.unitLabel || 'pièce',
    isMatched: true,
    matchedProductId: item.productId ?? undefined,
    matchedProductUnitId: item.unitId ?? undefined,
    matchedProductName: item.productName,
    matchedUnitLabel: item.unitLabel,
    matchedPrice: item.currentUnitPrice,
    matchedStock: item.currentStock,
    matchedPhotoUrl: item.photoUrl,
  });

  /**
   * Tap sur "✅ Reprendre" — on ajoute au panier tous les items encore
   * disponibles, on ferme la card et on log un message de confirmation dans
   * la conversation. Les indisponibles sont silencieusement ignorés (le
   * bandeau d'avertissement de la card les a déjà annoncés).
   */
  const handleQuickReorderConfirm = () => {
    if (!quickReorder) return;
    const availableItems = quickReorder.items.filter(i => i.available);
    if (availableItems.length === 0) {
      // Même logique que handleAddToCart : feedback in-chat, pas d'Alert.
      addMessage({
        id: (Date.now() + 5).toString(),
        role: 'assistant',
        content: t('chatbot.quickReorderEmptyAvailable'),
        timestamp: new Date(),
      });
      setQuickReorder(null);
      return;
    }
    onAddToCart(availableItems.map(quickReorderItemToParsedProduct));
    addMessage({
      id: (Date.now() + 6).toString(),
      role: 'assistant',
      content: tFmt(t, 'chatbot.quickReorderAdded', { count: availableItems.length }),
      timestamp: new Date(),
    });
    setQuickReorder(null);
  };

  /** Tap sur "❌ Nouvelle commande" — on cache la card, le client revient au flow normal. */
  const handleQuickReorderDismiss = () => setQuickReorder(null);

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
            // Purge aussi la session persistée — "vider" doit être définitif,
            // pas restauré à la prochaine ouverture.
            AsyncStorage.removeItem(chatSessionKey(epicerieId, clientId)).catch(() => {});
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

        {/* Quick Reorder card — proposer la dernière commande comme template.
            Affichée seulement si le backend a renvoyé une suggestion (client
            avec au moins une commande livrée sur cette épicerie). */}
        {quickReorder && quickReorder.items.length > 0 && (
          <View style={styles.quickReorderCard}>
            <Text style={styles.quickReorderTitle}>{t('chatbot.quickReorderTitle')}</Text>
            <Text style={styles.quickReorderSubtitle}>
              {tFmt(t, 'chatbot.quickReorderSubtitle', {
                // Localisée selon la langue active (cf. src/utils/dateFormat —
                // TZ retombe sur fr-FR faute de locale Intl tamazight).
                date: formatDate(quickReorder.sourceOrderDate, language, {
                  day: 'numeric', month: 'long',
                }),
                count: quickReorder.availableCount,
                total: quickReorder.estimatedTotal.toFixed(2),
                currency,
              })}
            </Text>

            {/* Rangée d'aperçu : jusqu'à 5 thumbnails, +N si plus */}
            <View style={styles.quickReorderPreview}>
              {quickReorder.items.slice(0, 5).map((item, idx) => (
                <View key={`qr-thumb-${idx}`} style={{ opacity: item.available ? 1 : 0.35 }}>
                  <ProductThumbnail uri={item.photoUrl} size={40} />
                </View>
              ))}
              {quickReorder.items.length > 5 && (
                <View style={styles.quickReorderMoreBadge}>
                  <Text style={styles.quickReorderMoreText}>+{quickReorder.items.length - 5}</Text>
                </View>
              )}
            </View>

            {quickReorder.unavailableCount > 0 && (
              <Text style={styles.quickReorderUnavailableBanner}>
                {tFmt(t, 'chatbot.quickReorderUnavailableBanner', { count: quickReorder.unavailableCount })}
              </Text>
            )}

            <View style={styles.quickReorderActions}>
              <TouchableOpacity
                style={styles.quickReorderDismissBtn}
                onPress={handleQuickReorderDismiss}
                disabled={isLoading}
              >
                <Text style={styles.quickReorderDismissText}>
                  {t('chatbot.quickReorderDismissButton')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickReorderConfirmBtn,
                  quickReorder.availableCount === 0 && styles.quickReorderConfirmBtnDisabled,
                ]}
                onPress={handleQuickReorderConfirm}
                disabled={isLoading || quickReorder.availableCount === 0}
              >
                <Text style={styles.quickReorderConfirmText}>
                  {t('chatbot.quickReorderConfirmButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* V106 — Suggestion-card Bundles. S'affiche apres le quick-reorder
            quand l'epicerie propose des paniers groupes, sauf si le user
            a dismiss. Tap "Voir" -> page epicerie + carousel deja en place. */}
        {!bundlesDismissed && bundleSuggestions.length > 0 && (
          <View style={bundleSuggestStyles.card}>
            <Text style={bundleSuggestStyles.title}>🎁 Découvrez nos paniers groupés</Text>
            <Text style={bundleSuggestStyles.subtitle}>
              {bundleSuggestions.length} offre{bundleSuggestions.length > 1 ? 's' : ''} disponible{bundleSuggestions.length > 1 ? 's' : ''} chez {epicerieName} — prix forfaitaire, économies garanties.
            </Text>
            <View style={bundleSuggestStyles.actions}>
              <TouchableOpacity
                style={bundleSuggestStyles.dismissBtn}
                onPress={() => setBundlesDismissed(true)}
              >
                <Text style={bundleSuggestStyles.dismissText}>Plus tard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={bundleSuggestStyles.confirmBtn}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/(client)/(epicerie)/[id]',
                    params: { id: String(epicerieId) },
                  } as any);
                }}
              >
                <Text style={bundleSuggestStyles.confirmText}>Voir les paniers</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                      <ProductThumbnail uri={opt.photoUrl} />
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

        {/*
          Variant picker — for products matched but with multiple sales units
          (e.g. Lait → 1L / 500ml). Distinct from the inter-product ambiguity
          block above (which works on produitsNonIdentifies). Same visual
          treatment as ambiguity to teach the user "tap a button" pattern.
        */}
        {lastResponse &&
          lastResponse.produitsIdentifies
            .filter(p => p.hasMultipleVariants && p.alternativeUnits && p.alternativeUnits.length > 1)
            .map((product, varIdx) => (
              <View key={`var-${varIdx}`} style={styles.variantContainer}>
                <Text style={styles.variantTitle}>
                  {tFmt(t, 'chatbot.variantPickerTitle', {
                    name: product.matchedProductName ?? product.productName,
                  })}
                </Text>
                {product.alternativeUnits!.map((variant, optIdx) => (
                  <TouchableOpacity
                    key={`var-${varIdx}-opt-${optIdx}`}
                    style={styles.variantOption}
                    onPress={() => handleResolveVariantChoice(product, variant)}
                    disabled={isLoading}
                  >
                    <ProductThumbnail uri={variant.photoUrl ?? product.matchedPhotoUrl} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.variantOptionLabel}>{variant.label}</Text>
                      {variant.stock !== undefined && variant.stock <= 5 ? (
                        <Text style={styles.variantStockLow}>
                          {tFmt(t, 'chatbot.lowStock', { stock: variant.stock })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.variantOptionPrice}>
                      {variant.price.toFixed(2)} {currency}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                    <ProductThumbnail uri={opt.photoUrl} />
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

        {/* Sauvetage "0 resultat" (cas 6) : rien de matche et rien d'actionnable
            (ni ambigüite produit, ni suggestion). Au lieu d'un cul-de-sac, on
            propose les habitudes du client comme chips tappables (envoi direct). */}
        {lastResponse &&
          lastResponse.produitsIdentifies.length === 0 &&
          !lastResponse.produitsNonIdentifies.some((p) => p.hasMultipleProducts) &&
          !(lastResponse.suggestions || []).some((s) => s.options && s.options.length > 0) &&
          preferences && preferences.topProducts.length > 0 && (
            <View style={styles.usualBlock}>
              <Text style={styles.usualTitle}>{t('chatbot.pref.usualTitle')}</Text>
              <View style={styles.usualChips}>
                {preferences.topProducts.slice(0, 6).map((tp) => (
                  <TouchableOpacity
                    key={`usual-${tp.productId}`}
                    style={styles.usualChip}
                    onPress={() => handleSend(tp.productName)}
                    disabled={isLoading}
                  >
                    <Text style={styles.usualChipText} numberOfLines={1}>{tp.productName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
            onSubmitEditing={() => handleSend()}
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
            onPress={() => handleSend()}
            disabled={inputText.trim() === '' || isLoading}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>

        {/* Suggestions — chips dynamiques bases sur les habitudes du client
            (tap = envoi direct du nom produit), sinon exemples statiques. */}
        <View style={[styles.suggestionsContainer, { paddingBottom: insets.bottom + 8 }]}>
          {preferences && preferences.topProducts.length > 0 ? (
            preferences.topProducts.slice(0, 3).map((tp) => (
              <TouchableOpacity
                key={`habit-${tp.productId}`}
                style={styles.suggestionChip}
                onPress={() => handleSend(tp.productName)}
                disabled={isLoading}
              >
                <Text style={styles.suggestionText} numberOfLines={1}>🛒 {tp.productName}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <>
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
            </>
          )}
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
    marginStart: 8,
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
    marginStart: 8,
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
    marginEnd: 8,
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
  // Variant picker — bleu pour le distinguer du jaune des ambiguites produits
  // et du vert des suggestions. Aide l'utilisateur a categoriser visuellement.
  variantContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderTopWidth: 1,
    borderTopColor: '#90CAF9',
  },
  variantTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D47A1',
    marginBottom: 8,
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#42A5F5',
  },
  variantOptionLabel: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  variantOptionPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
    marginStart: 8,
  },
  variantStockLow: {
    fontSize: 11,
    color: '#E65100',
    marginTop: 2,
    fontStyle: 'italic',
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
    marginStart: 8,
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

  // ── Quick Reorder card ─────────────────────────────────────────────────
  // Couleur violet/indigo distincte des 3 blocs existants (jaune ambigüité,
  // bleu variantes, vert suggestions) pour signaler une action "rapide" et
  // pas un choix de désambiguïsation.
  quickReorderCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 14,
    backgroundColor: '#EDE7F6',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#673AB7',
  },
  quickReorderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#311B92',
    marginBottom: 2,
  },
  quickReorderSubtitle: {
    fontSize: 12,
    color: '#5E35B1',
    marginBottom: 10,
  },
  quickReorderPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  quickReorderMoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#B39DDB',
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 10,
  },
  quickReorderMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickReorderUnavailableBanner: {
    fontSize: 12,
    color: '#E65100',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  quickReorderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickReorderDismissBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B39DDB',
    alignItems: 'center',
  },
  quickReorderDismissText: {
    fontSize: 13,
    color: '#5E35B1',
    fontWeight: '600',
  },
  quickReorderConfirmBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#673AB7',
    alignItems: 'center',
  },
  quickReorderConfirmBtnDisabled: {
    backgroundColor: '#B39DDB',
  },
  quickReorderConfirmText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── Sauvetage "0 resultat" : habitudes du client ────────────────────────
  usualBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#EDE7F6',
    borderTopWidth: 1,
    borderTopColor: '#D1C4E9',
  },
  usualTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#311B92',
    marginBottom: 8,
  },
  usualChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  usualChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9575CD',
    maxWidth: '100%',
  },
  usualChipText: {
    fontSize: 13,
    color: '#5E35B1',
    fontWeight: '600',
  },
});

// V106 — Styles dedies a la suggestion-card "Bundles disponibles". Sortis
// du styles principal pour rester localises (composant supprimable sans
// casser le reste si on retire la feature).
const bundleSuggestStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    margin: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E65100',
  },
  subtitle: {
    fontSize: 13,
    color: '#8D6E63',
    marginTop: 4,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  dismissBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissText: {
    color: '#8D6E63',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
