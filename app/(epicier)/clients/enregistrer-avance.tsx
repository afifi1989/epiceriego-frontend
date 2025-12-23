import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSizes } from '../../../src/constants/colors';
import { useLanguage } from '../../../src/context/LanguageContext';
import { clientManagementService } from '../../../src/services/clientManagementService';
import { creditPaymentService } from '../../../src/services/creditPaymentService';
import { ClientEpicerieRelation } from '../../../src/type';

export default function EnregistrerAvanceScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams();
  const clientId = parseInt(id as string);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientEpicerieRelation | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  /**
   * Get epicerie ID from storage
   */
  useEffect(() => {
    const getEpicerieId = async () => {
      const user = await AsyncStorage.getItem('@epiceriego_user');
      if (user) {
        const userData = JSON.parse(user);
        if (userData.epicerieId) {
          setEpicerieId(userData.epicerieId);
        }
      }
    };
    getEpicerieId();
  }, []);

  /**
   * Load client details
   */
  useEffect(() => {
    if (epicerieId && clientId) {
      loadClientDetails();
    }
  }, [epicerieId, clientId]);

  /**
   * Load client details
   */
  const loadClientDetails = async () => {
    if (!epicerieId) return;

    try {
      setLoading(true);

      const clientData = await clientManagementService.getClientDetails(
        epicerieId,
        clientId
      );
      setClientDetails(clientData);
    } catch (error) {
      console.error('Error loading client details:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du client');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validate and save advance payment
   */
  const handleSaveAdvance = async () => {
    if (!epicerieId || !clientDetails) return;

    // Validation
    const amountValue = parseFloat(amount);
    if (!amount.trim() || isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }

    try {
      setSaving(true);

      await creditPaymentService.recordAdvancePayment(
        epicerieId,
        clientId,
        amountValue,
        'CASH',
        notes.trim() || undefined
      );

      Alert.alert(
        'Succès',
        `Avance de ${amountValue.toFixed(2)} DH enregistrée avec succès`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving advance:', error);
      Alert.alert(
        'Erreur',
        error.message || "Impossible d'enregistrer l'avance"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!clientDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erreur: Client non trouvé</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Enregistrer une avance</Text>
          <Text style={styles.clientName}>{clientDetails.clientNom}</Text>
          <Text style={styles.clientEmail}>{clientDetails.clientEmail}</Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoEmoji}>💰</Text>
          <Text style={styles.infoTitle}>Qu'est-ce qu'une avance ?</Text>
          <Text style={styles.infoText}>
            Une avance est un paiement anticipé effectué par le client. Ce
            montant sera automatiquement déduit de ses prochaines factures.
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Montant de l'avance <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputWithSuffix}>
              <TextInput
                style={styles.input}
                placeholder="Ex: 500"
                placeholderTextColor="#999"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                editable={!saving}
              />
              <Text style={styles.suffix}>DH</Text>
            </View>
            {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
              <Text style={styles.inputHint}>
                💵 Le client dépose {parseFloat(amount).toFixed(2)} DH en
                espèces
              </Text>
            )}
          </View>

          {/* Payment Method (Fixed to CASH for now) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mode de paiement</Text>
            <View style={styles.paymentMethodBox}>
              <View style={styles.paymentMethodIcon}>
                <Text style={styles.paymentMethodEmoji}>💵</Text>
              </View>
              <View style={styles.paymentMethodInfo}>
                <Text style={styles.paymentMethodName}>Espèces (CASH)</Text>
                <Text style={styles.paymentMethodDescription}>
                  Paiement en argent liquide
                </Text>
              </View>
            </View>
          </View>

          {/* Notes Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ex: Avance pour commandes de janvier"
              placeholderTextColor="#999"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!saving}
            />
          </View>

          {/* Preview */}
          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>📋 Récapitulatif</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Client:</Text>
                <Text style={styles.previewValue}>
                  {clientDetails.clientNom}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Montant:</Text>
                <Text style={[styles.previewValue, styles.amountValue]}>
                  {parseFloat(amount).toFixed(2)} DH
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Mode:</Text>
                <Text style={styles.previewValue}>Espèces</Text>
              </View>
              {notes.trim() && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Notes:</Text>
                  <Text style={styles.previewValue}>{notes}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsSection}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (saving || !amount || parseFloat(amount) <= 0) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleSaveAdvance}
            disabled={saving || !amount || parseFloat(amount) <= 0}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                Enregistrer l'avance
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 20,
  },
  errorText: {
    fontSize: FontSizes.base,
    color: Colors.text,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  headerSection: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  clientName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  infoBox: {
    margin: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: FontSizes.sm,
    color: '#1565C0',
    lineHeight: 20,
  },
  formSection: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: FontSizes.base,
    color: Colors.text,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  suffix: {
    paddingHorizontal: 16,
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: '#f0f0f0',
    height: '100%',
    paddingTop: 14,
  },
  inputHint: {
    fontSize: FontSizes.xs,
    color: '#4CAF50',
    marginTop: 6,
    fontWeight: '500',
  },
  paymentMethodBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 12,
  },
  paymentMethodIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodEmoji: {
    fontSize: 24,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  previewBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  previewTitle: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: FontSizes.sm,
    color: '#558B2F',
    fontWeight: '500',
    flex: 0.4,
  },
  previewValue: {
    fontSize: FontSizes.sm,
    color: '#2E7D32',
    fontWeight: '600',
    flex: 0.6,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: FontSizes.lg,
    color: '#4CAF50',
  },
  buttonsSection: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 30,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#bbb',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FontSizes.base,
    fontWeight: 'bold',
  },
});
