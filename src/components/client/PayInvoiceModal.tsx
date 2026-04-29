/**
 * PayInvoiceModal — Modal de paiement d'une facture par le client.
 *
 * Deux modes de paiement :
 *  1. Carte bancaire (nouvelle carte ou carte enregistrée)
 *  2. Solde avance (si le client a un solde suffisant)
 *
 * Flux carte :
 *  - processCardPayment → payInvoice(CARD)
 *  - Option "enregistrer la carte" pour les prochaines fois
 *
 * Flux avance :
 *  - payInvoice(ADVANCE)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Invoice, SavedPaymentMethod } from '../../type';
import { paymentService } from '../../services/paymentService';
import { creditPaymentService } from '../../services/creditPaymentService';
import { invoiceService } from '../../services/invoiceService';

interface PayInvoiceModalProps {
  visible: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onPaid: () => void;
}

type PaymentMode = 'choose' | 'card' | 'advance';

// ── Formatage numéro de carte : ajoute un espace tous les 4 chiffres ──
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + '/' + digits.slice(2);
}

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  visible,
  invoice,
  onClose,
  onPaid,
}) => {
  const [mode, setMode] = useState<PaymentMode>('choose');
  const [processing, setProcessing] = useState(false);

  // Carte
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [saveCard, setSaveCard] = useState(false);

  // Cartes enregistrées
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);

  // Avance
  const [advanceBalance, setAdvanceBalance] = useState(0);
  const [loadingAdvance, setLoadingAdvance] = useState(false);

  // Reset à l'ouverture
  useEffect(() => {
    if (visible && invoice) {
      setMode('choose');
      resetCardForm();
      setSelectedCardId(null);
      loadSavedCards();
      loadAdvanceBalance();
    }
  }, [visible, invoice?.id]);

  const resetCardForm = () => {
    setCardNumber('');
    setCardHolder('');
    setExpiry('');
    setCvv('');
    setSaveCard(false);
  };

  const loadSavedCards = async () => {
    setLoadingCards(true);
    try {
      const cards = await paymentService.getSavedPaymentMethods();
      setSavedCards(cards);
    } catch {
      setSavedCards([]);
    } finally {
      setLoadingCards(false);
    }
  };

  const loadAdvanceBalance = async () => {
    if (!invoice) return;
    setLoadingAdvance(true);
    try {
      const data = await creditPaymentService.getMyAdvances();
      const store = data.byStore?.find(s => s.epicerieId === invoice.epicerieId);
      setAdvanceBalance(store?.availableBalance ?? 0);
    } catch {
      setAdvanceBalance(0);
    } finally {
      setLoadingAdvance(false);
    }
  };

  // ── Validation carte ──
  const isCardValid = () => {
    const digits = cardNumber.replace(/\D/g, '');
    const expiryParts = expiry.split('/');
    return (
      digits.length >= 15 &&
      cardHolder.trim().length >= 3 &&
      expiryParts.length === 2 &&
      expiryParts[0].length === 2 &&
      expiryParts[1].length === 2 &&
      cvv.length >= 3
    );
  };

  // ── Paiement par carte ──
  const handleCardPayment = async () => {
    if (!invoice) return;
    setProcessing(true);
    try {
      let transactionId: string;

      if (selectedCardId) {
        // Carte enregistrée
        const result = await paymentService.processPaymentWithSavedCard(
          selectedCardId,
          invoice.amount,
          invoice.orderId,
        );
        transactionId = result.transactionId;
      } else {
        // Nouvelle carte
        const expiryParts = expiry.split('/');
        const cardDetails = {
          cardNumber: cardNumber.replace(/\D/g, ''),
          cardholderName: cardHolder.trim(),
          expiryMonth: expiryParts[0],
          expiryYear: expiryParts[1],
          cvv,
          saveForLater: saveCard,
        };

        // Enregistrer la carte si demandé
        if (saveCard) {
          await paymentService.savePaymentMethod(cardDetails, savedCards.length === 0);
        }

        const result = await paymentService.processCardPayment(
          cardDetails,
          invoice.amount,
          invoice.orderId,
        );
        transactionId = result.transactionId;
      }

      // Marquer la facture comme payée
      await invoiceService.markInvoiceAsPaid(invoice.id, `CARD:${transactionId}`);

      Alert.alert(
        'Paiement effectue',
        `Facture #${invoice.id} payee avec succes.\nTransaction : ${transactionId}`,
        [{ text: 'OK', onPress: () => { onClose(); onPaid(); } }],
      );
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message ?? 'Paiement refuse ou erreur reseau';
      Alert.alert('Erreur de paiement', msg);
    } finally {
      setProcessing(false);
    }
  };

  // ── Paiement par avance ──
  const handleAdvancePayment = async () => {
    if (!invoice) return;
    if (advanceBalance < invoice.amount) {
      Alert.alert('Solde insuffisant', `Votre solde (${advanceBalance.toFixed(2)} DH) est insuffisant pour cette facture (${invoice.amount.toFixed(2)} DH).`);
      return;
    }
    setProcessing(true);
    try {
      await creditPaymentService.payInvoice(invoice.id, invoice.amount, 'ADVANCE');
      Alert.alert(
        'Paiement effectue',
        `Facture #${invoice.id} payee depuis votre solde avance.`,
        [{ text: 'OK', onPress: () => { onClose(); onPaid(); } }],
      );
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message ?? 'Erreur lors du paiement';
      Alert.alert('Erreur', msg);
    } finally {
      setProcessing(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Payer la facture #{invoice.id}</Text>
              <Text style={styles.headerAmount}>{invoice.amount.toFixed(2)} DH</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={processing}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* ── Choix mode ── */}
            {mode === 'choose' && (
              <View>
                <Text style={styles.sectionTitle}>Choisissez un mode de paiement</Text>

                {/* Carte bancaire */}
                <TouchableOpacity style={styles.methodCard} onPress={() => setMode('card')}>
                  <View style={[styles.methodIcon, { backgroundColor: '#e3f2fd' }]}>
                    <Ionicons name="card-outline" size={28} color="#1565c0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Carte bancaire</Text>
                    <Text style={styles.methodSub}>Visa, Mastercard, CMI</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                {/* Solde avance */}
                <TouchableOpacity
                  style={[styles.methodCard, advanceBalance <= 0 && styles.methodDisabled]}
                  onPress={() => advanceBalance > 0 && setMode('advance')}
                  disabled={loadingAdvance}
                >
                  <View style={[styles.methodIcon, { backgroundColor: '#e8f5e9' }]}>
                    <Ionicons name="wallet-outline" size={28} color="#2e7d32" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Solde avance</Text>
                    {loadingAdvance ? (
                      <ActivityIndicator size="small" color="#999" />
                    ) : (
                      <Text style={styles.methodSub}>
                        {advanceBalance > 0
                          ? `Disponible : ${advanceBalance.toFixed(2)} DH`
                          : 'Aucun solde disponible'}
                      </Text>
                    )}
                  </View>
                  {advanceBalance > 0 && <Ionicons name="chevron-forward" size={20} color="#999" />}
                </TouchableOpacity>
              </View>
            )}

            {/* ── Paiement par carte ── */}
            {mode === 'card' && (
              <View>
                <TouchableOpacity style={styles.backRow} onPress={() => { setMode('choose'); setSelectedCardId(null); }}>
                  <Ionicons name="arrow-back" size={18} color="#1565c0" />
                  <Text style={styles.backText}>Changer de mode</Text>
                </TouchableOpacity>

                {/* Cartes enregistrées */}
                {savedCards.length > 0 && (
                  <View style={styles.savedCardsSection}>
                    <Text style={styles.sectionTitle}>Cartes enregistrees</Text>
                    {savedCards.map(card => (
                      <TouchableOpacity
                        key={card.id}
                        style={[
                          styles.savedCard,
                          selectedCardId === card.id && styles.savedCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedCardId(selectedCardId === card.id ? null : card.id);
                        }}
                      >
                        <Ionicons
                          name="card"
                          size={24}
                          color={selectedCardId === card.id ? '#1565c0' : '#999'}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.savedCardNumber}>
                            **** **** **** {card.lastFourDigits}
                          </Text>
                          <Text style={styles.savedCardExpiry}>
                            {card.cardholderName} - {card.expiryMonth}/{card.expiryYear}
                          </Text>
                        </View>
                        {selectedCardId === card.id && (
                          <Ionicons name="checkmark-circle" size={22} color="#1565c0" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Nouvelle carte (masquée si carte enregistrée sélectionnée) */}
                {!selectedCardId && (
                  <View>
                    <Text style={styles.sectionTitle}>
                      {savedCards.length > 0 ? 'Ou utilisez une nouvelle carte' : 'Informations de la carte'}
                    </Text>

                    <Text style={styles.fieldLabel}>Numero de carte</Text>
                    <TextInput
                      style={styles.input}
                      value={cardNumber}
                      onChangeText={t => setCardNumber(formatCardNumber(t))}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor="#bbb"
                      keyboardType="number-pad"
                      maxLength={19}
                    />

                    <Text style={styles.fieldLabel}>Titulaire de la carte</Text>
                    <TextInput
                      style={styles.input}
                      value={cardHolder}
                      onChangeText={setCardHolder}
                      placeholder="NOM PRENOM"
                      placeholderTextColor="#bbb"
                      autoCapitalize="characters"
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Expiration</Text>
                        <TextInput
                          style={styles.input}
                          value={expiry}
                          onChangeText={t => setExpiry(formatExpiry(t))}
                          placeholder="MM/AA"
                          placeholderTextColor="#bbb"
                          keyboardType="number-pad"
                          maxLength={5}
                        />
                      </View>
                      <View style={{ width: 14 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>CVV</Text>
                        <TextInput
                          style={styles.input}
                          value={cvv}
                          onChangeText={t => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          placeholderTextColor="#bbb"
                          keyboardType="number-pad"
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                    </View>

                    {/* Enregistrer la carte */}
                    <TouchableOpacity
                      style={styles.saveCardRow}
                      onPress={() => setSaveCard(!saveCard)}
                    >
                      <Ionicons
                        name={saveCard ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={saveCard ? '#1565c0' : '#999'}
                      />
                      <Text style={styles.saveCardText}>
                        Enregistrer cette carte pour les prochains paiements
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Bouton payer */}
                <TouchableOpacity
                  style={[
                    styles.payBtn,
                    (!selectedCardId && !isCardValid()) && styles.payBtnDisabled,
                  ]}
                  onPress={handleCardPayment}
                  disabled={processing || (!selectedCardId && !isCardValid())}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={18} color="#fff" />
                      <Text style={styles.payBtnText}>
                        Payer {invoice.amount.toFixed(2)} DH
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.secureRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#999" />
                  <Text style={styles.secureText}>Paiement securise et chiffre</Text>
                </View>
              </View>
            )}

            {/* ── Paiement par avance ── */}
            {mode === 'advance' && (
              <View>
                <TouchableOpacity style={styles.backRow} onPress={() => setMode('choose')}>
                  <Ionicons name="arrow-back" size={18} color="#1565c0" />
                  <Text style={styles.backText}>Changer de mode</Text>
                </TouchableOpacity>

                <View style={styles.advanceSummary}>
                  <Text style={styles.advanceLabel}>Solde disponible</Text>
                  <Text style={styles.advanceValue}>{advanceBalance.toFixed(2)} DH</Text>
                </View>

                <View style={styles.advanceDetail}>
                  <View style={styles.advanceDetailRow}>
                    <Text style={styles.advanceDetailLabel}>Montant facture</Text>
                    <Text style={styles.advanceDetailValue}>{invoice.amount.toFixed(2)} DH</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.advanceDetailRow}>
                    <Text style={styles.advanceDetailLabel}>Solde apres paiement</Text>
                    <Text style={[
                      styles.advanceDetailValue,
                      { color: advanceBalance >= invoice.amount ? '#2e7d32' : '#e53935' },
                    ]}>
                      {(advanceBalance - invoice.amount).toFixed(2)} DH
                    </Text>
                  </View>
                </View>

                {advanceBalance < invoice.amount && (
                  <View style={styles.warningBox}>
                    <Ionicons name="warning-outline" size={18} color="#e65100" />
                    <Text style={styles.warningText}>
                      Solde insuffisant. Il vous manque {(invoice.amount - advanceBalance).toFixed(2)} DH.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.payBtn,
                    { backgroundColor: '#2e7d32' },
                    advanceBalance < invoice.amount && styles.payBtnDisabled,
                  ]}
                  onPress={handleAdvancePayment}
                  disabled={processing || advanceBalance < invoice.amount}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="wallet" size={18} color="#fff" />
                      <Text style={styles.payBtnText}>
                        Payer {invoice.amount.toFixed(2)} DH avec mon solde
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  headerAmount: { fontSize: 22, fontWeight: '900', color: '#1565c0', marginTop: 2 },
  closeBtn: { padding: 6 },

  body: { padding: 20, paddingBottom: 40 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 12 },

  // Choix mode
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 12,
  },
  methodDisabled: { opacity: 0.45 },
  methodIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  methodTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  methodSub: { fontSize: 12, color: '#888', marginTop: 2 },

  // Back
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backText: { fontSize: 14, color: '#1565c0', fontWeight: '600' },

  // Cartes enregistrées
  savedCardsSection: { marginBottom: 20 },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  savedCardSelected: { borderColor: '#1565c0', backgroundColor: '#e3f2fd' },
  savedCardNumber: { fontSize: 14, fontWeight: '700', color: '#333', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  savedCardExpiry: { fontSize: 12, color: '#888', marginTop: 2 },

  // Formulaire carte
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  row: { flexDirection: 'row' },

  saveCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 4,
  },
  saveCardText: { fontSize: 13, color: '#555', flex: 1 },

  // Bouton payer
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1565c0',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  secureText: { fontSize: 12, color: '#999' },

  // Avance
  advanceSummary: {
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  advanceLabel: { fontSize: 13, fontWeight: '600', color: '#2e7d32' },
  advanceValue: { fontSize: 28, fontWeight: '900', color: '#1b5e20', marginTop: 4 },

  advanceDetail: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  advanceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  advanceDetailLabel: { fontSize: 13, color: '#666' },
  advanceDetailValue: { fontSize: 14, fontWeight: '700', color: '#333' },
  divider: { height: 1, backgroundColor: '#e0e0e0' },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 12,
  },
  warningText: { fontSize: 13, color: '#e65100', flex: 1 },
});
