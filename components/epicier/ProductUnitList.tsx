/**
 * Liste des units d'un produit avec actions
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { unitService } from '../../src/services/unitService';
import { ProductUnit } from '../../src/type';
import { getStockLevel } from '../../src/utils/unitCalculations';
import { ProductUnitForm } from './ProductUnitForm';

interface ProductUnitListProps {
  productId: number;
  units: ProductUnit[];
  onRefresh?: () => void;
}

export const ProductUnitList: React.FC<ProductUnitListProps> = ({
  productId,
  units,
  onRefresh
}) => {
  const [loading, setLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ProductUnit | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleEdit = (unit: ProductUnit) => {
    setEditingUnit(unit);
    setShowForm(true);
  };

  const handleDelete = async (unitId: number) => {
    Alert.alert(
      'Confirmer',
      'Êtes-vous sûr de vouloir supprimer cette unité ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await unitService.deleteUnit(productId, unitId);
              Alert.alert('Succès', 'Unité supprimée');
              onRefresh?.();
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.message || 'Erreur lors de la suppression');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingUnit(null);
    onRefresh?.();
  };

  const renderUnitItem = ({ item }: { item: ProductUnit }) => {
    const stockInfo = getStockLevel(item.stock);
    
    return (
      <View style={styles.unitCard}>
        <View style={styles.unitHeader}>
          <View style={styles.unitInfo}>
            <Text style={styles.unitLabel}>{item.label}</Text>
            <Text style={styles.unitDetails}>
              {item.formattedQuantity} • {item.unitType}
            </Text>
          </View>
          <View style={styles.unitActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEdit(item)}
            >
              <Ionicons name="pencil" size={20} color="#4CAF50" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item.id)}
            >
              <Ionicons name="trash" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.unitBody}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Prix:</Text>
            <Text style={styles.priceValue}>{item.prix.toFixed(2)} DH</Text>
          </View>

          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Stock:</Text>
            <View style={[
              styles.stockBadge,
              { backgroundColor: stockInfo.color === 'success' ? '#4CAF50' : stockInfo.color === 'warning' ? '#FF9800' : '#f44336' }
            ]}>
              <Text style={styles.stockBadgeText}>{item.stock}</Text>
            </View>
          </View>

          <View style={styles.availabilityRow}>
            <Text style={styles.availabilityLabel}>Disponible:</Text>
            <View style={[
              styles.availabilityBadge,
              { backgroundColor: item.isAvailable ? '#4CAF50' : '#f44336' }
            ]}>
              <Text style={styles.availabilityBadgeText}>
                {item.isAvailable ? 'Oui' : 'Non'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Bouton Ajouter */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setEditingUnit(null);
          setShowForm(true);
        }}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Ajouter Unité</Text>
      </TouchableOpacity>

      {/* Liste des Units */}
      {units.length > 0 ? (
        <FlatList
          data={units}
          renderItem={renderUnitItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            Aucune unité configurée
          </Text>
          <Text style={styles.emptySubtext}>
            Cliquez sur "Ajouter Unité" pour commencer
          </Text>
        </View>
      )}

      {/* Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingUnit ? 'Modifier Unité' : 'Ajouter Unité'}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          <ProductUnitForm
            productId={productId}
            unit={editingUnit || undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  unitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  unitInfo: {
    flex: 1,
  },
  unitLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  unitDetails: {
    fontSize: 14,
    color: '#666',
  },
  unitActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  unitBody: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 14,
    color: '#666',
  },
  stockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 14,
    color: '#666',
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});
