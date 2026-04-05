/**
 * InfoTab — Onglet Infos de la fiche produit (épicier)
 *
 * Gère la création et la modification d'un produit avec :
 *  - Saisie multi-langue (nom + description) via TranslationTabs
 *  - Upload d'image (fetch API pour contourner SSL React Native)
 *  - Prix, stock initial, catégorie, disponibilité
 *
 * Backward-compat : le champ `nom` (fr) est toujours inclus dans le payload
 * JSON pour les backends qui ne gèrent pas encore les translations.
 */

import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, categoryService } from '../../../../services/categoryService';
import { epicerieService } from '../../../../services/epicerieService';
import { productService } from '../../../../services/productService';
import {
  EMPTY_TRANSLATIONS,
  Product,
  ProductTranslations,
  Tag,
} from '../../../../type';
import { tagService } from '../../../../services/tagService';
import { API_CONFIG, STORAGE_KEYS } from '../../../../constants/config';
import { TranslationTabs } from '../../../../components/epicier/TranslationTabs';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface InfoTabProps {
  product: Product | null;
  onSaved: (product: Product) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Construit l'état initial des traductions depuis un produit existant.
 * Si le produit a déjà des translations (backend i18n activé) on les utilise ;
 * sinon on place le nom/description actuels dans la langue française.
 */
function initTranslations(product: Product | null): ProductTranslations {
  if (!product) return EMPTY_TRANSLATIONS;

  if (product.translations) return product.translations;

  // Backward-compat : remplir le français depuis les champs plats
  return {
    ...EMPTY_TRANSLATIONS,
    fr: {
      nom: product.nom ?? '',
      description: product.description ?? '',
    },
  };
}

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

export const InfoTab: React.FC<InfoTabProps> = ({ product, onSaved }) => {
  const isEdit = !!product?.id;

  const [saving, setSaving]           = useState(false);
  const [translating, setTranslating] = useState(false);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categories, setCategories]   = useState<Category[]>([]);

  // Multi-langue : seul état maître pour nom + description
  const [translations, setTranslations] = useState<ProductTranslations>(
    () => initTranslations(product),
  );

  const [prix, setPrix]             = useState(product?.prix?.toString() ?? '');
  const [stock, setStock]           = useState(product?.stock?.toString() ?? '0');
  const [categoryId, setCategoryId] = useState(product?.categoryId?.toString() ?? '');
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [previewUri, setPreviewUri] =
    useState<string | null>(product?.photoUrl ?? null);

  // Tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    () => product?.tags?.map(t => t.id) ?? [],
  );

  useEffect(() => {
    loadCategories();
    loadTags();
  }, []);

  const loadCategories = async () => {
    try {
      // Charger le type de l'épicerie courante pour filtrer les catégories pertinentes
      const myEpicerie = await epicerieService.getMyEpicerie();
      const epicerieType = myEpicerie.epicerieType ?? 'EPICERIE_GENERALE';
      const data = await categoryService.getCategoriesByType(epicerieType);
      const flat = categoryService.flattenCategories(data);
      setCategories(flat);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les catégories');
    } finally {
      setLoadingCats(false);
    }
  };

  const loadTags = async () => {
    try {
      const data = await tagService.getForProductsFr();
      setAvailableTags(data);
    } catch {}
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
      setPreviewUri(result.assets[0].uri);
    }
  };

  // ── Validation ──────────────────────────────

  const validate = (): boolean => {
    const frNom = translations.fr.nom.trim();
    if (!frNom) {
      Alert.alert('Erreur', 'Le nom en français est requis');
      return false;
    }
    if (!prix.trim()) {
      Alert.alert('Erreur', 'Le prix est requis');
      return false;
    }
    const prixNum = parseFloat(prix);
    if (isNaN(prixNum) || prixNum < 0) {
      Alert.alert('Erreur', 'Prix invalide');
      return false;
    }
    return true;
  };

  // ── Traduction automatique ──────────────────

  const handleAutoTranslate = async (): Promise<Partial<ProductTranslations>> => {
    const frNom = translations.fr.nom.trim();
    if (!frNom) {
      Alert.alert('Champ manquant', 'Saisissez d\'abord le nom en français.');
      return {};
    }
    setTranslating(true);
    try {
      const result = await productService.translateProduct(frNom, translations.fr.description.trim());
      // Fusionner AR/EN/TZ dans les traductions actuelles
      const merged: ProductTranslations = { ...translations };
      for (const lang of ['ar', 'en', 'tz'] as const) {
        if (result[lang]) {
          merged[lang] = { nom: result[lang].nom ?? '', description: result[lang].description ?? '' };
        }
      }
      setTranslations(merged);
      return merged;
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Traduction automatique indisponible');
      return {};
    } finally {
      setTranslating(false);
    }
  };

  // ── Sauvegarde ──────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;

    const prixNum   = parseFloat(prix);
    const stockNum  = parseInt(stock) || 0;
    const frNom     = translations.fr.nom.trim();
    const frDesc    = translations.fr.description.trim();

    setSaving(true);
    try {
      let savedProduct: Product;

      if (selectedImage) {
        // ── Upload avec image (fetch API — contournement SSL React Native) ──
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const formData = new FormData();

        // Champs plats (backward-compat backends sans i18n)
        formData.append('nom',         frNom);
        formData.append('description', frDesc);
        formData.append('prix',        prixNum.toString());
        formData.append('stock',       stockNum.toString());
        formData.append('isAvailable', isAvailable.toString());
        if (categoryId) formData.append('categoryId', categoryId);

        // Toutes les traductions pour les backends i18n-ready
        formData.append('translations', JSON.stringify(translations));
        formData.append('tagIds', JSON.stringify(selectedTagIds));

        formData.append('image', {
          uri:  selectedImage.uri,
          type: 'image/jpeg',
          name: `product-${Date.now()}.jpg`,
        } as any);

        const url = isEdit
          ? `${API_CONFIG.BASE_URL}/products/${product!.id}`
          : `${API_CONFIG.BASE_URL}/products`;

        const resp = await fetch(url, {
          method:  isEdit ? 'PUT' : 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    formData,
        });
        if (!resp.ok) throw new Error(`Erreur HTTP ${resp.status}`);
        savedProduct = await resp.json();

      } else {
        // ── Sans image (FormData via fetch, sans fichier) ──
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const formData = new FormData();
        formData.append('nom',         frNom);
        formData.append('description', frDesc);
        formData.append('prix',        prixNum.toString());
        formData.append('stock',       stockNum.toString());
        formData.append('isAvailable', isAvailable.toString());
        if (categoryId) formData.append('categoryId', categoryId);
        formData.append('translations', JSON.stringify(translations));
        formData.append('tagIds', JSON.stringify(selectedTagIds));

        const url = isEdit
          ? `${API_CONFIG.BASE_URL}/products/${product!.id}`
          : `${API_CONFIG.BASE_URL}/products`;

        const resp = await fetch(url, {
          method:  isEdit ? 'PUT' : 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    formData,
        });
        if (!resp.ok) throw new Error(`Erreur HTTP ${resp.status}`);
        savedProduct = await resp.json();

      }

      onSaved(savedProduct);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Photo ── */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.8}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.photoImg} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>📷</Text>
                <Text style={styles.photoPlaceholderText}>Ajouter une photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {previewUri && (
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => { setPreviewUri(null); setSelectedImage(null); }}
            >
              <Text style={styles.removePhotoBtnText}>✕ Retirer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Traductions (nom + description dans toutes les langues) ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nom & Description</Text>
          <Text style={styles.sectionHint}>FR requis — autres langues optionnelles</Text>
        </View>
        <TranslationTabs
          translations={translations}
          onChange={setTranslations}
          onAutoTranslate={handleAutoTranslate}
          translating={translating}
        />

        {/* ── Prix + Stock ── */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Prix (DH) <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={prix}
              onChangeText={setPrix}
              placeholder="0.00"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>Prix de base</Text>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Stock initial</Text>
            <TextInput
              style={styles.input}
              value={stock}
              onChangeText={setStock}
              placeholder="0"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>Ajuster via onglet Stock</Text>
          </View>
        </View>

        {/* ── Catégorie ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Catégorie</Text>
          {loadingCats ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={categoryId}
                onValueChange={setCategoryId}
                style={styles.picker}
              >
                <Picker.Item label="— Sélectionner une catégorie —" value="" />
                {categories.map((cat) => (
                  <Picker.Item
                    key={cat.id}
                    label={'\u00a0'.repeat((cat.level ?? 0) * 2) + cat.name}
                    value={cat.id.toString()}
                  />
                ))}
              </Picker>
            </View>
          )}
        </View>

        {/* ── Tags ── */}
        {availableTags.length > 0 && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Tags</Text>
            <Text style={styles.hint}>Cliquez pour ajouter ou retirer un tag</Text>
            <View style={styles.tagsRow}>
              {availableTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tagChip,
                      { borderColor: tag.color || '#607D8B' },
                      isSelected && { backgroundColor: tag.color || '#607D8B' },
                    ]}
                    onPress={() => toggleTag(tag.id)}
                    activeOpacity={0.7}
                  >
                    {isSelected && <Text style={[styles.tagChipIcon, { color: '#fff' }]}>{'✓ '}</Text>}
                    <Text style={[
                      styles.tagChipLabel,
                      { color: isSelected ? '#fff' : (tag.color || '#607D8B') },
                    ]}>{tag.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Disponibilité ── */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.label}>Disponible à la vente</Text>
            <Text style={styles.hint}>Les clients peuvent commander ce produit</Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ false: '#ccc', true: '#bbdefb' }}
            thumbColor={isAvailable ? '#2196F3' : '#f4f3f4'}
          />
        </View>

        {/* ── Bouton sauvegarde ── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEdit ? '💾 Enregistrer les modifications' : '✅ Créer le produit'}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content:   { padding: 16, paddingBottom: 40 },

  photoSection: { alignItems: 'center', marginBottom: 20 },
  photoBox: {
    width: '100%', height: 160, borderRadius: 14,
    overflow: 'hidden', backgroundColor: '#e8f0fe',
    borderWidth: 2, borderColor: '#90caf9', borderStyle: 'dashed',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderText: { fontSize: 14, color: '#1976d2', fontWeight: '600' },
  removePhotoBtn: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: '#fff', borderRadius: 20,
    borderWidth: 1, borderColor: '#ef9a9a',
  },
  removePhotoBtnText: { color: '#e53935', fontSize: 13, fontWeight: '600' },

  sectionHeader: { marginBottom: 8 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#333' },
  sectionHint:   { fontSize: 11, color: '#999', marginTop: 2 },

  field:    { marginBottom: 14 },
  row:      { flexDirection: 'row', gap: 12, marginBottom: 14 },
  label:    { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 6 },
  required: { color: '#e53935' },
  hint:     { fontSize: 11, color: '#999', marginTop: 4 },

  input: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#333',
  },

  pickerBox: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden',
  },
  picker: { height: 50, color: '#333' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#e0e0e0',
  },
  switchInfo: { flex: 1, marginRight: 10 },

  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8,
  },
  tagChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 18, borderWidth: 1.5,
  },
  tagChipIcon: { fontSize: 11, fontWeight: '700' },
  tagChipLabel: { fontSize: 13, fontWeight: '600' },

  saveBtn: {
    backgroundColor: '#2196F3', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
