import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { epicerieService } from '../../src/services/epicerieService';
import { Epicerie } from '../../src/type';

export default function EpiceriesScreen() {
  const router = useRouter();
  const [epiceries, setEpiceries] = useState<Epicerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEpiceries();
  }, []);

  const loadEpiceries = async () => {
    try {
      const data = await epicerieService.getAllEpiceries();
      setEpiceries(data);
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEpiceries();
  };

  const renderEpicerie = ({ item }: { item: Epicerie }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(client)/(epicerie)/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>🏪</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.nomEpicerie}</Text>
          <Text style={styles.cardAddress}>{item.adresse}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>⭐ 4.5</Text>
            <Text style={styles.cardMetaText}>📦 {item.nombreProducts} produits</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Épiceries à proximité</Text>
        <Text style={styles.headerSubtitle}>📍 Casablanca, Maroc</Text>
      </View>

      <FlatList
        data={epiceries}
        renderItem={renderEpicerie}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune épicerie disponible</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  list: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
  },
  emoji: {
    fontSize: 50,
    marginRight: 15,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 15,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
