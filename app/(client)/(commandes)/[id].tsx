import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { orderService } from '../../../src/services/orderService';
import { Order } from '../../../src/type';
import { formatPrice, getStatusLabel, getStatusColor } from '../../../src/utils/helpers';
import { useLanguage } from '../../../src/context/LanguageContext';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingDeliveryInfo, setEditingDeliveryInfo] = useState(false);
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const idStr = Array.isArray(id) ? id[0] : id;
      const orderData = await orderService.getOrderById(parseInt(idStr as string));
      setOrder(orderData);
      setAdresse(orderData.adresseLivraison);
      setTelephone(orderData.telephoneLivraison || '');
    } catch {
      Alert.alert(t('common.error'), t('orders.loadError'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDeliveryInfo = async () => {
    if (!adresse || !telephone) {
      Alert.alert(t('common.error'), t('orders.fillAllFields'));
      return;
    }

    try {
      setUpdating(true);
      const idStr = Array.isArray(id) ? id[0] : id;
      const updatedDeliveryInfo = await orderService.updateDeliveryInfo(
        parseInt(idStr as string),
        {
          adresseLivraison: adresse,
          telephoneLivraison: telephone,
        }
      );

      // Mettre à jour les données locales
      if (order) {
        setOrder({
          ...order,
          adresseLivraison: updatedDeliveryInfo.adresseLivraison,
          telephoneLivraison: updatedDeliveryInfo.telephoneLivraison,
        });
      }

      setEditingDeliveryInfo(false);
      Alert.alert(t('common.success'), t('orders.updateSuccess'));
    } catch {
      Alert.alert(t('common.error'), t('orders.updateError'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('orders.orderNotFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* En-tête avec numéro de commande et statut */}
      <View style={styles.header}>
        <Text style={styles.orderNumber}>{t('orders.orderNumber')} #{order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>

      {/* Résumé de la commande */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('orders.summary')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('orders.epicerie')}</Text>
          <Text style={styles.value}>{order.epicerieNom}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('orders.total')}</Text>
          <Text style={[styles.value, { color: '#4CAF50', fontWeight: 'bold' }]}>
            {formatPrice(order.total)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('orders.date')}</Text>
          <Text style={styles.value}>
            {new Date(order.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </View>

      {/* Informations de livraison */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('orders.deliveryInfo')}</Text>
          {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
            <TouchableOpacity
              onPress={() => setEditingDeliveryInfo(true)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>{t('orders.edit')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.deliveryInfoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.address')}</Text>
            <Text style={styles.value}>{order.adresseLivraison}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('orders.phone')}</Text>
            <Text style={styles.value}>{order.telephoneLivraison || t('orders.notProvided')}</Text>
          </View>
        </View>
      </View>

      {/* Articles de la commande */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('orders.items')} ({order.nombreItems})</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.productNom}</Text>
              {item.unitLabel && (
                <Text style={styles.itemUnit}>{item.unitLabel}</Text>
              )}
              <Text style={styles.itemQuantity}>{t('cart.quantity')}: {item.quantite}</Text>
              {item.prixUnitaire && (
                <Text style={styles.itemUnitPrice}>{t('orders.unitPrice')}: {formatPrice(item.prixUnitaire)}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>{formatPrice(item.total)}</Text>
          </View>
        ))}
      </View>

      {/* Modal pour éditer les informations de livraison */}
      <Modal
        visible={editingDeliveryInfo}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingDeliveryInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('orders.editDeliveryInfo')}</Text>
              <TouchableOpacity onPress={() => setEditingDeliveryInfo(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>{t('orders.deliveryAddress')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('orders.enterAddress')}
                placeholderTextColor="#999"
                value={adresse}
                onChangeText={setAdresse}
                multiline={true}
                numberOfLines={3}
              />

              <Text style={styles.label}>{t('orders.phoneNumber')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('orders.enterPhone')}
                placeholderTextColor="#999"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.updateButton}
                onPress={handleUpdateDeliveryInfo}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.updateButtonText}>{t('orders.update')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditingDeliveryInfo(false)}
              >
                <Text style={styles.cancelButtonText}>{t('orders.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  deliveryInfoBox: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemUnit: {
    fontSize: 13,
    color: '#9C27B0',
    fontWeight: '600',
    marginBottom: 2,
    fontStyle: 'italic',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  itemUnitPrice: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 20,
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
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalBody: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  updateButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
