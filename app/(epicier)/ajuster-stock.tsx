/**
 * Écran d'ajustement de stock pour épicier
 * Permet d'ajuster le stock d'un produit avec historique
 */

import { StockBadge } from '@/src/components/epicier/StockBadge';
import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import epicierProductService, {
  ProductDetailDTO,
} from '@/src/services/epicierProductService';
import { stockAdjustmentSchema } from '@/src/utils/validationSchemas';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';

const ADJUSTMENT_REASONS = [
  { value: 'RECEPTION', label: 'Réception de marchandise' },
  { value: 'INVENTORY', label: 'Correction d\'inventaire' },
  { value: 'DAMAGE', label: 'Produits endommagés' },
  { value: 'EXPIRATION', label: 'Produits périmés' },
  { value: 'LOSS', label: 'Perte/Vol' },
  { value: 'RETURN', label: 'Retour client' },
  { value: 'OTHER', label: 'Autre' },
];

interface StockAdjustmentFormValues {
  adjustmentType: 'ADD' | 'REMOVE';
  quantity: string;
  reason: string;
  notes: string;
}

interface StockHistory {
  id: string;
  type: 'ADD' | 'REMOVE';
  quantity: number;
  reason: string;
  notes?: string;
  timestamp: string;
  previousStock: number;
  newStock: number;
}

