import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Promotion, promotionService } from '../../src/services/promotionService';

export default function PromotionsScreen() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPromotions();
    }, [])
  );

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await promotionService.getMyPromotions();
      setPromotions(data);
    } catch (error) {
      console.error('Error loading promotions:', error);
      Alert.alert('Erreur', 'Impossible de charger vos promotions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPromotions();
  };

  const handleToggleStatus = async (promo: Promotion) => {
    try {
      await promotionService.togglePromotionStatus(promo.id, !promo.isActive);
      Alert.alert(
        'Succès',
        `Promotion ${!promo.isActive ? 'activée' : 'désactivée'}`
      );
      await loadPromotions();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la promotion');
    }
  };

  const handleDeletePromo = async (promo: Promotion) => {
    Alert.alert(
      'Supprimer la promotion',
      `Êtes-vous sûr de vouloir supprimer "${promo.titre}" ?`,
      [
        { text: 'Annuler', onPress: () => {}, style: 'cancel' },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              await promotionService.deletePromotion(promo.id);
              Alert.alert('Succès', 'Promotion supprimée');
              await loadPromotions();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer la promotion');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const isPromotionExpired = (promo: Promotion) => {
    return new Date(promo.dateFin) < new Date();
  };

  const renderPromotion = ({ item }: { item: Promotion }) => {
    const expired = isPromotionExpired(item);

    return (
      <View
        style={[
          styles.promoCard,
          !item.isActive && styles.promoCardInactive,
          expired && styles.promoCardExpired,
        ]}
      >
        <View style={styles.promoHeader}>
          <View style={styles.promoTitleSection}>
            <Text style={styles.promoTitle} numberOfLines={2}>
              {item.titre}
            </Text>
            <View style={styles.promoTagContainer}>
              <View
                style={[
                  styles.promoTag,
                  item.isActive ? styles.tagActive : styles.tagInactive,
                ]}
              >
                <Text
                  style={[
                    styles.promoTagText,
                    item.isActive ? styles.tagTextActive : styles.tagTextInactive,
                  ]}
                >
                  {item.isActive ? '✓ Actif' : '✕ Inactif'}
                </Text>
              </View>
              {expired && (
                <View style={styles.promoTag}>
                  <Text style={styles.promoTagText}>⏳ Expiré</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.promoDiscount}>
            <Text style={styles.discountValue}>
              {item.reductionPercentage}%
            </Text>
            <Text style={styles.discountLabel}>réduction</Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.promoDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.promomDatesSection}>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Début:</Text>
            <Text style={styles.dateValue}>{formatDate(item.dateDebut)}</Text>
          </View>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>Fin:</Text>
            <Text style={[styles.dateValue, expired && styles.dateValueExpired]}>
              {formatDate(item.dateFin)}
            </Text>
          </View>
        </View>

        <View style={styles.promoActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/(epicier)/modifier-promo',
                params: { promoId: item.id.toString() },
              })
            }
          >
            <Text style={styles.actionButtonText}>✏️ Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              item.isActive ? styles.actionDisable : styles.actionEnable,
            ]}
            onPress={() => handleToggleStatus(item)}
          >
            <Text style={styles.actionButtonText}>
              {item.isActive ? '⊖ Désactiver' : '⊕ Activer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionDelete]}
            onPress={() => handleDeletePromo(item)}
          >
            <Text style={styles.actionButtonText}>🗑️ Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={promotions}
        renderItem={renderPromotion}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2196F3"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📢</Text>
            <Text style={styles.emptyStateTitle}>Aucune promotion</Text>
            <Text style={styles.emptyStateText}>
              Créez votre première promotion pour attirer les clients
            </Text>
          </View>
        }
        contentContainerStyle={promotions.length === 0 && styles.emptyContainer}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/(epicier)/ajouter-promo')}
      >
        <Text style={styles.addButtonText}>+ Nouvelle Promotion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  promoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  promoCardInactive: {
    borderLeftColor: '#999',
    opacity: 0.7,
  },
  promoCardExpired: {
    borderLeftColor: '#FF9800',
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  promoTitleSection: {
    flex: 1,
    marginRight: 10,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  promoTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  promoTag: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagActive: {
    backgroundColor: '#E8F5E9',
  },
  tagInactive: {
    backgroundColor: '#FFEBEE',
  },
  promoTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  tagTextActive: {
    color: '#4CAF50',
  },
  tagTextInactive: {
    color: '#F44336',
  },
  promoDiscount: {
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  discountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  discountLabel: {
    fontSize: 10,
    color: '#1976D2',
    marginTop: 2,
  },
  promoDesc: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  promomDatesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  dateValueExpired: {
    color: '#FF9800',
  },
  promoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  actionDisable: {
    backgroundColor: '#FCE4EC',
    borderColor: '#E91E63',
  },
  actionEnable: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  actionDelete: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
