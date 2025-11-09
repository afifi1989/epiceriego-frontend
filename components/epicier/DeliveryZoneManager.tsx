/**
 * Gestionnaire des zones de livraison pour l'épicier
 * Permet de définir le rayon de couverture et les zones de service
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface DeliveryZone {
  id?: string;
  name: string;
  deliveryFee: number;
  maxDistance: number;
  estimatedTime: string;
  isActive: boolean;
}

interface DeliveryZoneManagerProps {
  initialZones?: DeliveryZone[];
  onSave: (zones: DeliveryZone[]) => void;
  latitude?: number;
  longitude?: number;
}

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: '1',
    name: 'Zone proche (0-2km)',
    deliveryFee: 0,
    maxDistance: 2,
    estimatedTime: '15-20 min',
    isActive: true,
  },
  {
    id: '2',
    name: 'Zone standard (2-5km)',
    deliveryFee: 2.5,
    maxDistance: 5,
    estimatedTime: '25-35 min',
    isActive: true,
  },
  {
    id: '3',
    name: 'Zone étendue (5-10km)',
    deliveryFee: 5.0,
    maxDistance: 10,
    estimatedTime: '40-50 min',
    isActive: false,
  },
];

export const DeliveryZoneManager: React.FC<DeliveryZoneManagerProps> = ({
  initialZones,
  onSave,
  latitude,
  longitude,
}) => {
  const [zones, setZones] = useState<DeliveryZone[]>(initialZones || DEFAULT_ZONES);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [tempFormData, setTempFormData] = useState({
    name: '',
    deliveryFee: '0',
    maxDistance: '2',
    estimatedTime: '',
  });

  const openEditModal = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setTempFormData({
      name: zone.name,
      deliveryFee: zone.deliveryFee.toString(),
      maxDistance: zone.maxDistance.toString(),
      estimatedTime: zone.estimatedTime,
    });
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingZone(null);
    setTempFormData({
      name: '',
      deliveryFee: '0',
      maxDistance: '5',
      estimatedTime: '30 min',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingZone(null);
  };

  const saveZone = () => {
    // Validation
    if (!tempFormData.name.trim()) {
      Alert.alert('Erreur', 'Le nom de la zone est requis');
      return;
    }

    const fee = parseFloat(tempFormData.deliveryFee) || 0;
    const distance = parseFloat(tempFormData.maxDistance) || 0;

    if (distance <= 0) {
      Alert.alert('Erreur', 'La distance doit être supérieure à 0');
      return;
    }

    if (editingZone) {
      // Éditer une zone existante
      setZones(prev =>
        prev.map(z =>
          z.id === editingZone.id
            ? {
                ...z,
                name: tempFormData.name,
                deliveryFee: fee,
                maxDistance: distance,
                estimatedTime: tempFormData.estimatedTime,
              }
            : z
        )
      );
    } else {
      // Ajouter une nouvelle zone
      const newZone: DeliveryZone = {
        id: Date.now().toString(),
        name: tempFormData.name,
        deliveryFee: fee,
        maxDistance: distance,
        estimatedTime: tempFormData.estimatedTime,
        isActive: true,
      };
      setZones(prev => [...prev, newZone]);
    }

    closeModal();
  };

  const deleteZone = (id?: string) => {
    if (!id) return;

    Alert.alert(
      'Confirmer',
      'Êtes-vous sûr de vouloir supprimer cette zone ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setZones(prev => prev.filter(z => z.id !== id));
          },
        },
      ]
    );
  };

  const toggleZoneActive = (id?: string) => {
    if (!id) return;

    setZones(prev =>
      prev.map(z =>
        z.id === id ? { ...z, isActive: !z.isActive } : z
      )
    );
  };

  const handleSave = () => {
    const activeZones = zones.filter(z => z.isActive);
    if (activeZones.length === 0) {
      Alert.alert('Erreur', 'Au moins une zone de livraison doit être active');
      return;
    }

    onSave(zones);
  };

  const renderZoneCard = ({ item }: { item: DeliveryZone }) => (
    <View style={[styles.zoneCard, !item.isActive && styles.zoneCardInactive]}>
      <View style={styles.zoneHeader}>
        <View style={styles.zoneInfo}>
          <Text style={styles.zoneName}>{item.name}</Text>
          <Text style={styles.zoneDetails}>
            Rayon: {item.maxDistance}km • Frais: €{item.deliveryFee.toFixed(2)}
          </Text>
          <Text style={styles.zoneTime}>⏱️ {item.estimatedTime}</Text>
        </View>

        <Switch
          value={item.isActive}
          onValueChange={() => toggleZoneActive(item.id)}
          trackColor={{ false: '#e0e0e0', true: '#81c784' }}
          thumbColor={item.isActive ? '#4CAF50' : '#ccc'}
        />
      </View>

      {item.isActive && (
        <View style={styles.zoneActions}>
          <TouchableOpacity
            style={styles.zoneActionButton}
            onPress={() => openEditModal(item)}
          >
            <MaterialIcons name="edit" size={18} color="#2196F3" />
            <Text style={styles.zoneActionText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.zoneActionButton, styles.zoneActionButtonDelete]}
            onPress={() => deleteZone(item.id)}
          >
            <MaterialIcons name="delete" size={18} color="#f44336" />
            <Text style={[styles.zoneActionText, styles.zoneActionTextDelete]}>
              Supprimer
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🚚 Zones de livraison</Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() =>
            Alert.alert(
              'Zones de livraison',
              'Définissez les zones dans lesquelles vous livrez, avec les frais et délais correspondants.'
            )
          }
        >
          <MaterialIcons name="info" size={20} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <Text style={styles.locationInfo}>
        📍 {latitude && longitude
          ? `Votre position: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
          : 'Position: non disponible'}
      </Text>

      <FlatList
        data={zones}
        renderItem={renderZoneCard}
        keyExtractor={item => item.id || Math.random().toString()}
        scrollEnabled={false}
        contentContainerStyle={styles.zonesList}
      />

      {/* Add Zone Button */}
      <TouchableOpacity
        style={styles.addZoneButton}
        onPress={openAddModal}
      >
        <MaterialIcons name="add" size={24} color="#fff" />
        <Text style={styles.addZoneText}>Ajouter une zone</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingZone ? 'Modifier une zone' : 'Ajouter une zone'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Nom de la zone</Text>
                <TextInput
                  style={styles.formInput}
                  value={tempFormData.name}
                  onChangeText={text =>
                    setTempFormData({ ...tempFormData, name: text })
                  }
                  placeholder="Ex: Zone centre-ville"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, styles.formFieldHalf]}>
                  <Text style={styles.formLabel}>Rayon (km)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={tempFormData.maxDistance}
                    onChangeText={text =>
                      setTempFormData({ ...tempFormData, maxDistance: text })
                    }
                    placeholder="Ex: 5"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={[styles.formField, styles.formFieldHalf]}>
                  <Text style={styles.formLabel}>Frais (€)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={tempFormData.deliveryFee}
                    onChangeText={text =>
                      setTempFormData({ ...tempFormData, deliveryFee: text })
                    }
                    placeholder="Ex: 2.50"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Temps estimé</Text>
                <TextInput
                  style={styles.formInput}
                  value={tempFormData.estimatedTime}
                  onChangeText={text =>
                    setTempFormData({ ...tempFormData, estimatedTime: text })
                  }
                  placeholder="Ex: 30-40 min"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.infoBox}>
                <MaterialIcons name="lightbulb" size={18} color="#FF9800" />
                <Text style={styles.infoText}>
                  Les clients verront le rayon et les frais de livraison selon leur localisation.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeModal}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveZone}
              >
                <Text style={styles.modalSaveButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <MaterialIcons name="check" size={24} color="#fff" />
        <Text style={styles.saveButtonText}>Enregistrer les zones</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  helpButton: {
    padding: 8,
  },
  locationInfo: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
    fontWeight: '500',
  },
  zonesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  zoneCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  zoneCardInactive: {
    opacity: 0.6,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  zoneDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  zoneTime: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  zoneActions: {
    flexDirection: 'row',
    gap: 8,
  },
  zoneActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    gap: 6,
  },
  zoneActionButtonDelete: {
    backgroundColor: '#FEE2E2',
  },
  zoneActionText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  zoneActionTextDelete: {
    color: '#f44336',
  },
  addZoneButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addZoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalForm: {
    gap: 16,
    marginBottom: 20,
  },
  formField: {
    marginBottom: 16,
  },
  formFieldHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#F57F17',
    fontWeight: '500',
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
