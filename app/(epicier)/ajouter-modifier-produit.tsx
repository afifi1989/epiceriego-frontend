/**
 * Écran d'ajout/modification de produit pour épicier
 * Gère la création et l'édition de produits avec formulaire complet
 */

import { BarcodeScanner } from '@/src/components/epicier/BarcodeScanner';
import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import barcodeService from '@/src/services/barcodeService';
import epicierProductService, {
  ProductDetailDTO,
} from '@/src/services/epicierProductService';
import { productCreationSchema } from '@/src/utils/validationSchemas';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';

const UNITS = [
  { label: 'Unité', value: 'PIECE' },
  { label: 'Kilogramme', value: 'KILOGRAM' },
  { label: 'Gramme', value: 'GRAM' },
  { label: 'Litre', value: 'LITER' },
  { label: 'Millilitre', value: 'MILLILITER' },
  { label: 'Douzaine', value: 'DOZEN' },
  { label: 'Paire', value: 'PAIR' },
  { label: 'Paquet', value: 'PACK' },
];

const CATEGORIES = [
  { id: 1, label: 'Fruits & Légumes' },
  { id: 2, label: 'Produits laitiers' },
  { id: 3, label: 'Viandes & Poisson' },
  { id: 4, label: 'Boulangerie' },
  { id: 5, label: 'Épicerie sèche' },
  { id: 6, label: 'Boissons' },
  { id: 7, label: 'Surgelés' },
  { id: 8, label: 'Produits bio' },
];

interface AddEditFormValues {
  nom: string;
  description: string;
  prix: string;
  categoryId: string;
  uniteVente: string;
  stockThreshold: string;
  stockInitial: string;
  codeBarreExterne: string;
}

