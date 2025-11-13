import { View, Text, StyleSheet } from 'react-native';

interface DailyStatsCardProps {
  completed: number;
  inProgress: number;
  pending: number;
  totalAmount: number;
}

export const DailyStatsCard = ({
  completed,
  inProgress,
  pending,
  totalAmount,
}: DailyStatsCardProps) => {
  const total = completed + inProgress + pending;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Statistiques du jour</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{completed}</Text>
          <Text style={styles.statLabel}>Complétées</Text>
          <View style={[styles.statColor, { backgroundColor: '#4CAF50' }]} />
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{inProgress}</Text>
          <Text style={styles.statLabel}>En cours</Text>
          <View style={[styles.statColor, { backgroundColor: '#2196F3' }]} />
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pending}</Text>
          <Text style={styles.statLabel}>En attente</Text>
          <View style={[styles.statColor, { backgroundColor: '#FF9800' }]} />
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
          <View style={[styles.statColor, { backgroundColor: '#9C27B0' }]} />
        </View>
      </View>

      <View style={styles.totalAmount}>
        <Text style={styles.amountLabel}>Montant total livré</Text>
        <Text style={styles.amount}>{totalAmount.toFixed(2)} DH</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#9C27B0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  statColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  totalAmount: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  amountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
});
