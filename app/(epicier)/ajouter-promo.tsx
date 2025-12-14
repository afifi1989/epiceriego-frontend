import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { CreatePromotionRequest, promotionService } from '../../src/services/promotionService';

export default function AjouterPromoScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [reductionPercentage, setReductionPercentage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | null>(null);
  const [dateFin, setDateFin] = useState<Date | null>(null);
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);

  const handleCreatePromotion = async () => {
    // Validation
    if (!titre.trim()) {
      Alert.alert('Erreur', 'Le titre de la promotion est obligatoire');
      return;
    }
    if (!reductionPercentage || parseFloat(reductionPercentage) <= 0 || parseFloat(reductionPercentage) > 100) {
      Alert.alert('Erreur', 'Veuillez entrer un pourcentage entre 1 et 100');
      return;
    }
    if (!dateDebut) {
      Alert.alert('Erreur', 'La date de début est obligatoire');
      return;
    }
    if (!dateFin) {
      Alert.alert('Erreur', 'La date de fin est obligatoire');
      return;
    }
    if (dateFin <= dateDebut) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début');
      return;
    }

    try {
      setLoading(true);
      const promoData: CreatePromotionRequest = {
        titre: titre.trim(),
        description: description.trim() || undefined,
        reductionPercentage: parseFloat(reductionPercentage),
        imageUrl: imageUrl.trim() || undefined,
        dateDebut: dateDebut.toISOString(),
        dateFin: dateFin.toISOString(),
      };

      await promotionService.createPromotion(promoData);
      Alert.alert('Succès', 'Promotion créée avec succès');
      router.back();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de créer la promotion');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Sélectionner une date';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {/* Titre */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Titre de la promotion *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 20% de réduction sur les fruits"
            placeholderTextColor="#999"
            value={titre}
            onChangeText={setTitre}
            maxLength={255}
          />
          <Text style={styles.characterCount}>
            {titre.length}/255
          </Text>
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Détails supplémentaires sur la promotion..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {description.length}/500
          </Text>
        </View>

        {/* Réduction Pourcentage */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Pourcentage de réduction (%) *</Text>
          <View style={styles.percentageContainer}>
            <TextInput
              style={[styles.input, styles.percentageInput]}
              placeholder="Ex: 20"
              placeholderTextColor="#999"
              value={reductionPercentage}
              onChangeText={setReductionPercentage}
              keyboardType="decimal-pad"
              maxLength={5}
            />
            <Text style={styles.percentageLabel}>%</Text>
          </View>
          <Text style={styles.hint}>Entrez une valeur entre 1 et 100</Text>
        </View>

        {/* URL Image */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>URL de l'image (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor="#999"
            value={imageUrl}
            onChangeText={setImageUrl}
            multiline
          />
          <Text style={styles.hint}>Lien complet vers une image (HTTPS)</Text>
        </View>

        {/* Dates */}
        <View style={styles.datesContainer}>
          <View style={[styles.formGroup, styles.dateFormGroup]}>
            <Text style={styles.label}>Date de début *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDateDebut(true)}
            >
              <Text style={styles.dateButtonText}>
                📅 {formatDate(dateDebut)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.formGroup, styles.dateFormGroup]}>
            <Text style={styles.label}>Date de fin *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDateFin(true)}
            >
              <Text style={styles.dateButtonText}>
                📅 {formatDate(dateFin)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <DateTimePickerModal
          isVisible={showDateDebut}
          mode="datetime"
          onConfirm={(date) => {
            setDateDebut(date);
            setShowDateDebut(false);
          }}
          onCancel={() => setShowDateDebut(false)}
          locale="fr_FR"
        />

        <DateTimePickerModal
          isVisible={showDateFin}
          mode="datetime"
          onConfirm={(date) => {
            setDateFin(date);
            setShowDateFin(false);
          }}
          onCancel={() => setShowDateFin(false)}
          locale="fr_FR"
          minimumDate={dateDebut || new Date()}
        />

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Conseils</Text>
          <Text style={styles.infoText}>
            • Utilisez un titre attrayant pour vos clients{'\n'}
            • Les promotions deviennent actives automatiquement à la date de début{'\n'}
            • Vous pouvez désactiver une promotion à tout moment
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreatePromotion}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Créer la Promotion</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 20,
    paddingBottom: 40,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageInput: {
    flex: 1,
    marginRight: 10,
  },
  percentageLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    fontStyle: 'italic',
  },
  datesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateFormGroup: {
    flex: 1,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 18,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  createButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