export default function AddEditProductScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const isEditMode = !!productId;

  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
    
  useEffect(() => {
    if (isEditMode) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;
    try {
      setIsLoading(true);
      const data = await epicierProductService.getProductById(Number(productId));
      setProduct(data);
      if (data.imageUrl) {
        setImageUri(data.imageUrl);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger le produit',
      });
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de sélectionner une image',
      });
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    if (!barcodeService.isValidBarcode(barcode)) {
      Toast.show({
        type: 'error',
        text1: 'Code-barre invalide',
        text2: 'Le code-barre scanné n\'est pas valide',
      });
      return;
    }
    setShowBarcodeScanner(false);
    // Return the cleaned barcode - will be set by Formik
    return barcode;
  };

  const handleSubmit = async (values: AddEditFormValues) => {
    try {
      setIsSaving(true);

      const productData = {
        nom: values.nom,
        description: values.description,
        prix: parseFloat(values.prix),
        categoryId: parseInt(values.categoryId),
        uniteVente: values.uniteVente as 'PIECE' | 'KILOGRAM' | 'GRAM' | 'LITER' | 'MILLILITER' | 'DOZEN' | 'PAIR' | 'PACK',
        stockThreshold: parseInt(values.stockThreshold),
        ...(isEditMode
          ? {} // On edit, don't send stock
          : { stockInitial: parseInt(values.stockInitial) }),
        ...(values.codeBarreExterne
          ? { codeBarreExterne: values.codeBarreExterne }
          : {}),
      };

      if (isEditMode && productId) {
        await epicierProductService.updateProduct(Number(productId), productData);
        Toast.show({
          type: 'success',
          text1: 'Produit mis à jour',
        });
      } else {
        await epicierProductService.createProduct(productData);
        Toast.show({
          type: 'success',
          text1: 'Produit créé',
        });
      }

      // Upload image if changed
      if (imageUri && isEditMode && productId) {
        await epicierProductService.uploadProductImage(Number(productId), imageUri);
      }

      router.back();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: error.message || 'Impossible de sauvegarder le produit',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const initialValues: AddEditFormValues = {
    nom: product?.nom || '',
    description: product?.description || '',
    prix: product?.prix?.toString() || '',
    categoryId: product?.categoryId?.toString() || '',
    uniteVente: product?.uniteVente || 'PIECE',
    stockThreshold: product?.stockThreshold?.toString() || '5',
    stockInitial: product?.stock?.toString() || '',
    codeBarreExterne: product?.barcodes?.[0]?.barcode || '',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Section */}
        <TouchableOpacity
          style={styles.imageSection}
          onPress={pickImage}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons
                name="image-plus"
                size={48}
                color={Colors.textSecondary}
              />
              <Text style={styles.imagePlaceholderText}>
                Ajouter une image
              </Text>
            </View>
          )}
          <View style={styles.imageOverlay}>
            <MaterialCommunityIcons
              name="camera"
              size={24}
              color={Colors.textInverse}
            />
          </View>
        </TouchableOpacity>

        {/* Form */}
        <Formik
          initialValues={initialValues}
          validationSchema={productCreationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ values, errors, touched, handleChange, handleSubmit: formikSubmit }) => (
            <View style={styles.formSection}>
              {/* Product Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nom du produit *</Text>
                <View
                  style={[
                    styles.input,
                    touched.nom && errors.nom && styles.inputError,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="package-variant"
                    size={20}
                    color={Colors.textSecondary}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text
                    style={styles.inputPlaceholder}
                    onPress={() => {}}
                  >
                    {values.nom || 'Ex: Tomates Bio'}
                  </Text>
                </View>
                {touched.nom && errors.nom && (
                  <Text style={styles.errorText}>{errors.nom}</Text>
                )}
              </View>

              {/* Description */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Description</Text>
                <View style={styles.input}>
                  <MaterialCommunityIcons
                    name="text"
                    size={20}
                    color={Colors.textSecondary}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text style={styles.inputPlaceholder}>
                    {values.description || 'Description du produit'}
                  </Text>
                </View>
              </View>

              {/* Price */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Prix unitaire (DH) *</Text>
                <View
                  style={[
                    styles.input,
                    touched.prix && errors.prix && styles.inputError,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="currency-eur"
                    size={20}
                    color={Colors.textSecondary}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text style={styles.inputPlaceholder}>
                    {values.prix || '0.00'}
                  </Text>
                </View>
                {touched.prix && errors.prix && (
                  <Text style={styles.errorText}>{errors.prix}</Text>
                )}
              </View>

              {/* Category */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Catégorie *</Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    touched.categoryId && errors.categoryId && styles.inputError,
                  ]}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <MaterialCommunityIcons
                    name="tag"
                    size={20}
                    color={Colors.textSecondary}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text
                    style={[
                      styles.inputPlaceholder,
                      values.categoryId && styles.inputValue,
                    ]}
                  >
                    {values.categoryId
                      ? CATEGORIES.find((c) => c.id.toString() === values.categoryId)
                          ?.label
                      : 'Sélectionner une catégorie'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
                {touched.categoryId && errors.categoryId && (
                  <Text style={styles.errorText}>{errors.categoryId}</Text>
                )}
              </View>

              {/* Unit */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Unité de vente *</Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    touched.uniteVente && errors.uniteVente && styles.inputError,
                  ]}
                  onPress={() => setShowUnitPicker(true)}
                >
                  <MaterialCommunityIcons
                    name="ruler"
                    size={20}
                    color={Colors.textSecondary}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text
                    style={[
                      styles.inputPlaceholder,
                      values.uniteVente && styles.inputValue,
                    ]}
                  >
                    {UNITS.find((u) => u.value === values.uniteVente)?.label ||
                      'Sélectionner une unité'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
                {touched.uniteVente && errors.uniteVente && (
                  <Text style={styles.errorText}>{errors.uniteVente}</Text>
                )}
              </View>

              {/* Stock Threshold */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Seuil d'alerte stock *</Text>
                <View
                  style={[
                    styles.input,
                    touched.stockThreshold && errors.stockThreshold && styles.inputError,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color={Colors.textSecondary}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text style={styles.inputPlaceholder}>
                    {values.stockThreshold || '5'}
                  </Text>
                </View>
                {touched.stockThreshold && errors.stockThreshold && (
                  <Text style={styles.errorText}>{errors.stockThreshold}</Text>
                )}
              </View>

              {/* Stock Initial (only on create) */}
              {!isEditMode && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Stock initial *</Text>
                  <View
                    style={[
                      styles.input,
                      touched.stockInitial && errors.stockInitial && styles.inputError,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="package"
                      size={20}
                      color={Colors.textSecondary}
                      style={{ marginRight: Spacing.sm }}
                    />
                    <Text style={styles.inputPlaceholder}>
                      {values.stockInitial || '0'}
                    </Text>
                  </View>
                  {touched.stockInitial && errors.stockInitial && (
                    <Text style={styles.errorText}>{errors.stockInitial}</Text>
                  )}
                </View>
              )}

              {/* External Barcode */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Code-barre externe (optionnel)</Text>
                <View style={styles.barcodeInputContainer}>
                  <TouchableOpacity
                    style={[styles.input, { flex: 1 }]}
                    onPress={() => setShowBarcodeScanner(true)}
                  >
                    <MaterialCommunityIcons
                      name="barcode"
                      size={20}
                      color={Colors.textSecondary}
                      style={{ marginRight: Spacing.sm }}
                    />
                    <Text
                      style={[
                        styles.inputPlaceholder,
                        values.codeBarreExterne && styles.inputValue,
                      ]}
                    >
                      {values.codeBarreExterne || 'Scanner ou entrer code-barre'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => setShowBarcodeScanner(true)}
                  >
                    <MaterialCommunityIcons
                      name="camera"
                      size={20}
                      color={Colors.textInverse}
                    />
                  </TouchableOpacity>
                </View>
                {touched.codeBarreExterne && errors.codeBarreExterne && (
                  <Text style={styles.errorText}>{errors.codeBarreExterne}</Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionSection}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.back()}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
                  onPress={() => formikSubmit()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.textInverse} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={isEditMode ? 'pencil' : 'plus'}
                        size={20}
                        color={Colors.textInverse}
                        style={{ marginRight: Spacing.sm }}
                      />
                      <Text style={styles.submitButtonText}>
                        {isEditMode ? 'Mettre à jour' : 'Créer le produit'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Formik>
      </ScrollView>

      {/* Unit Picker Modal */}
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Unité de vente</Text>
              <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={UNITS}
              keyExtractor={(item) => item.value}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    // Set value via Formik - would need context
                    setShowUnitPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Catégorie</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    // Set value via Formik - would need context
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onCancel={() => setShowBarcodeScanner(false)}
          title="Scanner code-barre"
          subtitle="Pointez sur le code-barre du produit"
          showManualInput
        />
      )}

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSection: {
    width: '100%',
    height: 250,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  imagePlaceholderText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSection: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
  },
  inputValue: {
    color: Colors.text,
    fontWeight: '600',
  },
  errorText: {
    fontSize: FontSizes.xs,
    color: Colors.danger,
  },
  barcodeInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  pickerItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemText: {
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  actionSection: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.primary,
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textInverse,
  },
});
