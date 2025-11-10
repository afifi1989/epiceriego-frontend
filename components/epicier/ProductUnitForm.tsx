/**
 * Formulaire pour ajouter/modifier une ProductUnit
 */

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { unitService } from '../../src/services/unitService';
import { ProductUnit, ProductUnitRequest, UnitType } from '../../src/type';

interface ProductUnitFormProps {
  productId: number;
  unit?: ProductUnit;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ProductUnitForm: React.FC<ProductUnitFormProps> = ({
  productId,
  unit,
  onSuccess,
  onCancel
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductUnitRequest>({
    unitType: unit?.unitType || UnitType.PIECE,
    quantity: unit?.quantity || 1,
    label: unit?.label || '',
    prix: unit?.prix || 0,
    stock: unit?.stock || 0,
    isAvailable: unit?.isAvailable !== false,
    displayOrder: unit?.displayOrder || 0
  });

  const unitTypes = [
    { value: UnitType.PIECE, label: 'Pièce' },
    { value: UnitType.WEIGHT, label: 'Poids (kg)' },
    { value: UnitType.VOLUME, label: 'Volume (L)' },
    { value: UnitType.LENGTH, label: 'Longueur (m)' }
  ];

  const handleSubmit = async () => {
    if (!formData.label.trim()) {
      Alert.alert('Erreur', 'Le libellé est requis');
      return;
    }

    setLoading(true);
    try {
      if (unit?.id) {
        await unitService.updateUnit(productId, unit.id, formData);
        Alert.alert('Succès', 'Unité mise à jour avec succès');
      } else {
        await unitService.createUnit(productId, formData);
        Alert.alert('Succès', 'Unité créée avec succès');
      }
      onSuccess?.();
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Erreur lors de la sauvegarde'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {unit?.id ? 'Modifier Unité' : 'Ajouter Unité'}
      </Text>

      {/* Type d'unité */}
      <Text style={styles.label}>Type d'Unité *</Text>
      <View style={styles.unitTypeContainer}>
        {unitTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.unitTypeButton,
              formData.unitType === type.value && styles.unitTypeButtonActive
            ]}
            onPress={() => setFormData({ ...formData, unitType: type.value })}
          >
            <Text
              style={[
                styles.unitTypeText,
                formData.unitType === type.value && styles.unitTypeTextActive
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quantité */}
      <Text style={styles.label}>Quantité *</Text>
      <TextInput
        style={styles.input}
        value={formData.quantity.toString()}
        onChangeText={(text) => setFormData({ ...formData, quantity: parseFloat(text) || 0 })}
        keyboardType="decimal-pad"
        placeholder="1 pour pièce, 0.5 pour 500g"
      />
      <Text style={styles.helperText}>
        1 pour pièce, 0.5 pour 500g, etc.
      </Text>

      {/* Libellé */}
      <Text style={styles.label}>Libellé (Affiché au client) *</Text>
      <TextInput
        style={styles.input}
        value={formData.label}
        onChangeText={(text) => setFormData({ ...formData, label: text })}
        placeholder="Ex: À l'unité, 500g, 1kg, 6-pack"
      />

      {/* Prix */}
      <Text style={styles.label}>Prix (DH) *</Text>
      <TextInput
        style={styles.input}
        value={formData.prix.toString()}
        onChangeText={(text) => setFormData({ ...formData, prix: parseFloat(text) || 0 })}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />

      {/* Stock */}
      <Text style={styles.label}>Stock *</Text>
      <TextInput
        style={styles.input}
        value={formData.stock.toString()}
        onChangeText={(text) => setFormData({ ...formData, stock: parseInt(text) || 0 })}
        keyboardType="number-pad"
        placeholder="0"
      />
      <Text style={styles.helperText}>
        Nombre d'unités en stock
      </Text>

      {/* Ordre d'affichage */}
      <Text style={styles.label}>Ordre d'Affichage</Text>
      <TextInput
        style={styles.input}
        value={(formData.displayOrder || 0).toString()}
        onChangeText={(text) => setFormData({ ...formData, displayOrder: parseInt(text) || 0 })}
        keyboardType="number-pad"
        placeholder="0"
      />
      <Text style={styles.helperText}>
        Plus bas = Plus haut dans la liste
      </Text>

      {/* Boutons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !formData.label}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Sauvegarde...' : 'Sauvegarder'}
          </Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>
              Annuler
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  unitTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  unitTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  unitTypeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  unitTypeText: {
    fontSize: 14,
    color: '#333',
  },
  unitTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#333',
  },
});
