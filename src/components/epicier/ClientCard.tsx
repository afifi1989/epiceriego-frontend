import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { ClientEpicerieRelation } from '../../type';
import { Colors, FontSizes, Spacing } from '../../constants/colors';

interface ClientCardProps {
  client: ClientEpicerieRelation & {
    totalDebt?: number;
    totalAdvances?: number;
    numberOfOrders?: number;
  };
  onPress?: () => void;
  onEditCredit?: () => void;
  onRemove?: () => void;
  showActions?: boolean;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  onPress,
  onEditCredit,
  onRemove,
  showActions = true,
}) => {
  const getCreditStatusColor = () => {
    if (!client.allowCredit) return '#F44336';
    if (!client.creditLimit) return '#FF9800';
    return '#4CAF50';
  };

  const getCreditStatusLabel = () => {
    if (!client.allowCredit) return 'Crédit désactivé';
    if (!client.creditLimit) return 'Crédit illimité';
    return `Limite: ${client.creditLimit.toFixed(2)} DH`;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Client Info */}
      <View style={styles.headerSection}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName} numberOfLines={1}>
            {client.clientNom}
          </Text>
          <Text style={styles.clientEmail} numberOfLines={1}>
            {client.clientEmail}
          </Text>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                client.status === 'ACCEPTED'
                  ? '#E8F5E9'
                  : client.status === 'PENDING'
                    ? '#FFF3E0'
                    : '#FFEBEE',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  client.status === 'ACCEPTED'
                    ? '#4CAF50'
                    : client.status === 'PENDING'
                      ? '#FF9800'
                      : '#F44336',
              },
            ]}
          >
            {client.status === 'ACCEPTED'
              ? 'Accepté'
              : client.status === 'PENDING'
                ? 'En attente'
                : 'Rejeté'}
          </Text>
        </View>
      </View>

      {/* Financial Info */}
      <View style={styles.financialSection}>
        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>Dû</Text>
          <Text
            style={[
              styles.financialValue,
              client.totalDebt && client.totalDebt > 0
                ? styles.debtAmount
                : styles.noDebt,
            ]}
          >
            {(client.totalDebt || 0).toFixed(2)} DH
          </Text>
        </View>

        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>Avances</Text>
          <Text style={styles.financialValue}>
            {(client.totalAdvances || 0).toFixed(2)} DH
          </Text>
        </View>

        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>Commandes</Text>
          <Text style={styles.financialValue}>
            {client.numberOfOrders || 0}
          </Text>
        </View>
      </View>

      {/* Credit Status */}
      <View
        style={[
          styles.creditStatusSection,
          { borderLeftColor: getCreditStatusColor() },
        ]}
      >
        <Text style={styles.creditStatusLabel}>
          {getCreditStatusLabel()}
        </Text>
      </View>

      {/* Actions */}
      {showActions && (onEditCredit || onRemove) && (
        <View style={styles.actionsSection}>
          {onEditCredit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onEditCredit}
            >
              <Text style={styles.actionButtonText}>Gérer crédit</Text>
            </TouchableOpacity>
          )}

          {onRemove && (
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={onRemove}
            >
              <Text style={[styles.actionButtonText, styles.removeButtonText]}>
                Retirer
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
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientInfo: {
    flex: 1,
    marginRight: 8,
  },
  clientName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  financialSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 12,
  },
  financialItem: {
    alignItems: 'center',
    flex: 1,
  },
  financialLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  financialValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: Colors.text,
  },
  debtAmount: {
    color: '#F44336',
  },
  noDebt: {
    color: '#4CAF50',
  },
  creditStatusSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  creditStatusLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: '#FFEBEE',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  removeButtonText: {
    color: '#F44336',
  },
});
