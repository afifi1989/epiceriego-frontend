/**
 * Sélecteur d'unité pour un produit
 * Affiche toutes les options d'achat disponibles
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Product } from '../../src/type';
import { calculateUnitPrice, canOrder, getStockLevel } from '../../src/utils/unitCalculations';

interface UnitSelectorProps {
  product: Product;
  visible: boolean;
  onClose: () => void;
  onSelect: (unitId: number, quantity: number, totalPrice: number) => void;
}

export const UnitSelector: React.FC<UnitSelectorProps> = ({
  product,
  visible,
  onClose,
  onSelect
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Si pas d'units, utiliser legacy pricing
  const units = product.units && product.units.length > 0 ? product.units : null;
  const selectedUnit = units?.find(u => u.id === selectedUnitId);

  const calculatePrice = (): number => {
    if (!selectedUnit) return 0;
    return calculateUnitPrice(selectedUnit, quantity);
  };

  const canOrderQuantity = (): boolean => {
    if (!selectedUnit) return false;
    return canOrder(selectedUnit, quantity);
  };

  const handleSelect = () => {
    if (!selectedUnitId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un format');
      return;
    }

    if (!canOrderQuantity()) {
      Alert.alert('Stock insuffisant', 'La quantité demandée dépasse le stock disponible');
      return;
    }

    const totalPrice = calculatePrice();
    onSelect(selectedUnitId, quantity, totalPrice);
    onClose();
    
    // Reset
    setSelectedUnitId(null);
    setQuantity(1);
  };

  const handleClose = () => {
    setSelectedUnitId(null);
    setQuantity(1);
    onClose();
  };

  // Fallback pour produits legacy (sans units)
  if (!units || units.length === 0) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{product.nom}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.legacyCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Prix:</Text>
                <Text style={styles.priceValue}>€{product.prix.toFixed(2)}</Text>
              </View>

              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Stock:</Text>
                <Text style={[
                  styles.stockValue,
                  { color: product.stock > 0 ? '#4CAF50' : '#f44336' }
                ]}>
                  {product.stock} disponible(s)
                </Text>
              </View>

              <View style={styles.quantityContainer}>
                <Text style={styles.label}>Quantité</Text>
                <TextInput
                  style={styles.input}
                  value={quantity.toString()}
                  onChangeText={(text) => setQuantity(Math.max(1, parseInt(text) || 1))}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>
                  €{(product.prix * quantity).toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addButton, product.stock <= 0 && styles.addButtonDisabled]}
              onPress={() => {
                if (product.stock > 0) {
                  const total = product.prix * quantity;
                  onSelect(-1, quantity, total);
                  handleClose();
                }
              }}
              disabled={product.stock <= 0}
            >
              <Text style={styles.addButtonText}>Ajouter au Panier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Avec units
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{product.nom}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Choisir le format:</Text>

          {/* Liste des units */}
          {units.map((unit) => {
            const stockInfo = getStockLevel(unit.stock);
            const isSelected = selectedUnitId === unit.id;

            return (
              <TouchableOpacity
                key={unit.id}
                style={[
                  styles.unitCard,
                  isSelected && styles.unitCardSelected,
                  unit.stock <= 0 && styles.unitCardDisabled
                ]}
                onPress={() => {
                  if (unit.stock > 0) {
                    setSelectedUnitId(unit.id);
                    setQuantity(1);
                  }
                }}
                disabled={unit.stock <= 0}
              >
                <View style={styles.unitHeader}>
                  <View style={styles.unitInfo}>
                    <Text style={[
                      styles.unitLabel,
                      unit.stock <= 0 && styles.unitLabelDisabled
                    ]}>
                      {unit.label}
                    </Text>
                    <Text style={styles.unitDetails}>
                      {unit.formattedQuantity}
                    </Text>
                  </View>
                  <View style={styles.unitPricing}>
                    <Text style={[
                      styles.unitPrice,
                      unit.stock <= 0 && styles.unitPriceDisabled
                    ]}>
                      €{unit.prix.toFixed(2)}
                    </Text>
                    <View style={[
                      styles.stockBadge,
                      { backgroundColor: stockInfo.color === 'success' ? '#4CAF50' : stockInfo.color === 'warning' ? '#FF9800' : '#f44336' }
                    ]}>
                      <Text style={styles.stockBadgeText}>
                        {stockInfo.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" style={styles.checkIcon} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Quantité */}
          {selectedUnit && (
            <View style={styles.quantitySection}>
              <Text style={styles.sectionTitle}>Quantité:</Text>
              
              <View style={styles.alert}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.alertText}>
                  Stock disponible: {selectedUnit.stock} {selectedUnit.formattedQuantity}
                </Text>
              </View>

              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Ionicons name="remove" size={24} color="#333" />
                </TouchableOpacity>

                <TextInput
                  style={styles.quantityInput}
                  value={quantity.toString()}
                  onChangeText={(text) => setQuantity(Math.max(1, parseFloat(text) || 1))}
                  keyboardType="decimal-pad"
                />

                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <Ionicons name="add" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Prix total */}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Prix total:</Text>
                <Text style={styles.totalValue}>
                  €{calculatePrice().toFixed(2)}
                </Text>
              </View>

              {!canOrderQuantity() && (
                <View style={styles.warningAlert}>
                  <Ionicons name="warning" size={20} color="#f44336" />
                  <Text style={styles.warningText}>
                    Stock insuffisant pour cette quantité
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addButton,
              (!selectedUnitId || !canOrderQuantity()) && styles.addButtonDisabled
            ]}
            onPress={handleSelect}
            disabled={!selectedUnitId || !canOrderQuantity()}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter au Panier</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  unitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  unitCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f4',
  },
  unitCardDisabled: {
    opacity: 0.5,
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitInfo: {
    flex: 1,
  },
  unitLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  unitLabelDisabled: {
    color: '#999',
  },
  unitDetails: {
    fontSize: 14,
    color: '#666',
  },
  unitPricing: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  unitPriceDisabled: {
    color: '#999',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  quantitySection: {
    marginTop: 24,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#1976d2',
    flex: 1,
  },
  warningAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#c62828',
    flex: 1,
  },
  quantityControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quantityInput: {
    width: 100,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: '#fff',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  legacyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 16,
    color: '#666',
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  quantityContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addButton: {
    flex: 2,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
