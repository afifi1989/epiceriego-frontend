import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import telecomRechargeService from '@/src/services/telecomRechargeService';
import { TelecomRechargeOffer, TelecomOperator } from '@/src/type';
import { STORAGE_KEYS } from '@/src/constants/config';

/**
 * Écran de sélection d'offre de recharge
 * Route: /recharges/offers/[epicerieId]?operator=INWI
 */
export default function RechargeOffersScreen() {
  const { epicerieId, operator } = useLocalSearchParams<{
    epicerieId: string;
    operator: TelecomOperator;
  }>();
  const router = useRouter();

  const [offers, setOffers] = useState<TelecomRechargeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<TelecomRechargeOffer | null>(null);

  // Charger le numéro de téléphone du client au montage
  useEffect(() => {
    loadClientPhoneNumber();
  }, []);

  // Recharger les offres à chaque fois que l'écran devient actif ou que les paramètres changent
  useFocusEffect(
    useCallback(() => {
      loadOffers();
    }, [epicerieId, operator])
  );

  const loadClientPhoneNumber = async () => {
    try {
      const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        if (userData.telephone) {
          setPhoneNumber(userData.telephone);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du numéro de téléphone:', error);
    }
  };

  const loadOffers = async () => {
    try {
      setLoading(true);
      const id = parseInt(epicerieId);
      const availableOffers = await telecomRechargeService.getOffersByOperator(
        id,
        operator
      );
      setOffers(availableOffers);

      if (availableOffers.length === 0) {
        Alert.alert(
          'Aucune offre disponible',
          `Aucune offre ${telecomRechargeService.getOperatorDisplayName(operator)} n'est disponible pour le moment.`
        );
      }
    } catch (error) {
      console.error('Error loading offers:', error);
      Alert.alert('Erreur', 'Impossible de charger les offres');
    } finally {
      setLoading(false);
    }
  };

  const handleOfferSelect = (offer: TelecomRechargeOffer) => {
    setSelectedOffer(offer);
  };

  const handleContinue = () => {
    if (!selectedOffer) {
      Alert.alert('Erreur', 'Veuillez sélectionner une offre');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone');
      return;
    }

    if (!telecomRechargeService.isValidMoroccanPhoneNumber(phoneNumber)) {
      Alert.alert(
        'Numéro invalide',
        'Veuillez saisir un numéro de téléphone marocain valide\n(ex: 0612345678 ou +212612345678)'
      );
      return;
    }

    // Formater le numéro
    const formattedPhone = telecomRechargeService.formatPhoneNumber(phoneNumber);

    // Naviguer vers l'écran de confirmation
    router.push({
      pathname: '/recharges/confirm',
      params: {
        epicerieId,
        offerId: selectedOffer.id.toString(),
        phoneNumber: formattedPhone,
        amount: selectedOffer.amount.toString(),
        price: selectedOffer.price.toString(),
        description: selectedOffer.description,
        operator
      }
    });
  };

  const renderOfferCard = ({ item }: { item: TelecomRechargeOffer }) => {
    const isSelected = selectedOffer?.id === item.id;
    const operatorColor = telecomRechargeService.getOperatorColor(operator);

    return (
      <TouchableOpacity
        style={[
          styles.offerCard,
          isSelected && { borderColor: operatorColor, borderWidth: 3 }
        ]}
        onPress={() => handleOfferSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.offerHeader}>
          <View style={[styles.amountBadge, { backgroundColor: operatorColor }]}>
            <Text style={styles.amountText}>{item.amount} DH</Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={28} color={operatorColor} />
          )}
        </View>

        <Text style={styles.offerDescription}>{item.description}</Text>

        {item.validityDays && (
          <View style={styles.validityContainer}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.validityText}>
              Valable {item.validityDays} jours
            </Text>
          </View>
        )}

        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Prix:</Text>
          <Text style={[styles.priceValue, { color: operatorColor }]}>
            {item.price.toFixed(2)} DH
          </Text>
        </View>

        {item.stockAvailable !== null && item.stockAvailable !== undefined && (
          <Text style={styles.stockText}>
            Stock: {item.stockAvailable > 0 ? `${item.stockAvailable} disponibles` : 'Épuisé'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Chargement des offres...</Text>
      </View>
    );
  }

  const operatorDisplayName = telecomRechargeService.getOperatorDisplayName(operator);
  const operatorColor = telecomRechargeService.getOperatorColor(operator);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: operatorColor }]}>
        <Text style={styles.headerTitle}>Recharge {operatorDisplayName}</Text>
        <Text style={styles.headerSubtitle}>
          Choisissez votre offre et saisissez le numéro à recharger
        </Text>
      </View>

      <FlatList
        data={offers}
        renderItem={renderOfferCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.phoneInputContainer}>
            <Text style={styles.phoneLabel}>Numéro à recharger</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="0612345678"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={13}
              placeholderTextColor="#999"
            />
            <Text style={styles.phoneHint}>
              {phoneNumber ? 'Votre numéro (modifiable si besoin)' : 'Format: 0612345678 ou +212612345678'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>Aucune offre disponible</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {selectedOffer && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerLabel}>Total à payer:</Text>
            <Text style={[styles.footerPrice, { color: operatorColor }]}>
              {selectedOffer.price.toFixed(2)} DH
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: operatorColor }]}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
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
  header: {
    padding: 20,
    paddingTop: 60
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9
  },
  listContainer: {
    padding: 16
  },
  phoneInputContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  phoneInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  phoneHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8
  },
  offerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  amountBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  amountText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  offerDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    lineHeight: 22
  },
  validityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  validityText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  priceLabel: {
    fontSize: 16,
    color: '#666'
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  stockText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16
  },
  footer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  footerLabel: {
    fontSize: 16,
    color: '#666'
  },
  footerPrice: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  continueButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8
  }
});
