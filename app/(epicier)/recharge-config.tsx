import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import telecomRechargeService from '@/src/services/telecomRechargeService';
import { TelecomRechargeConfig } from '@/src/type';

/**
 * Écran de configuration du service de recharge (Épicier)
 * Route: /(epicier)/recharge-config
 */
export default function RechargeConfigScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TelecomRechargeConfig>({
    epicerieId: 0,
    enabled: false,
    commissionPercentage: 0,
    autoApproval: true,
    maxAmountPerDay: undefined
  });

  // Recharger la configuration à chaque fois que l'écran devient actif
  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, [])
  );

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await telecomRechargeService.getConfig();
      setConfig(data);
    } catch (error) {
      console.error('Error loading config:', error);
      Alert.alert('Erreur', 'Impossible de charger la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validation
      if (config.commissionPercentage < 0 || config.commissionPercentage > 100) {
        Alert.alert('Erreur', 'La commission doit être entre 0% et 100%');
        return;
      }

      if (config.maxAmountPerDay && config.maxAmountPerDay <= 0) {
        Alert.alert('Erreur', 'Le plafond journalier doit être supérieur à 0');
        return;
      }

      setSaving(true);
      const updated = await telecomRechargeService.updateConfig(config);
      setConfig(updated);
      Alert.alert('Succès', 'Configuration enregistrée avec succès');
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Ionicons name="settings-outline" size={40} color="#2196F3" />
        <Text style={styles.headerTitle}>Configuration Recharges</Text>
        <Text style={styles.headerSubtitle}>
          Gérez les paramètres du service de recharge téléphonique
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Activer le service</Text>
            <Text style={styles.settingDescription}>
              Proposer des recharges téléphoniques à vos clients
            </Text>
          </View>
          <Switch
            value={config.enabled}
            onValueChange={(value) => setConfig({ ...config, enabled: value })}
            trackColor={{ false: '#CCC', true: '#4CAF50' }}
            thumbColor={config.enabled ? '#FFF' : '#FFF'}
          />
        </View>

        {config.enabled && (
          <>
            <View style={styles.separator} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Validation automatique</Text>
                <Text style={styles.settingDescription}>
                  Traiter les recharges automatiquement sans validation manuelle
                </Text>
              </View>
              <Switch
                value={config.autoApproval}
                onValueChange={(value) => setConfig({ ...config, autoApproval: value })}
                trackColor={{ false: '#CCC', true: '#4CAF50' }}
                thumbColor={config.autoApproval ? '#FFF' : '#FFF'}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Commission (%)</Text>
              <Text style={styles.inputDescription}>
                Pourcentage de commission sur chaque recharge
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0.0"
                value={config.commissionPercentage?.toString() || ''}
                onChangeText={(text) => {
                  const value = parseFloat(text) || 0;
                  setConfig({ ...config, commissionPercentage: value });
                }}
                placeholderTextColor="#999"
              />
              <Text style={styles.inputHint}>
                Exemple: 5% de commission sur une recharge de 20 DH = 1 DH de bénéfice
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Plafond journalier (DH)</Text>
              <Text style={styles.inputDescription}>
                Montant maximum de recharges par jour (optionnel)
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Ex: 5000"
                value={config.maxAmountPerDay?.toString() || ''}
                onChangeText={(text) => {
                  const value = text ? parseFloat(text) : undefined;
                  setConfig({ ...config, maxAmountPerDay: value });
                }}
                placeholderTextColor="#999"
              />
              <Text style={styles.inputHint}>
                Laissez vide pour aucune limite
              </Text>
            </View>
          </>
        )}
      </View>

      {config.enabled && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#2196F3" />
            <Text style={styles.infoTitle}>Informations importantes</Text>
          </View>
          <Text style={styles.infoText}>
            • Vous devez créer des offres pour chaque opérateur
            {'\n'}• Les offres peuvent être activées/désactivées individuellement
            {'\n'}• Chaque transaction est tracée avec référence unique
            {'\n'}• Les clients peuvent suivre le statut de leur recharge
            {'\n'}• Possibilité de retry automatique en cas d'échec
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </>
        )}
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
    backgroundColor: '#FFF',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  settingInfo: {
    flex: 1,
    marginRight: 16
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12
  },
  inputSection: {
    paddingVertical: 12
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  inputDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic'
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
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2196F3',
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
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8
  }
});
