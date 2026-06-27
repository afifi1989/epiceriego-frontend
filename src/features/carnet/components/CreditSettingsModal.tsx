import { Colors } from '../../../constants/colors';
/**
 * CreditSettingsModal — Modal pour configurer le crédit d'un client
 */

import React, { useState, useEffect } from 'react';
import { Alert, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { clientManagementService } from '../../../services/clientManagementService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  epicerieId: number;
  clientId: number;
  clientName: string;
  currentAllowCredit: boolean;
  currentCreditLimit: number;
}

export function CreditSettingsModal({
  visible, onClose, onSuccess,
  epicerieId, clientId, clientName,
  currentAllowCredit, currentCreditLimit,
}: Props) {
  const [allowCredit, setAllowCredit] = useState(currentAllowCredit);
  const [creditLimit, setCreditLimit] = useState(currentCreditLimit > 0 ? currentCreditLimit.toString() : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAllowCredit(currentAllowCredit);
      setCreditLimit(currentCreditLimit > 0 ? currentCreditLimit.toString() : '');
    }
  }, [visible, currentAllowCredit, currentCreditLimit]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const limit = creditLimit ? parseFloat(creditLimit.replace(',', '.')) : undefined;
      await clientManagementService.updateClientCredit(epicerieId, clientId, allowCredit, limit);
      Alert.alert('Crédit mis à jour', `Paramètres de crédit modifiés pour ${clientName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Paramètres crédit</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.clientRow}>
            <Ionicons name="person" size={18} color={Colors.primary} />
            <Text style={styles.clientName}>{clientName}</Text>
          </View>

          {/* Toggle crédit */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Autoriser le crédit</Text>
              <Text style={styles.switchHint}>Le client pourra payer avec son compte</Text>
            </View>
            <Switch
              value={allowCredit}
              onValueChange={setAllowCredit}
              trackColor={{ false: '#ccc', true: '#81C784' }}
              thumbColor={allowCredit ? '#388E3C' : '#f4f3f4'}
            />
          </View>

          {!allowCredit && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color="#e65100" />
              <Text style={styles.warningText}>
                Le client ne pourra plus payer par compte. Les factures existantes restent dues.
              </Text>
            </View>
          )}

          {allowCredit && (
            <>
              <Text style={styles.fieldLabel}>Limite de crédit (DH)</Text>
              <TextInput
                style={styles.input}
                value={creditLimit}
                onChangeText={setCreditLimit}
                keyboardType="decimal-pad"
                placeholder="Laisser vide = illimité"
                placeholderTextColor="#bbb"
              />
              {!creditLimit && (
                <View style={styles.unlimitedBox}>
                  <Text style={styles.unlimitedText}>Crédit illimité — pas de plafond</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="save" size={20} color="#fff" />
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
  body: { padding: 16, gap: 14 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#333' },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  switchHint: { fontSize: 12, color: '#888', marginTop: 2 },
  warningBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fff3e0', borderRadius: 10, padding: 12, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 13, color: '#e65100', lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', padding: 14, fontSize: 16, color: '#333' },
  unlimitedBox: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12 },
  unlimitedText: { fontSize: 13, fontWeight: '600', color: '#388E3C' },
  footer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 'auto' },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  submitBtn: { flex: 2, flexDirection: 'row', padding: 14, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
