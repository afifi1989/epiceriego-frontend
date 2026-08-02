export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../src/context/LanguageContext';

/**
 * Écran de confirmation de commande — dernière étape du parcours d'achat.
 *
 * <p>Affiché après la création réussie de la (ou des) commande(s). Remplace
 * l'ancien comportement « toast + retour accueil » par une vraie page de
 * réassurance : coche de succès, récapitulatif (livraison / paiement / total)
 * et deux actions claires — suivre la commande ou continuer ses achats.</p>
 *
 * <p>Reçoit en paramètres (sérialisés par le panier) :
 *  - `count`     : nombre de commandes créées (multi-boutique → N)
 *  - `totalText` : total déjà formaté avec la devise
 *  - `delivery`  : libellé du mode de livraison
 *  - `payment`   : libellé du moyen de paiement
 *  - `orderId`   : id de la commande (mono uniquement) pour le suivi direct.</p>
 */
export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    count?: string;
    totalText?: string;
    delivery?: string;
    payment?: string;
    orderId?: string;
  }>();

  const count = useMemo(() => {
    const n = parseInt(typeof params.count === 'string' ? params.count : '1', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [params.count]);

  const orderId = typeof params.orderId === 'string' && params.orderId ? params.orderId : null;
  const totalText = typeof params.totalText === 'string' ? params.totalText : '';
  const delivery = typeof params.delivery === 'string' ? params.delivery : '';
  const payment = typeof params.payment === 'string' ? params.payment : '';

  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const trackOrder = () => {
    // Mono-commande → détail direct ; multi → liste des commandes.
    if (count === 1 && orderId) {
      router.replace({ pathname: '/(client)/(commandes)/[id]', params: { id: orderId } });
    } else {
      router.replace('/(client)/(commandes)');
    }
  };

  const continueShopping = () => router.replace('/(client)/home');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Coche de succès */}
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={56} color="#fff" />
        </View>

        <Text style={styles.title}>
          {tr('cart.orderConfirmedTitle', 'Commande confirmée !')}
        </Text>
        <Text style={styles.subtitle}>
          {count > 1
            ? t('cart.orderConfirmedMultiSubtitle', { count })
            : tr('cart.orderConfirmedSubtitle', 'Votre commande a bien été envoyée à la boutique.')}
        </Text>

        {/* Récapitulatif */}
        <View style={styles.card}>
          {count > 1 && (
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Ionicons name="storefront-outline" size={18} color="#4CAF50" />
                <Text style={styles.rowLabelText}>{tr('cart.ordersCount', 'Commandes')}</Text>
              </View>
              <Text style={styles.rowValue}>{count}</Text>
            </View>
          )}
          {!!delivery && (
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Ionicons name="bicycle-outline" size={18} color="#4CAF50" />
                <Text style={styles.rowLabelText}>{tr('cart.deliveryMode', 'Livraison')}</Text>
              </View>
              <Text style={styles.rowValue} numberOfLines={1}>{delivery}</Text>
            </View>
          )}
          {!!payment && (
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Ionicons name="wallet-outline" size={18} color="#4CAF50" />
                <Text style={styles.rowLabelText}>{tr('cart.paymentMethodShort', 'Paiement')}</Text>
              </View>
              <Text style={styles.rowValue} numberOfLines={1}>{payment}</Text>
            </View>
          )}
          {!!totalText && (
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>{tr('cart.total', 'Total')}</Text>
              <Text style={styles.totalValue}>{totalText}</Text>
            </View>
          )}
        </View>

        <View style={styles.nextHint}>
          <Ionicons name="time-outline" size={16} color="#888" />
          <Text style={styles.nextHintText}>
            {tr('cart.orderNextHint', 'La boutique va confirmer et préparer votre commande. Vous serez notifié à chaque étape.')}
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={trackOrder} activeOpacity={0.9}>
          <Ionicons name="receipt-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>{tr('cart.trackOrder', 'Suivre ma commande')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={continueShopping} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>{tr('cart.continueShopping', 'Continuer mes achats')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F8',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabelText: {
    fontSize: 14,
    color: '#6B7280',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  totalRow: {
    borderBottomWidth: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2E7D32',
  },
  nextHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  nextHintText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#F6F7F8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
});
