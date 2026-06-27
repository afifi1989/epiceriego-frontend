import { Colors } from '../../../constants/colors';
/**
 * QuickPaymentModal — Modal d'encaissement rapide (marquer factures comme payées)
 */

import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  epicerieId: number;
  clientId: number;
  clientName: string;
  balanceDue: number;
}

export function QuickPaymentModal({ visible, onClose, onSuccess, epicerieId, clientId, clientName, balanceDue }: Props) {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount.replace(',', '.')) || 0;

  const handleSubmit = async () => {
    if (amountNum <= 0) {
      Alert.alert('Erreur', 'Entrez un montant valide');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/epiceries/${epicerieId}/clients/${clientId}/payments/record`, {
        amount: amountNum,
        paymentMethod: 'CASH',
        reference: reference.trim() || 'Paiement en espèces',
      });
      Alert.alert('Paiement enregistré', `${amountNum.toFixed(2)} DH reçu de ${clientName}`);
      setAmount('');
      setReference('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message || err.message || 'Impossible d\'enregistrer le paiement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Encaisser</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.clientRow}>
            <Ionicons name="person" size={18} color={Colors.primary} />
            <Text style={styles.clientName}>{clientName}</Text>
          </View>

          <View style={styles.dueBox}>
            <Text style={styles.dueLabel}>Montant dû actuellement</Text>
            <Text style={styles.dueValue}>{balanceDue.toFixed(2)} DH</Text>
          </View>

          <Text style={styles.fieldLabel}>Montant reçu (DH)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            autoFocus
          />

          <Text style={styles.fieldLabel}>Référence (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={reference}
            onChangeText={setReference}
            placeholder="Ex: Paiement espèces 15/04"
          />

          {amountNum > 0 && (
            <View style={[styles.previewBox, amountNum >= balanceDue ? styles.previewBoxGreen : styles.previewBoxBlue]}>
              <Text style={styles.previewText}>
                {amountNum >= balanceDue
                  ? `Solde après paiement : 0.00 DH (excédent : ${(amountNum - balanceDue).toFixed(2)} DH)`
                  : `Reste après paiement : ${(balanceDue - amountNum).toFixed(2)} DH`
                }
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (saving || amountNum <= 0) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || amountNum <= 0}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.submitText}>Encaisser {amountNum > 0 ? `${amountNum.toFixed(2)} DH` : ''}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  body: { padding: 16, gap: 12 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#333' },
  dueBox: { backgroundColor: '#ffebee', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dueLabel: { fontSize: 13, color: '#c62828', fontWeight: '600' },
  dueValue: { fontSize: 18, fontWeight: '800', color: '#e53935' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', padding: 14, fontSize: 16, color: '#333' },
  previewBox: { borderRadius: 10, padding: 12, marginTop: 4 },
  previewBoxGreen: { backgroundColor: '#e8f5e9' },
  previewBoxBlue: { backgroundColor: '#e3f2fd' },
  previewText: { fontSize: 13, fontWeight: '600', color: '#333' },
  footer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 'auto' },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  submitBtn: { flex: 2, flexDirection: 'row', padding: 14, borderRadius: 10, backgroundColor: '#388E3C', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
