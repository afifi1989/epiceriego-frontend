import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Invoice } from '../../type';
import { Colors, FontSizes, Spacing } from '../../constants/colors';

interface InvoiceCardProps {
  invoice: Invoice;
  onPress?: () => void;
  onMarkPaid?: () => void;
  showActions?: boolean;
  isClientView?: boolean;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  onPress,
  onMarkPaid,
  showActions = true,
  isClientView = false,
}) => {
  const isOverdue =
    invoice.status === 'UNPAID' &&
    new Date(invoice.dueDate) < new Date();

  const daysOverdue = isOverdue
    ? Math.floor(
        (new Date().getTime() - new Date(invoice.dueDate).getTime()) /
          (1000 * 3600 * 24)
      )
    : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isOverdue && styles.cardOverdue,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header with status */}
      <View style={styles.headerSection}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>
            Facture #{invoice.id}
          </Text>
          <Text style={styles.invoiceOrder}>
            Commande #{invoice.orderId}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            invoice.status === 'PAID'
              ? styles.statusPaid
              : styles.statusUnpaid,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              invoice.status === 'PAID'
                ? styles.statusTextPaid
                : styles.statusTextUnpaid,
            ]}
          >
            {invoice.status === 'PAID' ? '✓ Payée' : 'Non payée'}
          </Text>
        </View>
      </View>

      {/* Client/Store info */}
      <View style={styles.infoSection}>
        {isClientView ? (
          <View>
            <Text style={styles.label}>Épicerie</Text>
            <Text style={styles.value}>{invoice.epicerieName}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.value}>{invoice.clientNom}</Text>
          </View>
        )}

        <View style={styles.separator} />

        <View>
          <Text style={styles.label}>Montant</Text>
          <Text style={styles.amountValue}>
            {invoice.amount.toFixed(2)} DH
          </Text>
        </View>
      </View>

      {/* Dates */}
      <View style={styles.datesSection}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Créée</Text>
          <Text style={styles.dateValue}>
            {formatDate(invoice.createdAt)}
          </Text>
        </View>

        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Échéance</Text>
          <Text
            style={[
              styles.dateValue,
              isOverdue && styles.overdueDate,
            ]}
          >
            {formatDate(invoice.dueDate)}
          </Text>
        </View>

        {invoice.paidDate && (
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Payée</Text>
            <Text style={[styles.dateValue, styles.paidDate]}>
              {formatDate(invoice.paidDate)}
            </Text>
          </View>
        )}
      </View>

      {/* Overdue warning */}
      {isOverdue && (
        <View style={styles.overdueWarning}>
          <Text style={styles.overdueText}>
            ⚠️ En retard de {daysOverdue} jour{daysOverdue !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Actions */}
      {showActions && onMarkPaid && invoice.status === 'UNPAID' && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onMarkPaid}
        >
          <Text style={styles.actionButtonText}>
            Marquer comme payée
          </Text>
        </TouchableOpacity>
      )}

      {showActions && isClientView && invoice.status === 'UNPAID' && (
        <TouchableOpacity
          style={[styles.actionButton, styles.payButton]}
          onPress={onPress}
        >
          <Text style={styles.payButtonText}>
            Payer cette facture
          </Text>
        </TouchableOpacity>
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
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  cardOverdue: {
    borderLeftColor: '#F44336',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  invoiceOrder: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPaid: {
    backgroundColor: '#E8F5E9',
  },
  statusUnpaid: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  statusTextPaid: {
    color: '#4CAF50',
  },
  statusTextUnpaid: {
    color: '#FF9800',
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  datesSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  dateItem: {
    alignItems: 'center',
    flex: 1,
  },
  dateLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  dateValue: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    fontWeight: '500',
  },
  overdueDate: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  paidDate: {
    color: '#4CAF50',
  },
  overdueWarning: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  overdueText: {
    color: '#F44336',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  payButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
