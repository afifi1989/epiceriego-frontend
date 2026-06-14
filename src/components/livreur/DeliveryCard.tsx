import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Delivery } from '../../type';
import {
  NormalizedDeliveryStatus,
  isInDelivery,
  isReady,
  normalizeDeliveryStatus,
} from '../../utils/deliveryStatus';

/**
 * Ouvre le dialer avec le numéro du client. Action n°1 du livreur devant la
 * porte — avant, le numéro était affiché en texte mort : recopie manuelle
 * vers le dialer à chaque livraison.
 */
const callClient = (phone: string) => {
  const sanitized = phone.replace(/[^\d+]/g, '');
  Linking.openURL(`tel:${sanitized}`).catch(() =>
    Alert.alert('Erreur', "Impossible d'ouvrir le composeur téléphonique."),
  );
};

/**
 * Ouvre Google Maps en mode ITINÉRAIRE vers l'adresse de livraison (URL
 * universelle https — fonctionne iOS/Android, app Maps ou navigateur).
 * On ne dispose pas des coordonnées GPS du client dans le DTO : l'adresse
 * textuelle en destination est le bon fallback.
 */
const openItinerary = (address: string) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert('Erreur', "Impossible d'ouvrir l'itinéraire."),
  );
};

interface DeliveryCardProps {
  delivery: Delivery;
  onPress: () => void;
  onStartPress?: () => void;
  onCompletePress?: () => void;
  /** V116 — Signaler que la livraison n'a pas pu se faire (IN_DELIVERY only). */
  onReportProblem?: () => void;
  isLoading?: boolean;
}

export const DeliveryCard = ({
  delivery,
  onPress,
  onStartPress,
  onCompletePress,
  onReportProblem,
  isLoading = false,
}: DeliveryCardProps) => {
  const normalizedStatus = normalizeDeliveryStatus(delivery.status);
  const isPickupOrder = delivery.deliveryType === 'PICKUP';

  const getStatusColor = (status: NormalizedDeliveryStatus): string => {
    switch (status) {
      case 'pending':
      case 'preparing':
        return '#FF9800';
      case 'ready':
        return '#4CAF50';
      case 'in_delivery':
        return '#2196F3';
      case 'delivered':
        return '#4CAF50';
      case 'cancelled':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: NormalizedDeliveryStatus): string => {
    switch (status) {
      case 'pending':
        return '⏳ En attente';
      case 'preparing':
        return '🍳 En préparation';
      case 'ready':
        return isPickupOrder ? '✅ Prête — retrait client' : '✅ Prête à récupérer';
      case 'in_delivery':
        return '🚚 En cours';
      case 'delivered':
        return '✅ Complétée';
      case 'cancelled':
        return '❌ Annulée';
      default:
        return delivery.status;
    }
  };

  /**
   * Actions possibles, alignées sur les règles backend :
   * - HOME_DELIVERY + READY        → « Récupérer » (delivery/{id}/start)
   * - HOME_DELIVERY + IN_DELIVERY  → « Livré au client » (delivery/{id}/complete)
   * - PICKUP + READY               → « Remis au client » (pickup/{id}/complete,
   *                                   pas de phase IN_DELIVERY pour un retrait)
   * PENDING/PREPARING : aucune action — le serveur exige le statut READY.
   */
  const canStart = !isPickupOrder && isReady(delivery.status) && !!onStartPress;
  const canComplete =
    ((isPickupOrder && isReady(delivery.status)) ||
      (!isPickupOrder && isInDelivery(delivery.status))) &&
    !!onCompletePress;
  // V116 — Signaler un problème : seulement une fois en route (IN_DELIVERY).
  const canReportProblem =
    !isPickupOrder && isInDelivery(delivery.status) && !!onReportProblem;

  const statusColor = getStatusColor(normalizedStatus);

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
          <Text style={styles.statusText}>{getStatusLabel(normalizedStatus)}</Text>
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

        {/* Actions terrain : 1 tap au lieu d'une recopie manuelle (audit UX).
            Itinéraire masqué en retrait épicerie (le livreur n'y va pas). */}
        <View style={styles.contactRow}>
          {!!delivery.telephoneLivraison && (
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => callClient(delivery.telephoneLivraison!)}
              accessibilityRole="button"
              accessibilityLabel={`Appeler ${delivery.clientNom}`}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={styles.contactBtnText}>📞 Appeler</Text>
            </TouchableOpacity>
          )}
          {!!delivery.adresseLivraison && delivery.deliveryType !== 'PICKUP' && (
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => openItinerary(delivery.adresseLivraison)}
              accessibilityRole="button"
              accessibilityLabel={`Itinéraire vers ${delivery.adresseLivraison}`}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={styles.contactBtnText}>🗺️ Itinéraire</Text>
            </TouchableOpacity>
          )}
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

      {/* V114 — Repère encaissement espèces (commande CASH non payée) */}
      {delivery.paymentMethod === 'CASH' && delivery.paymentStatus !== 'PAID' && (
        <View style={styles.cashBadge}>
          <Text style={styles.cashBadgeText}>
            💵 À encaisser : {delivery.total.toFixed(2)} DH en espèces
          </Text>
        </View>
      )}

      {/* Boutons d'action */}
      {(canStart || canComplete || canReportProblem) && (
        <View style={styles.actionsRow}>
          {canStart && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.startBtn, isLoading && styles.actionBtnDisabled]}
              onPress={onStartPress}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={`Récupérer la commande ${delivery.orderId}`}
              accessibilityState={{ disabled: isLoading, busy: isLoading }}
            >
              <Text style={styles.actionBtnText}>
                {isLoading ? '⏳ En cours…' : '🚚 Récupérer'}
              </Text>
            </TouchableOpacity>
          )}
          {canComplete && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.completeBtn, isLoading && styles.actionBtnDisabled]}
              onPress={onCompletePress}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={
                isPickupOrder
                  ? `Marquer la commande ${delivery.orderId} comme remise au client`
                  : `Marquer la commande ${delivery.orderId} comme livrée`
              }
              accessibilityState={{ disabled: isLoading, busy: isLoading }}
            >
              <Text style={styles.actionBtnText}>
                {isLoading ? '⏳ En cours…' : isPickupOrder ? '🏪 Remis au client' : '✅ Livré au client'}
              </Text>
            </TouchableOpacity>
          )}
          {canReportProblem && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.problemBtn, isLoading && styles.actionBtnDisabled]}
              onPress={onReportProblem}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={`Signaler un problème de livraison pour la commande ${delivery.orderId}`}
            >
              <Text style={styles.problemBtnText}>⚠️ Problème</Text>
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
  // Lisibilité terrain (audit UX) : la card est lue debout, en plein soleil,
  // en 0,5s. L'adresse — l'info n°1 du métier — était paradoxalement la plus
  // petite (13px) ; les labels #666 passaient mal en extérieur.
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    width: 80,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  valueAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#9C27B0',
  },
  contactBtnText: {
    color: '#9C27B0',
    fontWeight: '700',
    fontSize: 13,
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
  cashBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  cashBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
    textAlign: 'center',
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
  actionBtnDisabled: {
    opacity: 0.55,
  },
  completeBtn: {
    backgroundColor: '#2196F3',
  },
  problemBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E65100',
    flexGrow: 0,
  },
  problemBtnText: {
    color: '#E65100',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
