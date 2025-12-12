import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSizes } from '../../../../src/constants/colors';
import { useLanguage } from '../../../../src/context/LanguageContext';
import { clientManagementService } from '../../../../src/services/clientManagementService';
import { ClientEpicerieRelation } from '../../../../src/type';

export default function ClientCreditScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams();
  const clientId = parseInt(id as string);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientEpicerieRelation | null>(null);

  // Form state
  const [allowCredit, setAllowCredit] = useState(false);
  const [creditLimit, setCreditLimit] = useState('');

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
   * Load client details when data is available
   */
  useFocusEffect(
    useCallback(() => {
      if (epicerieId && clientId) {
        loadClientDetails();
      }
    }, [epicerieId, clientId])
  );

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

      // Initialize form
      setAllowCredit(clientData.allowCredit);
      setCreditLimit(
        clientData.creditLimit ? clientData.creditLimit.toString() : ''
      );
    } catch (error) {
      console.error('Error loading client details:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du client');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save credit settings
   */
  const handleSaveCredit = async () => {
    if (!epicerieId || !clientDetails) return;

    try {
      setSaving(true);

      const limit = creditLimit.trim()
        ? parseFloat(creditLimit)
        : undefined;

      if (creditLimit.trim() && isNaN(limit || 0)) {
        Alert.alert('Erreur', 'Limite de crédit invalide');
        setSaving(false);
        return;
      }

      await clientManagementService.updateClientCredit(
        epicerieId,
        clientId,
        allowCredit,
        limit
      );

      Alert.alert('Succès', 'Paramètres de crédit mis à jour');
      router.back();
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de mettre à jour le crédit'
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
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.clientName}>{clientDetails.clientNom}</Text>
        <Text style={styles.clientEmail}>{clientDetails.clientEmail}</Text>
      </View>

      {/* Credit Enable/Disable */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres de crédit</Text>

        <View style={styles.cardWithBorder}>
          <View style={styles.creditToggleRow}>
            <View style={styles.creditToggleInfo}>
              <Text style={styles.creditToggleLabel}>
                Autoriser le crédit
              </Text>
              <Text style={styles.creditToggleDescription}>
                Permettre à ce client de passer des commandes à crédit
              </Text>
            </View>

            <Switch
              value={allowCredit}
              onValueChange={setAllowCredit}
              trackColor={{ false: '#ccc', true: Colors.primary }}
              thumbColor={allowCredit ? Colors.primary : '#f0f0f0'}
              style={styles.switch}
            />
          </View>

          {/* Warning if credit disabled */}
          {!allowCredit && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Si vous désactivez le crédit, ce client ne pourra plus
                passer de commandes à crédit et devra payer comptant.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Credit Limit */}
      {allowCredit && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limite de crédit</Text>

          <View style={styles.card}>
            <View style={styles.limitExplanation}>
              <Text style={styles.explanationText}>
                Définissez le montant maximum que ce client peut devoir à la
                fois. Laissez vide pour un crédit illimité.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Montant limite (DH)</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 5000"
                  placeholderTextColor="#999"
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  keyboardType="decimal-pad"
                  editable={!saving}
                />
                <Text style={styles.suffix}>DH</Text>
              </View>
            </View>

            {creditLimit && !isNaN(parseFloat(creditLimit)) && (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Résumé</Text>
                <Text style={styles.previewValue}>
                  Limite: {parseFloat(creditLimit).toFixed(2)} DH
                </Text>
                <Text style={styles.previewNote}>
                  Ce client peut accumuler jusqu'à {parseFloat(creditLimit).toFixed(2)} DH de dettes
                </Text>
              </View>
            )}

            {!creditLimit.trim() && allowCredit && (
              <View style={styles.unlimitedBox}>
                <Text style={styles.unlimitedText}>
                  ♾️ Crédit illimité - Aucune limite de montant
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Info Box */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ À savoir</Text>
        <Text style={styles.infoText}>
          • Le crédit est désactivé par défaut pour chaque client
          {'\n'}
          • Vous pouvez modifier ces paramètres à tout moment
          {'\n'}
          • Les commandes passées à crédit généreront une facture
          {'\n'}
          • Vous pouvez suivre les paiements dans l'historique du client
        </Text>
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
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveCredit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  clientName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  clientEmail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 15,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardWithBorder: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  creditToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  creditToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  creditToggleLabel: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  creditToggleDescription: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 12,
  },
  warningText: {
    fontSize: FontSizes.xs,
    color: '#E65100',
    lineHeight: 16,
  },
  limitExplanation: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: 12,
    marginBottom: 16,
    borderRadius: 6,
  },
  explanationText: {
    fontSize: FontSizes.xs,
    color: '#1565C0',
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  suffix: {
    paddingHorizontal: 12,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: '#f0f0f0',
  },
  previewBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  previewLabel: {
    fontSize: FontSizes.xs,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: FontSizes.base,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  previewNote: {
    fontSize: FontSizes.xs,
    color: '#558B2F',
    lineHeight: 14,
  },
  unlimitedBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  unlimitedText: {
    fontSize: FontSizes.sm,
    color: '#2E7D32',
    fontWeight: '600',
  },
  infoSection: {
    paddingHorizontal: 15,
    paddingVertical: 16,
    backgroundColor: '#E3F2FD',
    marginHorizontal: 15,
    marginVertical: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: FontSizes.xs,
    color: '#1565C0',
    lineHeight: 18,
  },
  buttonsSection: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#bbb',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