export default function StockAdjustmentScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StockHistory[]>([
    {
      id: '1',
      type: 'ADD',
      quantity: 10,
      reason: 'RECEPTION',
      notes: 'Livraison fournisseur',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      previousStock: 40,
      newStock: 50,
    },
  ]);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    if (!productId) return;
    try {
      setIsLoading(true);
      const data = await epicierProductService.getProductById(Number(productId));
      setProduct(data);
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

  const handleSubmit = async (values: StockAdjustmentFormValues, { resetForm }: any = {}) => {
    if (!product) return;

    try {
      setIsSaving(true);

      const newStock =
        values.adjustmentType === 'ADD'
          ? product.stock + parseInt(values.quantity)
          : product.stock - parseInt(values.quantity);

      // Prevent negative stock
      if (newStock < 0) {
        Toast.show({
          type: 'error',
          text1: 'Stock insuffisant',
          text2: `Impossible de retirer ${values.quantity} ${product.uniteVente}. Stock actuel: ${product.stock}`,
        });
        setIsSaving(false);
        return;
      }

      // Update stock with the new absolute value
      await epicierProductService.updateStock(Number(productId), newStock);

      // Add to history
      const newHistoryItem: StockHistory = {
        id: Date.now().toString(),
        type: values.adjustmentType,
        quantity: parseInt(values.quantity),
        reason: values.reason,
        notes: values.notes,
        timestamp: new Date().toISOString(),
        previousStock: product.stock,
        newStock: newStock,
      };

      setHistory([newHistoryItem, ...history]);
      setProduct({ ...product, stock: newStock });

      Toast.show({
        type: 'success',
        text1: 'Stock mis à jour',
        text2: `Nouveau stock: ${newStock} ${product.uniteVente}`,
      });

      // Reset form to initial values
      if (resetForm) {
        resetForm();
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: error.message || 'Impossible de mettre à jour le stock',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !product) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const initialValues: StockAdjustmentFormValues = {
    adjustmentType: 'ADD',
    quantity: '',
    reason: 'RECEPTION',
    notes: '',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Info */}
        <View style={styles.productInfoSection}>
          <Text style={styles.productName}>{product.nom}</Text>
          <Text style={styles.productUnit}>{product.uniteVente}</Text>

          {/* Current Stock Display */}
          <View style={styles.stockDisplayContainer}>
            <View style={styles.stockCard}>
              <Text style={styles.stockLabel}>Stock actuel</Text>
              <View style={styles.stockValueRow}>
                <Text style={styles.stockValue}>{product.stock}</Text>
                <Text style={styles.stockUnit}>{product.uniteVente}</Text>
              </View>
              <StockBadge
                stock={product.stock}
                threshold={product.stockThreshold}
                size="medium"
              />
            </View>

            <View style={styles.stockCard}>
              <Text style={styles.stockLabel}>Seuil d'alerte</Text>
              <View style={styles.stockValueRow}>
                <Text style={styles.thresholdValue}>{product.stockThreshold}</Text>
                <Text style={styles.stockUnit}>{product.uniteVente}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Adjustment Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Ajuster le stock</Text>

          <Formik
            initialValues={initialValues}
            validationSchema={stockAdjustmentSchema}
            onSubmit={handleSubmit}
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              setFieldValue,
              handleSubmit: formikSubmit,
            }) => (
              <View style={styles.form}>
                {/* Adjustment Type Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Type d'ajustement *</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        values.adjustmentType === 'ADD' && styles.typeButtonActive,
                      ]}
                      onPress={() => handleChange('adjustmentType')('ADD')}
                    >
                      <MaterialCommunityIcons
                        name="plus-circle"
                        size={24}
                        color={
                          values.adjustmentType === 'ADD'
                            ? Colors.success
                            : Colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.typeButtonText,
                          values.adjustmentType === 'ADD' &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        Ajouter
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        values.adjustmentType === 'REMOVE' && styles.typeButtonActive,
                      ]}
                      onPress={() => handleChange('adjustmentType')('REMOVE')}
                    >
                      <MaterialCommunityIcons
                        name="minus-circle"
                        size={24}
                        color={
                          values.adjustmentType === 'REMOVE'
                            ? Colors.danger
                            : Colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.typeButtonText,
                          values.adjustmentType === 'REMOVE' &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        Retirer
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quantity */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Quantité *</Text>
                  <View
                    style={[
                      styles.input,
                      touched.quantity && errors.quantity && styles.inputError,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="package"
                      size={20}
                      color={Colors.textSecondary}
                      style={{ marginRight: Spacing.sm }}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Colors.textSecondary}
                      value={values.quantity}
                      onChangeText={handleChange('quantity')}
                      keyboardType="numeric"
                    />
                  </View>
                  {touched.quantity && errors.quantity && (
                    <Text style={styles.errorText}>{errors.quantity}</Text>
                  )}
                </View>

                {/* Reason */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Raison *</Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      touched.reason && errors.reason && styles.inputError,
                    ]}
                    onPress={() => setShowReasonPicker(true)}
                  >
                    <MaterialCommunityIcons
                      name="information"
                      size={20}
                      color={Colors.textSecondary}
                      style={{ marginRight: Spacing.sm }}
                    />
                    <Text
                      style={[
                        styles.inputPlaceholder,
                        values.reason && styles.inputValue,
                      ]}
                    >
                      {ADJUSTMENT_REASONS.find((r) => r.value === values.reason)
                        ?.label || 'Sélectionner une raison'}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {touched.reason && errors.reason && (
                    <Text style={styles.errorText}>{errors.reason}</Text>
                  )}
                </View>

                {/* Notes */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Notes (optionnel)</Text>
                  <View style={[styles.input, styles.notesInput]}>
                    <MaterialCommunityIcons
                      name="note-text"
                      size={20}
                      color={Colors.textSecondary}
                      style={{ marginRight: Spacing.sm, marginTop: Spacing.sm }}
                    />
                    <TextInput
                      style={styles.notesTextInput}
                      placeholder="Ajouter des notes..."
                      placeholderTextColor={Colors.textSecondary}
                      value={values.notes}
                      onChangeText={handleChange('notes')}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>

                {/* Preview */}
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Aperçu</Text>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Stock actuel:</Text>
                    <Text style={styles.previewValue}>{product.stock}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Ajustement:</Text>
                    <Text
                      style={[
                        styles.previewValue,
                        {
                          color:
                            values.adjustmentType === 'ADD'
                              ? Colors.success
                              : Colors.danger,
                        },
                      ]}
                    >
                      {values.adjustmentType === 'ADD' ? '+' : '-'}
                      {values.quantity || '0'}
                    </Text>
                  </View>
                  <View style={[styles.previewRow, styles.previewRowTotal]}>
                    <Text style={styles.previewLabel}>Nouveau stock:</Text>
                    <Text style={styles.previewValueTotal}>
                      {values.adjustmentType === 'ADD'
                        ? product.stock + (parseInt(values.quantity) || 0)
                        : product.stock - (parseInt(values.quantity) || 0)}
                    </Text>
                  </View>
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
                          name="check-circle"
                          size={20}
                          color={Colors.textInverse}
                          style={{ marginRight: Spacing.sm }}
                        />
                        <Text style={styles.submitButtonText}>Confirmer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Formik>
        </View>

        {/* History Button */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => setShowHistory(true)}
        >
          <MaterialCommunityIcons
            name="history"
            size={20}
            color={Colors.primary}
            style={{ marginRight: Spacing.sm }}
          />
          <Text style={styles.historyButtonText}>Voir l'historique ({history.length})</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Reason Picker Modal */}
      <Modal
        visible={showReasonPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReasonPicker(false)}
      >
        <Formik
          initialValues={initialValues}
          validationSchema={stockAdjustmentSchema}
          onSubmit={handleSubmit}
        >
          {({ setFieldValue: setReasonFieldValue }) => (
            <View style={styles.pickerModal}>
              <View style={styles.pickerContent}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Raison de l'ajustement</Text>
                  <TouchableOpacity onPress={() => setShowReasonPicker(false)}>
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color={Colors.text}
                    />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={ADJUSTMENT_REASONS}
                  keyExtractor={(item) => item.value}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => {
                        setReasonFieldValue('reason', item.value);
                        setShowReasonPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          )}
        </Formik>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.historyModal}>
          <View style={styles.historyContent}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Historique des ajustements</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View
                    style={[
                      styles.historyIcon,
                      item.type === 'ADD'
                        ? styles.historyIconAdd
                        : styles.historyIconRemove,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.type === 'ADD' ? 'plus' : 'minus'}
                      size={20}
                      color={Colors.textInverse}
                    />
                  </View>

                  <View style={styles.historyInfo}>
                    <View style={styles.historyRow}>
                      <Text style={styles.historyReason}>
                        {ADJUSTMENT_REASONS.find((r) => r.value === item.reason)
                          ?.label || item.reason}
                      </Text>
                      <Text
                        style={[
                          styles.historyQuantity,
                          item.type === 'ADD'
                            ? styles.historyQuantityAdd
                            : styles.historyQuantityRemove,
                        ]}
                      >
                        {item.type === 'ADD' ? '+' : '-'}
                        {item.quantity}
                      </Text>
                    </View>

                    <View style={styles.historyRowSmall}>
                      <Text style={styles.historyTime}>
                        {new Date(item.timestamp).toLocaleString('fr-FR')}
                      </Text>
                      <Text style={styles.historyStock}>
                        {item.previousStock} → {item.newStock}
                      </Text>
                    </View>

                    {item.notes && (
                      <Text style={styles.historyNotes}>{item.notes}</Text>
                    )}
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

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
  productInfoSection: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  productName: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  productUnit: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  stockDisplayContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stockCard: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stockLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  stockValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  stockValue: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  stockUnit: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  thresholdValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  formSection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  form: {
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
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  typeButtonActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeButtonTextActive: {
    color: Colors.primary,
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
  textInput: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.text,
    paddingVertical: 0,
  },
  notesInput: {
    alignItems: 'flex-start',
    minHeight: 100,
    paddingVertical: Spacing.md,
  },
  notesTextInput: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  errorText: {
    fontSize: FontSizes.xs,
    color: Colors.danger,
  },
  previewCard: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  previewTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  previewRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.primary,
    paddingVertical: Spacing.md,
  },
  previewLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  previewValue: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
  },
  previewValueTotal: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
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
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  historyButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.primary,
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
    maxHeight: '80%',
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
  historyModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  historyContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.lg,
    maxHeight: '90%',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIconAdd: {
    backgroundColor: Colors.success,
  },
  historyIconRemove: {
    backgroundColor: Colors.danger,
  },
  historyInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyReason: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  historyQuantity: {
    fontSize: FontSizes.base,
    fontWeight: '700',
  },
  historyQuantityAdd: {
    color: Colors.success,
  },
  historyQuantityRemove: {
    color: Colors.danger,
  },
  historyRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  historyStock: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  historyNotes: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
});
