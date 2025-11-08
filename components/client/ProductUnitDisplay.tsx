/**
 * Affichage attractif des unités de vente pour les clients
 * Intégré directement dans les pages de produit
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Product, ProductUnit } from '../../src/type';
import { calculateUnitPrice, canOrder, getStockLevel } from '../../src/utils/unitCalculations';

interface ProductUnitDisplayProps {
  product: Product;
  onAddToCart: (unitId: number, quantity: number, totalPrice: number, unit: ProductUnit) => void;
}

export const ProductUnitDisplay: React.FC<ProductUnitDisplayProps> = ({
  product,
  onAddToCart,
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(
    product.units && product.units.length > 0 ? product.units[0].id : null
  );
  const [quantity, setQuantity] = useState<string>('1');

  // Sélectionner l'unité
  const selectedUnit = product.units?.find(u => u.id === selectedUnitId);

  // Calculer le prix total
  const getTotalPrice = (): number => {
    if (!selectedUnit) return 0;
    const qty = parseFloat(quantity) || 1;
    return calculateUnitPrice(selectedUnit, qty);
  };

  // Vérifier si on peut commander
  const canOrderNow = (): boolean => {
    if (!selectedUnit) return false;
    const qty = parseFloat(quantity) || 1;
    return canOrder(selectedUnit, qty);
  };

  // Incrémenter/Décrémenter la quantité
  const updateQuantity = (delta: number) => {
    const current = parseFloat(quantity) || 1;
    const newQty = Math.max(1, current + delta);
    setQuantity(newQty.toString());
  };

  // Ajouter au panier
  const handleAddToCart = () => {
    if (!selectedUnit) {
      Alert.alert('Erreur', 'Veuillez sélectionner un format');
      return;
    }

    const qty = parseFloat(quantity) || 1;
    if (!canOrderNow()) {
      Alert.alert('Stock insuffisant', 'La quantité demandée dépasse le stock disponible');
      return;
    }

    const totalPrice = getTotalPrice();
    onAddToCart(selectedUnit.id, qty, totalPrice, selectedUnit);
  };

  // S'il n'y a pas d'unités, afficher le prix legacy
  if (!product.units || product.units.length === 0) {
    return (
      <View style={styles.container}>
        {/* Affichage legacy - sans unités */}
        <View style={styles.legacyContainer}>
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Prix</Text>
            <Text style={styles.legacyPrice}>€{product.prix.toFixed(2)}</Text>
          </View>

          <View style={styles.stockSection}>
            <MaterialIcons name="inventory-2" size={20} color="#4CAF50" />
            <Text style={[
              styles.stockText,
              { color: product.stock > 0 ? '#4CAF50' : '#f44336' }
            ]}>
              {product.stock} en stock
            </Text>
          </View>

          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>Quantité</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(-1)}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addButton, !product.isAvailable && styles.addButtonDisabled]}
            onPress={handleAddToCart}
            disabled={!product.isAvailable}
          >
            <MaterialIcons name="add-shopping-cart" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter au panier</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Titre */}
      <Text style={styles.mainTitle}>Choisissez votre format</Text>

      {/* Grille d'unités */}
      <View style={styles.unitsGrid}>
        {product.units.map((unit) => {
          const isSelected = unit.id === selectedUnitId;
          const stockLevel = getStockLevel(unit.stock);
          const isInStock = unit.isAvailable && unit.stock > 0;

          return (
            <TouchableOpacity
              key={unit.id}
              style={[
                styles.unitCard,
                isSelected && styles.unitCardSelected,
                !isInStock && styles.unitCardDisabled,
              ]}
              onPress={() => {
                setSelectedUnitId(unit.id);
                setQuantity('1');
              }}
              disabled={!isInStock}
            >
              {/* Icône de format */}
              <View style={styles.unitIconContainer}>
                <Text style={styles.unitIcon}>
                  {unit.unitType === 'PIECE' ? '📦'
                    : unit.unitType === 'WEIGHT' ? '⚖️'
                      : unit.unitType === 'VOLUME' ? '🧃'
                        : '📏'}
                </Text>
              </View>

              {/* Label */}
              <Text style={[styles.unitLabel, !isInStock && styles.unitLabelDisabled]}>
                {unit.label}
              </Text>

              {/* Prix */}
              <Text style={[styles.unitPrice, !isInStock && styles.unitPriceDisabled]}>
                €{unit.prix.toFixed(2)}
              </Text>

              {/* Badge stock */}
              {isInStock ? (
                <View style={[styles.stockBadge, { backgroundColor: stockLevel.color }]}>
                  <Text style={styles.stockBadgeText}>{stockLevel.label}</Text>
                </View>
              ) : (
                <View style={styles.stockBadgeOOS}>
                  <Text style={styles.stockBadgeTextOOS}>Rupture</Text>
                </View>
              )}

              {/* Indicateur de sélection */}
              {isSelected && (
                <View style={styles.checkmark}>
                  <MaterialIcons name="check-circle" size={28} color="#4CAF50" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Détails de l'unité sélectionnée */}
      {selectedUnit && (
        <View style={styles.selectedUnitDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Format sélectionné:</Text>
            <Text style={styles.detailValue}>{selectedUnit.label}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Prix unitaire:</Text>
            <Text style={styles.detailValue}>€{selectedUnit.prix.toFixed(2)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock disponible:</Text>
            <Text style={[
              styles.detailValue,
              { color: selectedUnit.stock > 0 ? '#4CAF50' : '#f44336' }
            ]}>
              {selectedUnit.stock}
            </Text>
          </View>
        </View>
      )}

      {/* Sélecteur de quantité */}
      <View style={styles.quantitySection}>
        <Text style={styles.sectionTitle}>Quantité</Text>
        <View style={styles.quantityRow}>
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(-1)}
            >
              <MaterialIcons name="remove" size={20} color="#333" />
            </TouchableOpacity>
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(1)}
            >
              <MaterialIcons name="add" size={20} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Affichage du prix total */}
          <View style={styles.totalPriceBox}>
            <Text style={styles.totalPriceLabel}>Total</Text>
            <Text style={styles.totalPrice}>€{getTotalPrice().toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Bouton ajouter au panier */}
      <TouchableOpacity
        style={[
          styles.addButton,
          !canOrderNow() && styles.addButtonDisabled,
        ]}
        onPress={handleAddToCart}
        disabled={!canOrderNow()}
      >
        <MaterialIcons name="add-shopping-cart" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Ajouter au panier</Text>
      </TouchableOpacity>

      {!canOrderNow() && (
        <Text style={styles.errorText}>Stock insuffisant pour cette quantité</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },

  /* === LEGACY CONTAINER === */
  legacyContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  priceSection: {
    marginBottom: 16,
    alignItems: 'center',
  },

  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  legacyPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },

  stockSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },

  stockText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },

  /* === MAIN TITLE === */
  mainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },

  /* === UNITS GRID === */
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },

  unitCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  unitCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f6',
  },

  unitCardDisabled: {
    opacity: 0.5,
  },

  unitIconContainer: {
    marginBottom: 8,
  },

  unitIcon: {
    fontSize: 32,
  },

  unitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
  },

  unitLabelDisabled: {
    color: '#999',
  },

  unitPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 6,
  },

  unitPriceDisabled: {
    color: '#999',
  },

  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },

  stockBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  stockBadgeOOS: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: '#ffebee',
  },

  stockBadgeTextOOS: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c62828',
  },

  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  /* === SELECTED UNIT DETAILS === */
  selectedUnitDetails: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },

  detailLabel: {
    fontSize: 13,
    color: '#666',
  },

  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },

  /* === QUANTITY SECTION === */
  quantitySection: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },

  quantityRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  quantityControl: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },

  quantityButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },

  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },

  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  totalPriceBox: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalPriceLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },

  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  /* === ADD TO CART BUTTON === */
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  addButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },

  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  errorText: {
    textAlign: 'center',
    color: '#f44336',
    fontSize: 13,
    fontWeight: '600',
  },
});
