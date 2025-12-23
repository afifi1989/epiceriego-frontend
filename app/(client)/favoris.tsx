import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { favoritesService } from '../../src/services/favoritesService';
import { Epicerie } from '../../src/type';

export default function FavorisScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [favorites, setFavorites] = useState<Epicerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Charger les favoris quand la page est affichée
  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      setLoading(true);
      console.log('[FavorisScreen] Chargement des épiceries favorites...');

      // Récupérer les IDs des épiceries favorites
      const favoriteIds = await favoritesService.getFavoriteIds();
      console.log('[FavorisScreen] IDs des favoris:', favoriteIds);

      if (favoriteIds.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      // Récupérer les détails de chaque épicerie
      const epiceriesData: Epicerie[] = [];
      for (const id of favoriteIds) {
        try {
          const epicerie = await epicerieService.getEpicerieById(id);
          epiceriesData.push(epicerie);
        } catch (error) {
          console.warn(`[FavorisScreen] Impossible de charger l'épicerie ${id}:`, error);
        }
      }

      setFavorites(epiceriesData);
      console.log('[FavorisScreen] Favoris chargés:', epiceriesData.length);
    } catch (error) {
      console.error('[FavorisScreen] Erreur lors du chargement:', error);
      Alert.alert(t('common.error'), t('favorites.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemoveFavorite = async (epicerieId: number, epicerieName: string) => {
    Alert.alert(
      t('favorites.removeFavorite'),
      `${t('favorites.confirmRemove')} "${epicerieName}" ${t('favorites.fromFavorites')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await favoritesService.removeFavorite(epicerieId);
              if (success) {
                setFavorites(favorites.filter(e => e.id !== epicerieId));
                Alert.alert(t('common.success'), t('favorites.removed'));
              } else {
                Alert.alert(t('common.error'), t('favorites.removeError'));
              }
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert(t('common.error'), t('favorites.errorOccurred'));
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const renderEpicerie = (item: Epicerie) => (
    <View key={item.id} style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
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

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveFavorite(item.id, item.nomEpicerie)}
      >
        <Text style={styles.removeButtonText}>❌ {t('favorites.remove')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('favorites.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⭐ {t('favorites.myFavorites')}</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} {favorites.length !== 1 ? t('favorites.epiceries') : t('favorites.epicerie')}
        </Text>
      </View>

      {favorites.length === 0 ? (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💔</Text>
            <Text style={styles.emptyText}>{t('favorites.noFavorites')}</Text>
            <Text style={styles.emptySubtext}>
              {t('favorites.addFavoritesHint')}
            </Text>
            <TouchableOpacity
              style={styles.discoverButton}
              onPress={() => router.push('/(client)/epiceries')}
            >
              <Text style={styles.discoverButtonText}>🔍 {t('favorites.discoverEpiceries')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.resultsContainer}>
            {favorites.map(epicerie => renderEpicerie(epicerie))}
          </View>
        </ScrollView>
      )}
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
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
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
  resultsContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 15,
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
  removeButton: {
    backgroundColor: '#ffebee',
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  removeButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  discoverButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  discoverButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
});
