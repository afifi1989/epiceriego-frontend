/**
 * QuickAdvanceModal — Modal pour enregistrer une avance client
 */

import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { creditPaymentService } from '../../../services/creditPaymentService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  epicerieId: number;
  clientId: number;
  clientName: string;
}

export function QuickAdvanceModal({ visible, onClose, onSuccess, epicerieId, clientId, clientName }: Props) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount.replace(',', '.')) || 0;

  const handleSubmit = async () => {
    if (amountNum <= 0) {
      Alert.alert('Erreur', 'Entrez un montant valide');
      return;
    }
    setSaving(true);
    try {
      await creditPaymentService.recordAdvancePayment(epicerieId, clientId, amountNum, 'CASH', notes.trim());
      Alert.alert('Avance enregistrée', `${amountNum.toFixed(2)} DH de ${clientName}`);
      setAmount('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message || err.message || 'Impossible d\'enregistrer l\'avance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Enregistrer une avance</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={18} color="#1565C0" />
            <Text style={styles.infoText}>
              Une avance est un dépôt que le client fait à l'avance. Elle réduit son solde dû.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Montant de l'avance (DH)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            autoFocus
          />

          <Text style={styles.fieldLabel}>Notes (optionnel)</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: Avance mensuelle avril"
            multiline
            numberOfLines={3}
          />

          {amountNum > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>Récapitulatif</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Client</Text>
                <Text style={styles.previewValue}>{clientName}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Montant</Text>
                <Text style={[styles.previewValue, { color: '#388E3C', fontWeight: '800' }]}>{amountNum.toFixed(2)} DH</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Mode</Text>
                <Text style={styles.previewValue}>Espèces</Text>
              </View>
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
            <Ionicons name="wallet" size={20} color="#fff" />
            <Text style={styles.submitText}>Enregistrer</Text>
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
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#e3f2fd', borderRadius: 10, padding: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', padding: 14, fontSize: 16, color: '#333' },
  preview: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 14, gap: 6 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 4 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { fontSize: 13, color: '#555' },
  previewValue: { fontSize: 13, fontWeight: '600', color: '#333' },
  footer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 'auto' },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  submitBtn: { flex: 2, flexDirection: 'row', padding: 14, borderRadius: 10, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
