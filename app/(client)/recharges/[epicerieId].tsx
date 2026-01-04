import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import telecomRechargeService from '@/src/services/telecomRechargeService';
import { TelecomOperator } from '@/src/type';

/**
 * Écran de sélection d'opérateur pour les recharges téléphoniques
 * Route: /recharges/[epicerieId]
 */
export default function RechargeOperatorSelectionScreen() {
  const { epicerieId } = useLocalSearchParams<{ epicerieId: string }>();
  const router = useRouter();

  const [operators, setOperators] = useState<TelecomOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeEnabled, setRechargeEnabled] = useState(false);

  // Recharger les opérateurs à chaque fois que l'écran devient actif ou que l'ID change
  useFocusEffect(
    useCallback(() => {
      loadOperators();
    }, [epicerieId])
  );

  const loadOperators = async () => {
    try {
      setLoading(true);
      const id = parseInt(epicerieId);

      // Vérifier si le service est activé
      const enabled = await telecomRechargeService.checkRechargeStatus(id);
      setRechargeEnabled(enabled);

      if (!enabled) {
        Alert.alert(
          'Service non disponible',
          'Cette épicerie ne propose pas encore de recharges téléphoniques.'
        );
        return;
      }

      // Charger les opérateurs disponibles
      const availableOperators = await telecomRechargeService.getAvailableOperators(id);
      setOperators(availableOperators);

      if (availableOperators.length === 0) {
        Alert.alert(
          'Aucun opérateur disponible',
          'Cette épicerie n\'a pas encore configuré d\'offres de recharge.'
        );
      }
    } catch (error) {
      console.error('Error loading operators:', error);
      Alert.alert('Erreur', 'Impossible de charger les opérateurs disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleOperatorSelect = (operator: TelecomOperator) => {
    router.push({
      pathname: '/recharges/offers/[epicerieId]',
      params: {
        epicerieId,
        operator
      }
    });
  };

  const getOperatorIcon = (operator: TelecomOperator): keyof typeof Ionicons.glyphMap => {
    // Retourner une icône par défaut pour chaque opérateur
    return 'phone-portrait-outline';
  };

  const renderOperatorCard = ({ item }: { item: TelecomOperator }) => {
    const displayName = telecomRechargeService.getOperatorDisplayName(item);
    const color = telecomRechargeService.getOperatorColor(item);

    return (
      <TouchableOpacity
        style={[styles.operatorCard, { borderColor: color }]}
        onPress={() => handleOperatorSelect(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.operatorIconContainer, { backgroundColor: color }]}>
          <Ionicons name={getOperatorIcon(item)} size={40} color="#FFF" />
        </View>
        <Text style={styles.operatorName}>{displayName}</Text>
        <View style={[styles.operatorBadge, { backgroundColor: color }]}>
          <Text style={styles.operatorBadgeText}>Disponible</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#666" style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Chargement des opérateurs...</Text>
      </View>
    );
  }

  if (!rechargeEnabled) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="phone-portrait-outline" size={80} color="#CCC" />
        <Text style={styles.emptyTitle}>Service non disponible</Text>
        <Text style={styles.emptyText}>
          Cette épicerie ne propose pas encore de recharges téléphoniques.
        </Text>
      </View>
    );
  }

  if (operators.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={80} color="#CCC" />
        <Text style={styles.emptyTitle}>Aucun opérateur disponible</Text>
        <Text style={styles.emptyText}>
          Cette épicerie n'a pas encore configuré d'offres de recharge.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Choisissez votre opérateur</Text>
        <Text style={styles.headerSubtitle}>
          Sélectionnez votre opérateur téléphonique pour voir les offres disponibles
        </Text>
      </View>

      <FlatList
        data={operators}
        renderItem={renderOperatorCard}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 32
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  listContainer: {
    padding: 16
  },
  operatorCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  operatorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  operatorName: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  operatorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8
  },
  operatorBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600'
  },
  chevron: {
    marginLeft: 8
  }
});
