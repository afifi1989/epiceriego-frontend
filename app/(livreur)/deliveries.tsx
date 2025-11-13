import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { DeliveryCard } from '../../src/components/livreur/DeliveryCard';
import { DailyStatsCard } from '../../src/components/livreur/DailyStatsCard';
import { AvailabilityToggle } from '../../src/components/livreur/AvailabilityToggle';
import { livreurService } from '../../src/services/livreurService';
import { Delivery } from '../../src/type';

export default function LivreurDeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Charger les livraisons
  const loadDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await livreurService.getMyDeliveries();
      setDeliveries(data || []);
    } catch (error: any) {
      console.error('Erreur chargement livraisons:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger les livraisons');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les livraisons au montage
  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Rafraîchir quand l'écran est activé
  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  // Rafraîchissement manuel
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDeliveries();
    setIsRefreshing(false);
  };

  // Gérer la disponibilité
  const handleAvailabilityToggle = async (value: boolean) => {
    try {
      setAvailabilityLoading(true);
      await livreurService.updateAvailability(value, userLocation?.latitude, userLocation?.longitude);
      setIsAvailable(value);
      Alert.alert(
        'Succès',
        value
          ? 'Vous êtes maintenant en ligne et recevrez les nouvelles commandes'
          : 'Vous êtes maintenant hors ligne'
      );
    } catch (error: any) {
      console.error('Erreur disponibilité:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la disponibilité');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // Démarrer une livraison
  const handleStartDelivery = async (orderId: number) => {
    try {
      const result = await livreurService.startDelivery(orderId);
      setDeliveries(deliveries.map(d => (d.orderId === orderId ? result : d)));
      Alert.alert('Succès', 'Livraison démarrée');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de démarrer la livraison');
    }
  };

  // Compléter une livraison
  const handleCompleteDelivery = async (orderId: number) => {
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir marquer cette livraison comme complétée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Compléter',
          onPress: async () => {
            try {
              const result = await livreurService.completeDelivery(orderId);
              setDeliveries(deliveries.map(d => (d.orderId === orderId ? result : d)));
              Alert.alert('Succès', 'Livraison complétée');
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de compléter la livraison');
            }
          },
        },
      ]
    );
  };

  // Calculer les statistiques
  const stats = {
    completed: deliveries.filter(d => d.status.toLowerCase() === 'completed' || d.status.toLowerCase() === 'complétée').length,
    inProgress: deliveries.filter(d => d.status.toLowerCase() === 'in_progress' || d.status.toLowerCase() === 'en cours').length,
    pending: deliveries.filter(d => d.status.toLowerCase() === 'pending' || d.status.toLowerCase() === 'en attente').length,
    totalAmount: deliveries.reduce((sum, d) => sum + d.total, 0),
  };

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <DeliveryCard
      delivery={item}
      onPress={() => {
        /* Naviguer vers détail si besoin */
      }}
      onStartPress={() => handleStartDelivery(item.orderId)}
      onCompletePress={() => handleCompleteDelivery(item.orderId)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎉</Text>
      <Text style={styles.emptyTitle}>Aucune livraison</Text>
      <Text style={styles.emptySubtitle}>
        Vous n'avez pas de livraisons en attente pour le moment
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Chargement des livraisons...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        renderItem={renderDelivery}
        keyExtractor={item => item.orderId.toString()}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#9C27B0']}
          />
        }
        ListHeaderComponent={
          <>
            <AvailabilityToggle
              isAvailable={isAvailable}
              onToggle={handleAvailabilityToggle}
              isLoading={availabilityLoading}
              location={userLocation}
            />
            <DailyStatsCard
              completed={stats.completed}
              inProgress={stats.inProgress}
              pending={stats.pending}
              totalAmount={stats.totalAmount}
            />
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});