import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Delivery } from '../../type';

interface DeliveryCardProps {
  delivery: Delivery;
  onPress: () => void;
  onStartPress?: () => void;
  onCompletePress?: () => void;
  isLoading?: boolean;
}

export const DeliveryCard = ({
  delivery,
  onPress,
  onStartPress,
  onCompletePress,
  isLoading = false,
}: DeliveryCardProps) => {
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'en attente':
        return '#FF9800';
      case 'in_progress':
      case 'en cours':
        return '#2196F3';
      case 'completed':
      case 'complétée':
        return '#4CAF50';
      case 'cancelled':
      case 'annulée':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'en attente':
        return '⏳ En attente';
      case 'in_progress':
      case 'en cours':
        return '🚚 En cours';
      case 'completed':
      case 'complétée':
        return '✅ Complétée';
      case 'cancelled':
      case 'annulée':
        return '❌ Annulée';
      default:
        return status;
    }
  };

  const statusColor = getStatusColor(delivery.status);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: statusColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* En-tête avec statut */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.epicerieName}>{delivery.epicerieNom}</Text>
          <Text style={styles.orderId}>Commande #{delivery.orderId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{getStatusLabel(delivery.status)}</Text>
        </View>
      </View>

      {/* Type de livraison */}
      {delivery.deliveryType && (
        <View style={styles.deliveryTypeSection}>
          <Text style={styles.deliveryTypeLabel}>
            {delivery.deliveryType === 'PICKUP' ? '🏪 Retrait en épicerie' : '🚚 Livraison à domicile'}
          </Text>
        </View>
      )}

      {/* Infos client et adresse */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>👤 Client:</Text>
          <Text style={styles.value}>{delivery.clientNom}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>📍 Adresse:</Text>
          <Text style={styles.valueAddress}>{delivery.adresseLivraison}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>📞 Téléphone:</Text>
          <Text style={styles.value}>{delivery.telephoneLivraison || 'N/A'}</Text>
        </View>
      </View>

      {/* Montant et articles */}
      <View style={styles.footer}>
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Montant</Text>
          <Text style={styles.amount}>{delivery.total.toFixed(2)} DH</Text>
        </View>
        <Text style={styles.itemsCount}>{delivery.nombreItems} article(s)</Text>
      </View>

      {/* Boutons d'action */}
      {(delivery.status.toLowerCase() === 'pending' ||
        delivery.status.toLowerCase() === 'en attente' ||
        delivery.status.toLowerCase() === 'in_progress' ||
        delivery.status.toLowerCase() === 'en cours') && (
        <View style={styles.actionsRow}>
          {(delivery.status.toLowerCase() === 'pending' ||
            delivery.status.toLowerCase() === 'en attente') && onStartPress && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.startBtn]}
              onPress={onStartPress}
              disabled={isLoading}
            >
              <Text style={styles.actionBtnText}>
                {delivery.deliveryType === 'PICKUP' ? '🏪 Récupérer' : '🚚 Récupérer'}
              </Text>
            </TouchableOpacity>
          )}
          {(delivery.status.toLowerCase() === 'in_progress' ||
            delivery.status.toLowerCase() === 'en cours') && onCompletePress && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.completeBtn]}
              onPress={onCompletePress}
              disabled={isLoading}
            >
              <Text style={styles.actionBtnText}>
                {delivery.deliveryType === 'PICKUP' ? '✅ Remis au client' : '✅ Livré au client'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 8,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleSection: {
    flex: 1,
  },
  epicerieName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryTypeSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f7ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  deliveryTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  value: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  valueAddress: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  amountSection: {
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9C27B0',
  },
  itemsCount: {
    fontSize: 12,
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    backgroundColor: '#4CAF50',
  },
  completeBtn: {
    backgroundColor: '#2196F3',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
