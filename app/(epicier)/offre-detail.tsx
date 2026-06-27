export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Ecran de creation / edition d'un bundle offer (panier groupe).
 *
 * Recu en param : `id` optionnel (creation si absent, edition sinon).
 *
 * 4 onglets :
 *   - Infos      : nom, description, photo, prix, validity window optionnelle
 *   - Produits   : ajout/retrait d'items via modal picker
 *   - Traductions: FR (defaut) + AR/EN/TZ via TranslationTabs
 *   - Apercu     : rendu identique a celui que verra le client (lecture seule)
 *
 * Actions header :
 *   - Save (cree si pas d'id, met a jour sinon)
 *   - Toggle status (Publier / Mettre en pause / Remettre brouillon)
 *   - Delete (avec confirmation)
 *   - Toggle "Mettre en avant" (featured cross-epicerie)
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import bundleOfferService, {
  BundleOffer,
  BundleOfferItem,
  BundleOfferStatus,
  CreateBundleOfferPayload,
} from '../../src/services/bundleOfferService';
import { epicerieService } from '../../src/services/epicerieService';
import { productService } from '../../src/services/productService';
import { TranslationTabs } from '../../src/components/epicier/TranslationTabs';
import { EMPTY_TRANSLATIONS, Epicerie, Product, ProductTranslations } from '../../src/type';

const BLUE = Colors.primary;
const GREEN = '#388E3C';
const RED = '#C62828';

type Tab = 'infos' | 'products' | 'translations' | 'preview';

interface DraftItem {
  productId: number;
  productUnitId?: number | null;
  productName: string;
  productPhotoUrl?: string | null;
  unitLabel?: string | null;
  unitPrice?: number | null;
  quantity: number;
}

/**
 * Prix de vente représentatif d'un produit. Le prix réel est porté par les
 * variantes (ProductUnit.prix) ; `product.prix` est legacy/0 dès qu'il existe
 * des units — d'où des prix à 0 si on le lisait brut. Résolution via les units
 * (variante disponible en priorité), repli sur prix. Aligné sur le résolveur
 * web et le backend (BundleOfferItemDTO).
 */
function resolveProductPrice(p: Product): number {
  const units = p.units ?? [];
  if (units.length > 0) {
    const u = units.find(u => u.isAvailable && (u.stock ?? 0) > 0)
          ?? units.find(u => u.isAvailable)
          ?? units[0];
    return u?.prix ?? p.prix ?? 0;
  }
  return p.prix ?? 0;
}

export default function OffreDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? parseInt(params.id, 10) : null;
  const isEditing = editingId != null && !Number.isNaN(editingId);

  // ── State form ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('infos');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // photoUrl = URL absolue actuelle (resolue par le backend a l'edition).
  // selectedImage = nouvelle image choisie localement, pas encore uploadee.
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [price, setPrice] = useState('');
  const [currencyCode, setCurrencyCode] = useState('MAD');
  // Fenêtre de validité optionnelle (parité web). null = pas de borne →
  // « offre permanente » de ce côté de la fenêtre.
  const [validFrom, setValidFrom] = useState<Date | null>(null);
  const [validTo, setValidTo] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [status, setStatus] = useState<BundleOfferStatus>('DRAFT');
  const [isFeatured, setIsFeatured] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [translations, setTranslations] = useState<ProductTranslations>(EMPTY_TRANSLATIONS);
  // V106 — Etat de la traduction automatique (LLM backend). Affiche un
  // spinner dans TranslationTabs pendant l'appel.
  const [translating, setTranslating] = useState(false);

  // Sync FR avec l'onglet Infos : a chaque modif de name/description, on
  // met a jour translations.fr pour que l'onglet Langues reflete la source
  // de verite. Aligne sur le comportement web (FR en lecture seule reliee
  // a Infos).
  useEffect(() => {
    setTranslations(prev => ({
      ...prev,
      fr: { nom: name, description: description },
    }));
  }, [name, description]);

  // Picker produits
  const [showPicker, setShowPicker] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // ── Init : charge l'epicerie + le bundle (si edition) ──────────────
  useEffect(() => {
    (async () => {
      try {
        const epicerie = await epicerieService.getMyEpicerie();
        if (epicerie?.currency?.code) {
          setCurrencyCode(epicerie.currency.code);
        }
        if (isEditing && editingId) {
          const bundle = await bundleOfferService.getById(editingId);
          hydrateFromBundle(bundle);
        }
      } catch (err: any) {
        Alert.alert('Erreur', err?.response?.data?.message || err?.message || 'Chargement impossible');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateFromBundle = (b: BundleOffer) => {
    setName(b.name);
    setDescription(b.description ?? '');
    setPhotoUrl(b.photoUrl ?? '');
    setPrice(String(b.price ?? ''));
    setCurrencyCode(b.currencyCode ?? 'MAD');
    setValidFrom(b.validFrom ? new Date(b.validFrom) : null);
    setValidTo(b.validTo ? new Date(b.validTo) : null);
    setStatus(b.status);
    setIsFeatured(!!b.isFeatured);
    setItems((b.items ?? []).map(i => ({
      productId: i.productId,
      productUnitId: i.productUnitId,
      productName: i.productName ?? '?',
      productPhotoUrl: i.productPhotoUrl,
      unitLabel: i.unitLabel,
      unitPrice: i.unitPrice,
      quantity: i.quantity ?? 1,
    })));
    // Map backend translations -> ProductTranslations { nom, description }
    const t: ProductTranslations = { ...EMPTY_TRANSLATIONS };
    (b.translations ?? []).forEach(tr => {
      if (tr.language === 'fr' || tr.language === 'ar' || tr.language === 'en' || tr.language === 'tz') {
        t[tr.language] = { nom: tr.name, description: tr.description ?? '' };
      }
    });
    setTranslations(t);
  };

  // ── Save ────────────────────────────────────────────────────────────
  // ── Traduction automatique ──────────────────────────────────────────
  // Appelle l'endpoint /products/translate avec le nom + description FR.
  // Le backend retourne {fr,ar,en,tz}. On ne touche pas a FR (source de
  // verite = onglet Infos), on remplit uniquement AR/EN/TZ. L'epicier
  // peut ensuite modifier librement chaque langue.
  const handleAutoTranslate = async (): Promise<Partial<ProductTranslations>> => {
    const nom = name.trim();
    if (!nom) {
      Alert.alert(
        'Nom requis',
        'Saisissez d\'abord le nom dans l\'onglet Infos avant de traduire.',
      );
      setActiveTab('infos');
      return {};
    }
    setTranslating(true);
    try {
      const result = await productService.translateProduct(nom, description.trim());
      // Merge AR/EN/TZ dans le state, FR intouche.
      const next: Partial<ProductTranslations> = {};
      for (const lang of ['ar', 'en', 'tz'] as const) {
        const payload = result?.[lang];
        if (payload) {
          next[lang] = {
            nom: payload.nom ?? '',
            description: payload.description ?? '',
          };
        }
      }
      setTranslations(prev => ({ ...prev, ...next }));
      return next;
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Traduction impossible — reessayez.');
      return {};
    } finally {
      setTranslating(false);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie pour choisir une photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };

  /** Retire l'image (locale si pas encore uploadee, sinon supprime cote backend). */
  const removeImage = async () => {
    if (selectedImage) {
      setSelectedImage(null);
      return;
    }
    if (isEditing && editingId && photoUrl) {
      try {
        await bundleOfferService.clearPhoto(editingId);
        setPhotoUrl('');
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Suppression de la photo impossible.');
      }
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Le nom est obligatoire.';
    const p = parseFloat(price.replace(',', '.'));
    if (!Number.isFinite(p) || p < 0) return 'Prix invalide.';
    if (items.length === 0) return 'Ajoutez au moins un produit au panier.';
    for (const it of items) {
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        return `Quantite invalide pour ${it.productName}.`;
      }
    }
    if (validFrom && validTo && validTo.getTime() < validFrom.getTime()) {
      return 'La date de fin doit etre apres la date de debut.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Validation', err);
      return;
    }
    setSaving(true);
    try {
      // photoUrl n'est plus envoye dans le payload JSON : la photo est geree via
      // l'endpoint multipart dedie (uploadPhoto), comme pour les produits. Omettre
      // le champ preserve la photo existante cote backend lors d'un update.
      const payload: CreateBundleOfferPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: parseFloat(price.replace(',', '.')),
        currencyCode,
        validFrom: validFrom ? validFrom.toISOString() : null,
        validTo: validTo ? validTo.toISOString() : null,
        items: items.map((it, idx) => ({
          productId: it.productId,
          productUnitId: it.productUnitId ?? null,
          quantity: it.quantity,
          displayOrder: idx,
        })),
        // Map ProductTranslations -> backend payload (skip lang sans nom)
        translations: (Object.entries(translations) as Array<[
          'fr' | 'ar' | 'en' | 'tz',
          { nom: string; description: string }
        ]>)
          .filter(([, v]) => v.nom?.trim())
          .map(([lang, v]) => ({
            language: lang,
            name: v.nom.trim(),
            description: v.description?.trim() || undefined,
          })),
      };
      let saved: BundleOffer;
      if (isEditing && editingId) {
        saved = await bundleOfferService.update(editingId, payload);
      } else {
        saved = await bundleOfferService.create(payload);
      }

      // Etape 2 : si une nouvelle image a ete choisie, on l'uploade maintenant
      // qu'on dispose de l'id du bundle (la photo est une sous-ressource de l'id).
      if (selectedImage) {
        try {
          saved = await bundleOfferService.uploadPhoto(saved.id, selectedImage);
          setPhotoUrl(saved.photoUrl ?? '');
          setSelectedImage(null);
        } catch (e: any) {
          Alert.alert(
            'Photo',
            "L'offre est enregistrée, mais l'upload de la photo a échoué. Réessayez depuis l'édition.",
          );
        }
      }

      Alert.alert(isEditing ? 'Offre mise a jour' : 'Offre creee', saved.name);
      router.back();
    } catch (err: any) {
      if (!err?.__subscriptionGateHandled) {
        Alert.alert('Erreur', err?.response?.data?.message || err?.message || 'Sauvegarde impossible');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!isEditing || !editingId) return;
    const next: BundleOfferStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const updated = await bundleOfferService.changeStatus(editingId, next);
      setStatus(updated.status);
      Alert.alert(next === 'ACTIVE' ? 'Offre publiee' : 'Offre en pause', updated.name);
    } catch (err: any) {
      if (!err?.__subscriptionGateHandled) {
        Alert.alert('Erreur', err?.response?.data?.message || err?.message || 'Changement impossible');
      }
    }
  };

  const handleToggleFeatured = async (value: boolean) => {
    if (!isEditing || !editingId) {
      setIsFeatured(value);
      return;
    }
    try {
      const updated = await bundleOfferService.setFeatured(editingId, value);
      setIsFeatured(!!updated.isFeatured);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message || err?.message || 'Modification impossible');
    }
  };

  const handleDelete = () => {
    if (!isEditing || !editingId) return;
    Alert.alert('Supprimer cette offre ?', 'Action irreversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await bundleOfferService.delete(editingId);
            router.back();
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.message || err?.message || 'Suppression impossible');
          }
        },
      },
    ]);
  };

  // ── Picker produits ──────────────────────────────────────────────────
  const openPicker = async () => {
    setShowPicker(true);
    setPickerSearch('');
    if (allProducts.length === 0) {
      setProductsLoading(true);
      try {
        const epicerie = await epicerieService.getMyEpicerie();
        const prods = await productService.getProductsByEpicerie(epicerie.id, false, true);
        setAllProducts(prods);
      } catch (err: any) {
        Alert.alert('Erreur', err?.message || 'Impossible de charger les produits');
      } finally {
        setProductsLoading(false);
      }
    }
  };

  const filteredProducts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(p =>
      p.nom?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [allProducts, pickerSearch]);

  const addItem = (p: Product) => {
    // Empeche le doublon strict (meme produit + unite par defaut). L'epicier
    // peut toujours augmenter la quantite via le selecteur dans l'onglet.
    if (items.some(it => it.productId === p.id && it.productUnitId == null)) {
      Alert.alert('Deja ajoute', `${p.nom} est deja dans ce panier. Augmentez la quantite si besoin.`);
      return;
    }
    setItems(prev => [
      ...prev,
      {
        productId: p.id,
        productName: p.nom,
        productPhotoUrl: p.photoUrl,
        unitPrice: resolveProductPrice(p),
        quantity: 1,
      },
    ]);
    setShowPicker(false);
  };

  const updateItemQty = (idx: number, delta: number) => {
    setItems(prev => {
      const next = [...prev];
      const newQty = (next[idx].quantity ?? 1) + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: newQty };
      }
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Calculs derives pour preview ────────────────────────────────────
  const sumItemsPrice = useMemo(() =>
    items.reduce((sum, it) => sum + (it.unitPrice ?? 0) * (it.quantity ?? 0), 0),
  [items]);
  const priceNum = parseFloat(price.replace(',', '.')) || 0;
  const savings = Math.max(0, sumItemsPrice - priceNum);
  const savingsPct = sumItemsPrice > 0 ? Math.round((savings / sumItemsPrice) * 100) : 0;

  // Libellé de la fenêtre de validité pour l'aperçu (parité web).
  const validityLabel = useMemo(() => {
    const f = validFrom ? validFrom.toLocaleDateString('fr-FR') : null;
    const t = validTo ? validTo.toLocaleDateString('fr-FR') : null;
    if (f && t) return `Du ${f} au ${t}`;
    if (f) return `À partir du ${f}`;
    if (t) return `Jusqu'au ${t}`;
    return 'Offre permanente';
  }, [validFrom, validTo]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chargement…</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isEditing ? name || 'Modifier' : 'Nouvelle offre'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Ionicons name="checkmark" size={26} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsBar}>
        {(['infos', 'products', 'translations', 'preview'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'infos' ? 'Infos'
                : t === 'products' ? `Produits (${items.length})`
                : t === 'translations' ? 'Langues'
                : 'Aperçu'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 120 }}>
          {activeTab === 'infos' && (
            <View style={styles.section}>
              <Text style={styles.label}>Nom *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Panier Ramadan"
                placeholderTextColor="#bbb"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={description}
                onChangeText={setDescription}
                placeholder="Decrivez ce que contient le panier…"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.label}>Photo de couverture</Text>
              {(() => {
                const previewUri = selectedImage?.uri || photoUrl || null;
                return (
                  <View>
                    <TouchableOpacity
                      style={styles.imagePicker}
                      onPress={pickImage}
                      activeOpacity={0.85}
                    >
                      {previewUri ? (
                        <Image source={{ uri: previewUri }} style={styles.imagePickerPreview} resizeMode="cover" />
                      ) : (
                        <View style={styles.imagePickerPlaceholder}>
                          <MaterialCommunityIcons name="image-plus" size={32} color="#9E9E9E" />
                          <Text style={styles.imagePickerHint}>Choisir une image</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {previewUri && (
                      <View style={styles.imageActions}>
                        <TouchableOpacity style={styles.imageActionBtn} onPress={pickImage}>
                          <Ionicons name="swap-horizontal" size={16} color={BLUE} />
                          <Text style={styles.imageActionText}>Changer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.imageActionBtn} onPress={removeImage}>
                          <Ionicons name="trash-outline" size={16} color={RED} />
                          <Text style={[styles.imageActionText, { color: RED }]}>Retirer</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {!isEditing && selectedImage && (
                      <Text style={styles.hint}>
                        La photo sera envoyée à l'enregistrement de l'offre.
                      </Text>
                    )}
                  </View>
                );
              })()}

              <Text style={styles.label}>Prix forfaitaire ({currencyCode}) *</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="99.00"
                placeholderTextColor="#bbb"
              />

              {/* Fenêtre de validité (parité web) — optionnelle. */}
              <Text style={styles.label}>Validité de l'offre</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setShowFromPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateFieldLabel}>Début</Text>
                  <Text style={[styles.dateFieldValue, !validFrom && styles.dateFieldEmpty]}>
                    {validFrom ? validFrom.toLocaleDateString('fr-FR') : 'Aucune'}
                  </Text>
                </TouchableOpacity>
                {validFrom ? (
                  <TouchableOpacity
                    style={styles.dateClearBtn}
                    onPress={() => setValidFrom(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color="#888" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.dateIcon}>
                    <Ionicons name="calendar-outline" size={18} color="#aaa" />
                  </View>
                )}
              </View>

              <View style={[styles.dateRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setShowToPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateFieldLabel}>Fin</Text>
                  <Text style={[styles.dateFieldValue, !validTo && styles.dateFieldEmpty]}>
                    {validTo ? validTo.toLocaleDateString('fr-FR') : 'Aucune'}
                  </Text>
                </TouchableOpacity>
                {validTo ? (
                  <TouchableOpacity
                    style={styles.dateClearBtn}
                    onPress={() => setValidTo(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color="#888" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.dateIcon}>
                    <Ionicons name="calendar-outline" size={18} color="#aaa" />
                  </View>
                )}
              </View>
              <Text style={styles.hint}>Laissez vide pour une offre permanente.</Text>

              <DateTimePickerModal
                isVisible={showFromPicker}
                mode="date"
                date={validFrom ?? new Date()}
                onConfirm={(d) => { setShowFromPicker(false); setValidFrom(d); }}
                onCancel={() => setShowFromPicker(false)}
              />
              <DateTimePickerModal
                isVisible={showToPicker}
                mode="date"
                date={validTo ?? validFrom ?? new Date()}
                minimumDate={validFrom ?? undefined}
                onConfirm={(d) => { setShowToPicker(false); setValidTo(d); }}
                onCancel={() => setShowToPicker(false)}
              />

              {isEditing && (
                <View style={styles.featuredRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featuredLabel}>Mettre en avant</Text>
                    <Text style={styles.featuredHint}>
                      Affiche cette offre sur la home des clients (toutes epiceries confondues).
                    </Text>
                  </View>
                  <Switch
                    value={isFeatured}
                    onValueChange={handleToggleFeatured}
                    trackColor={{ false: '#ccc', true: '#FFC107' }}
                  />
                </View>
              )}
            </View>
          )}

          {activeTab === 'products' && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.addBtn} onPress={openPicker} activeOpacity={0.85}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Ajouter un produit</Text>
              </TouchableOpacity>

              {items.length === 0 ? (
                <Text style={styles.emptyItemsText}>
                  Aucun produit pour l'instant. Ajoutez les articles qui composent ce panier.
                </Text>
              ) : (
                items.map((it, idx) => (
                  <View key={`${it.productId}-${idx}`} style={styles.itemRow}>
                    {it.productPhotoUrl ? (
                      <Image source={{ uri: it.productPhotoUrl }} style={styles.itemThumb} />
                    ) : (
                      <View style={[styles.itemThumb, styles.itemThumbFallback]}>
                        <MaterialCommunityIcons name="package-variant" size={18} color="#aaa" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{it.productName}</Text>
                      {it.unitPrice != null && (
                        <Text style={styles.itemPrice}>
                          {it.unitPrice.toFixed(2)} {currencyCode} l'unite
                        </Text>
                      )}
                    </View>
                    <View style={styles.qtyBox}>
                      <TouchableOpacity onPress={() => updateItemQty(idx, -1)} style={styles.qtyBtn}>
                        <Ionicons name="remove" size={16} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{it.quantity}</Text>
                      <TouchableOpacity onPress={() => updateItemQty(idx, 1)} style={styles.qtyBtn}>
                        <Ionicons name="add" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={RED} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'translations' && (
            <View style={styles.section}>
              <TranslationTabs
                translations={translations}
                onChange={setTranslations}
                requiredLanguage="fr"
                translating={translating}
                onAutoTranslate={handleAutoTranslate}
              />
              <Text style={styles.hint}>
                Le francais reste la source de verite — ce qui est tape sur l'onglet Infos
                ci-dessus est utilise comme nom/description par defaut. Le bouton
                "Traduire automatiquement" pre-remplit AR/EN/TZ via IA, modifiables ensuite.
              </Text>
            </View>
          )}

          {activeTab === 'preview' && (
            <View style={styles.section}>
              <View style={styles.previewCard}>
                {(selectedImage?.uri || photoUrl) ? (
                  <Image source={{ uri: selectedImage?.uri || photoUrl }} style={styles.previewCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.previewCover, styles.coverFallback]}>
                    <MaterialCommunityIcons name="gift-outline" size={36} color="#BDBDBD" />
                  </View>
                )}
                <View style={{ padding: 14 }}>
                  <Text style={styles.previewTitle}>{name || 'Nom de l\'offre'}</Text>
                  {description ? <Text style={styles.previewDesc}>{description}</Text> : null}
                  <View style={styles.previewMeta}>
                    <Text style={styles.previewItems}>{items.length} produit{items.length > 1 ? 's' : ''}</Text>
                    {savings > 0 && (
                      <View style={styles.previewSavings}>
                        <Text style={styles.previewSavingsText}>
                          Economisez {savings.toFixed(2)} {currencyCode} (-{savingsPct}%)
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.previewPriceRow}>
                    <Text style={styles.previewPrice}>
                      {(priceNum || 0).toFixed(2)} {currencyCode}
                    </Text>
                    {sumItemsPrice > priceNum && (
                      <Text style={styles.previewPriceOld}>
                        {sumItemsPrice.toFixed(2)} {currencyCode}
                      </Text>
                    )}
                  </View>

                  <View style={styles.previewValidity}>
                    <Ionicons name="calendar-outline" size={14} color="#888" />
                    <Text style={styles.previewValidityText}>{validityLabel}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer actions (publish/delete) — uniquement en mode edition */}
      {isEditing && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerDelete} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={RED} />
            <Text style={[styles.footerBtnText, { color: RED }]}>Supprimer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerToggle, status === 'ACTIVE' ? styles.footerPause : styles.footerPublish]}
            onPress={handleToggleStatus}
          >
            <Ionicons name={status === 'ACTIVE' ? 'pause' : 'play'} size={18} color="#fff" />
            <Text style={[styles.footerBtnText, { color: '#fff' }]}>
              {status === 'ACTIVE' ? 'Mettre en pause' : 'Publier'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal picker produits */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choisir un produit</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 12, backgroundColor: '#F5F7FA', flex: 1 }}>
            <TextInput
              style={styles.input}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Rechercher…"
              placeholderTextColor="#bbb"
            />
            {productsLoading ? (
              <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /></View>
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(it) => String(it.id)}
                style={{ marginTop: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickerRow} onPress={() => addItem(item)}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.itemThumb} />
                    ) : (
                      <View style={[styles.itemThumb, styles.itemThumbFallback]}>
                        <MaterialCommunityIcons name="package-variant" size={18} color="#aaa" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.nom}</Text>
                      <Text style={styles.itemPrice}>{resolveProductPrice(item).toFixed(2)} {currencyCode}</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={BLUE} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyItemsText, { textAlign: 'center', marginTop: 24 }]}>
                    Aucun produit trouve.
                  </Text>
                }
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BLUE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BLUE,
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginHorizontal: 12 },

  tabsBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: BLUE },
  tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: BLUE },

  body: { flex: 1, backgroundColor: '#F5F7FA' },
  section: { padding: 16, gap: 10 },

  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
  },
  inputMulti: { minHeight: 80 },
  hint: { fontSize: 12, color: '#888', lineHeight: 16, marginTop: -2 },
  // ── Fenêtre de validité ──────────────────────────────────────────
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateFieldLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateFieldValue: { fontSize: 15, color: '#222', fontWeight: '700', marginTop: 2 },
  dateFieldEmpty: { color: '#bbb', fontWeight: '500' },
  dateClearBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  dateIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  // ── Sélecteur d'image de couverture ───────────────────────────────────
  imagePicker: {
    height: 160,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginTop: 4,
  },
  imagePickerPreview: { width: '100%', height: '100%' },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imagePickerHint: { marginTop: 6, fontSize: 13, color: '#9E9E9E' },
  imageActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  imageActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  imageActionText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  featuredLabel: { fontSize: 14, fontWeight: '700', color: '#E65100' },
  featuredHint: { fontSize: 12, color: '#8D6E63', marginTop: 2 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BLUE,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  emptyItemsText: { color: '#888', fontSize: 14, paddingVertical: 16, lineHeight: 20 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  itemThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F0F0F0' },
  itemThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#222' },
  itemPrice: { fontSize: 12, color: '#666' },

  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { minWidth: 28, textAlign: 'center', fontWeight: '700', fontSize: 14 },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },

  previewCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  previewCover: { width: '100%', height: 180, backgroundColor: '#ECEFF1' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 20, fontWeight: '800', color: '#212121' },
  previewDesc: { fontSize: 14, color: '#616161', marginTop: 4, lineHeight: 20 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  previewItems: { fontSize: 13, color: '#666' },
  previewSavings: { backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  previewSavingsText: { color: '#C62828', fontSize: 12, fontWeight: '700' },
  previewPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12 },
  previewPrice: { fontSize: 26, fontWeight: '900', color: GREEN },
  previewPriceOld: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  previewValidity: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  previewValidityText: { fontSize: 13, color: '#666', fontWeight: '600' },

  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RED,
  },
  footerToggle: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  footerPublish: { backgroundColor: GREEN },
  footerPause: { backgroundColor: '#F57C00' },
  footerBtnText: { fontWeight: '700', fontSize: 14 },
});
