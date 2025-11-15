import { View, Text, StyleSheet } from 'react-native';

interface LivreurStatsCardProps {
  totalUnassigned: number;
  totalAssigned: number;
  availableCount: number;
}

export const LivreurStatsCard = ({
  totalUnassigned,
  totalAssigned,
  availableCount,
}: LivreurStatsCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Gestion des Livreurs</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalAssigned}</Text>
          <Text style={styles.statLabel}>Assignés</Text>
          <View style={[styles.statColor, { backgroundColor: '#2196F3' }]} />
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{availableCount}</Text>
          <Text style={styles.statLabel}>Disponibles</Text>
          <View style={[styles.statColor, { backgroundColor: '#4CAF50' }]} />
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalUnassigned}</Text>
          <Text style={styles.statLabel}>À assigner</Text>
          <View style={[styles.statColor, { backgroundColor: '#FF9800' }]} />
        </View>
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
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
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
});
