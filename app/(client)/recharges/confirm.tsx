import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import telecomRechargeService from '@/src/services/telecomRechargeService';
import { cartService } from '@/src/services/cartService';
import { TelecomOperator, RechargeTransactionStatus, CartItem } from '@/src/type';

/**
 * Écran de confirmation de recharge
 * Route: /recharges/confirm
 */
export default function RechargeConfirmScreen() {
  const {
    epicerieId,
    offerId,
    phoneNumber,
    amount,
    price,
    description,
    operator
  } = useLocalSearchParams<{
    epicerieId: string;
    offerId: string;
    phoneNumber: string;
    amount: string;
    price: string;
    description: string;
    operator: TelecomOperator;
  }>();

  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  const operatorDisplayName = telecomRechargeService.getOperatorDisplayName(operator);
  const operatorColor = telecomRechargeService.getOperatorColor(operator);

  const handleConfirm = async () => {
    try {
      setProcessing(true);

      // Créer un CartItem pour la recharge
      const rechargeCartItem: CartItem = {
        itemType: 'RECHARGE',
        productId: -1, // ID spécial pour les recharges
        productNom: `Recharge ${operatorDisplayName} - ${amount} DH`,
        epicerieId: parseInt(epicerieId),
        quantity: 1,
        pricePerUnit: parseFloat(price),
        totalPrice: parseFloat(price),
        rechargeOfferId: parseInt(offerId),
        rechargePhoneNumber: phoneNumber,
        rechargeOperator: operator,
        rechargeDescription: description,
      };

      // Ajouter au panier
      await cartService.addToCart(rechargeCartItem);

      Alert.alert(
        'Ajouté au panier',
        `La recharge ${operatorDisplayName} de ${amount} DH pour le ${phoneNumber} a été ajoutée à votre panier.\n\n` +
        'Vous pouvez maintenant finaliser votre commande depuis le panier.',
        [
          {
            text: 'Voir le panier',
            onPress: () => router.push('/(client)/cart')
          },
          {
            text: 'Continuer mes achats',
            onPress: () => router.push('/(client)/epiceries')
          }
        ]
      );
    } catch (error) {
      console.error('Erreur ajout recharge au panier:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la recharge au panier');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.header, { backgroundColor: operatorColor }]}>
        <Ionicons name="checkmark-circle-outline" size={80} color="#FFF" />
        <Text style={styles.headerTitle}>Confirmation de recharge</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Détails de la recharge</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Opérateur:</Text>
          <View style={styles.operatorBadge}>
            <View style={[styles.operatorDot, { backgroundColor: operatorColor }]} />
            <Text style={[styles.detailValue, { fontWeight: 'bold' }]}>
              {operatorDisplayName}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Offre:</Text>
          <Text style={styles.detailValue}>{description}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Montant:</Text>
          <Text style={[styles.detailValue, styles.amountValue]}>
            {amount} DH
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Numéro à recharger:</Text>
          <View style={styles.phoneContainer}>
            <Ionicons name="phone-portrait" size={18} color={operatorColor} />
            <Text style={[styles.detailValue, { marginLeft: 8 }]}>
              {phoneNumber}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total à payer:</Text>
          <Text style={[styles.totalValue, { color: operatorColor }]}>
            {price} DH
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle" size={24} color="#2196F3" />
          <Text style={styles.infoTitle}>Comment ça marche?</Text>
        </View>
        <Text style={styles.infoText}>
          La recharge sera ajoutée à votre panier avec vos autres produits.
          {'\n\n'}
          Lors de la validation de votre commande:
          {'\n'}• La recharge sera traitée automatiquement
          {'\n'}• Vous recevrez une confirmation par SMS
          {'\n'}• Le crédit sera envoyé au numéro indiqué
          {'\n\n'}
          Opérateurs supportés:
          {'\n'}✅ Inwi, Orange, Maroc Telecom, Wana
          {'\n'}✅ Traitement instantané
          {'\n'}✅ Historique des transactions disponible
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.confirmButton, { backgroundColor: operatorColor }]}
        onPress={handleConfirm}
        disabled={processing}
        activeOpacity={0.8}
      >
        {processing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="cart" size={24} color="#FFF" />
            <Text style={styles.confirmButtonText}>Ajouter au panier</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Retour</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  contentContainer: {
    paddingBottom: 40
  },
  header: {
    alignItems: 'center',
    padding: 40,
    paddingTop: 60
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16
  },
  card: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textAlign: 'right'
  },
  amountValue: {
    fontWeight: 'bold',
    fontSize: 18
  },
  operatorBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  operatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  totalValue: {
    fontSize: 28,
    fontWeight: 'bold'
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3'
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 8
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 22
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8
  },
  cancelButton: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16
  }
});
