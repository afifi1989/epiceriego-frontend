import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import telecomRechargeService from '@/src/services/telecomRechargeService';
import {
  TelecomRechargeOffer,
  TelecomOperator,
  RechargeOfferType
} from '@/src/type';

/**
 * Écran de gestion des offres de recharge (Épicier)
 * Route: /(epicier)/recharge-offers
 */
export default function RechargeOffersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<TelecomRechargeOffer[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOffer, setEditingOffer] = useState<TelecomRechargeOffer | null>(null);
  const [formData, setFormData] = useState({
    operator: TelecomOperator.INWI,
    offerType: RechargeOfferType.SIMPLE,
    amount: '',
    price: '',
    description: '',
    validityDays: '',
    enabled: true,
    operatorProductCode: ''
  });

  // Recharger les offres à chaque fois que l'écran devient actif
  useFocusEffect(
    useCallback(() => {
      loadOffers();
    }, [])
  );

  const loadOffers = async () => {
    try {
      setLoading(true);
      const data = await telecomRechargeService.getAllOffers();
      setOffers(data);
    } catch (error) {
      console.error('Error loading offers:', error);
      Alert.alert('Erreur', 'Impossible de charger les offres');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = () => {
    setEditingOffer(null);
    setFormData({
      operator: TelecomOperator.INWI,
      offerType: RechargeOfferType.SIMPLE,
      amount: '',
      price: '',
      description: '',
      validityDays: '',
      enabled: true,
      operatorProductCode: ''
    });
    setModalVisible(true);
  };

  const handleEditOffer = (offer: TelecomRechargeOffer) => {
    setEditingOffer(offer);
    setFormData({
      operator: offer.operator,
      offerType: offer.offerType,
      amount: offer.amount.toString(),
      price: offer.price.toString(),
      description: offer.description,
      validityDays: offer.validityDays?.toString() || '',
      enabled: offer.enabled,
      operatorProductCode: offer.operatorProductCode || ''
    });
    setModalVisible(true);
  };

  const handleSaveOffer = async () => {
    try {
      // Validation
      if (!formData.amount || !formData.price || !formData.description) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      const amount = parseFloat(formData.amount);
      const price = parseFloat(formData.price);

      if (amount <= 0 || price <= 0) {
        Alert.alert('Erreur', 'Le montant et le prix doivent être supérieurs à 0');
        return;
      }

      const offerData = {
        operator: formData.operator,
        offerType: formData.offerType,
        amount,
        price,
        description: formData.description,
        validityDays: formData.validityDays ? parseInt(formData.validityDays) : undefined,
        enabled: formData.enabled,
        operatorProductCode: formData.operatorProductCode || undefined
      };

      if (editingOffer) {
        await telecomRechargeService.updateOffer(editingOffer.id, offerData);
        Alert.alert('Succès', 'Offre modifiée avec succès');
      } else {
        await telecomRechargeService.createOffer(offerData);
        Alert.alert('Succès', 'Offre créée avec succès');
      }

      setModalVisible(false);
      loadOffers();
    } catch (error: any) {
      console.error('Error saving offer:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible d\'enregistrer l\'offre');
    }
  };

  const handleDeleteOffer = (offer: TelecomRechargeOffer) => {
    Alert.alert(
      'Désactiver l\'offre',
      `Voulez-vous vraiment désactiver l'offre "${offer.description}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await telecomRechargeService.deleteOffer(offer.id);
              Alert.alert('Succès', 'Offre désactivée');
              loadOffers();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de désactiver l\'offre');
            }
          }
        }
      ]
    );
  };

  const renderOfferCard = ({ item }: { item: TelecomRechargeOffer }) => {
    const operatorColor = telecomRechargeService.getOperatorColor(item.operator);
    const operatorName = telecomRechargeService.getOperatorDisplayName(item.operator);

    return (
      <View style={[styles.offerCard, !item.enabled && styles.offerCardDisabled]}>
        <View style={styles.offerHeader}>
          <View style={[styles.operatorBadge, { backgroundColor: operatorColor }]}>
            <Text style={styles.operatorBadgeText}>{operatorName}</Text>
          </View>
          {!item.enabled && (
            <View style={styles.disabledBadge}>
              <Text style={styles.disabledBadgeText}>Désactivée</Text>
            </View>
          )}
        </View>

        <Text style={styles.offerDescription}>{item.description}</Text>

        <View style={styles.offerDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Montant:</Text>
            <Text style={styles.detailValue}>{item.amount} DH</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Prix:</Text>
            <Text style={[styles.detailValue, { color: operatorColor, fontWeight: 'bold' }]}>
              {item.price.toFixed(2)} DH
            </Text>
          </View>
          {item.validityDays && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Validité:</Text>
              <Text style={styles.detailValue}>{item.validityDays} jours</Text>
            </View>
          )}
        </View>

        <View style={styles.offerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditOffer(item)}
          >
            <Ionicons name="create-outline" size={20} color="#2196F3" />
            <Text style={styles.actionButtonText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteOffer(item)}
          >
            <Ionicons name="close-circle-outline" size={20} color="#F44336" />
            <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Désactiver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Offres</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => router.push('/(epicier)/recharge-config')}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={24} color="#FFF" />
            <Text style={styles.configButtonText}>Configuration</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreateOffer}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.addButtonText}>Nouvelle offre</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={offers}
        renderItem={renderOfferCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>Aucune offre créée</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleCreateOffer}
            >
              <Text style={styles.emptyButtonText}>Créer votre première offre</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Modal de création/édition */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingOffer ? 'Modifier l\'offre' : 'Nouvelle offre'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={28} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Opérateur *</Text>
              <View style={styles.pickerContainer}>
                {Object.values(TelecomOperator).map((op) => (
                  <TouchableOpacity
                    key={op}
                    style={[
                      styles.operatorChip,
                      formData.operator === op && {
                        backgroundColor: telecomRechargeService.getOperatorColor(op)
                      }
                    ]}
                    onPress={() => setFormData({ ...formData, operator: op })}
                  >
                    <Text
                      style={[
                        styles.operatorChipText,
                        formData.operator === op && { color: '#FFF' }
                      ]}
                    >
                      {telecomRechargeService.getOperatorDisplayName(op)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Montant (DH) *</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="20"
                value={formData.amount}
                onChangeText={(text) => setFormData({ ...formData, amount: text })}
              />

              <Text style={styles.fieldLabel}>Prix de vente (DH) *</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="21"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
              />

              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Recharge Inwi 20 DH"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Validité (jours)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="30"
                value={formData.validityDays}
                onChangeText={(text) => setFormData({ ...formData, validityDays: text })}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveOffer}
              >
                <Text style={styles.saveButtonText}>
                  {editingOffer ? 'Modifier' : 'Créer'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16
  },
  headerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  configButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  listContainer: {
    padding: 16
  },
  offerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  offerCardDisabled: {
    opacity: 0.6
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  operatorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  operatorBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600'
  },
  disabledBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  disabledBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600'
  },
  offerDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    fontWeight: '500'
  },
  offerDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginBottom: 12
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  detailLabel: {
    fontSize: 14,
    color: '#666'
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500'
  },
  offerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 12
  },
  deleteButton: {
    marginLeft: 16
  },
  actionButtonText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    marginBottom: 24
  },
  emptyButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333'
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8
  },
  operatorChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0'
  },
  operatorChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  saveButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold'
  }
});
