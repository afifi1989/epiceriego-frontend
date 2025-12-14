import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { Promotion, UpdatePromotionRequest, promotionService } from '../../src/services/promotionService';

export default function ModifierPromoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ promoId: string }>();
  const promoId = params.promoId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [reductionPercentage, setReductionPercentage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | null>(null);
  const [dateFin, setDateFin] = useState<Date | null>(null);
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);

  useEffect(() => {
    console.log('[ModifierPromoScreen] Component mounted - params:', params);
    console.log('[ModifierPromoScreen] promoId extracted:', promoId);
    loadPromotion();
  }, [promoId]);

  const loadPromotion = async () => {
    console.log('[ModifierPromoScreen] loadPromotion called, promoId:', promoId);
    if (!promoId) {
      console.log('[ModifierPromoScreen] ⚠️ promoId is null/undefined, returning');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      console.log('[ModifierPromoScreen] Chargement de la promotion:', promoId);

      // Récupérer les données de la promotion depuis le backend
      const promotion = await promotionService.getPromotionById(parseInt(promoId));
      console.log('[ModifierPromoScreen] Promotion chargée:', promotion);

      // Populer l'état du formulaire avec les données récupérées
      setPromo(promotion);
      setTitre(promotion.titre);
      setDescription(promotion.description || '');
      setReductionPercentage(promotion.reductionPercentage.toString());
      setImageUrl(promotion.imageUrl || '');

      // Convertir les dates ISO strings en objets Date
      setDateDebut(new Date(promotion.dateDebut));
      setDateFin(new Date(promotion.dateFin));

      console.log('[ModifierPromoScreen] Formulaire populé avec succès');
      setLoading(false);
    } catch (error: any) {
      console.error('[ModifierPromoScreen] Erreur lors du chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger la promotion');
      router.back();
    }
  };

  const handleUpdatePromotion = async () => {
    if (!promoId || !promo) return;

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
      setSaving(true);
      const updateData: UpdatePromotionRequest = {
        titre: titre.trim(),
        description: description.trim() || undefined,
        reductionPercentage: parseFloat(reductionPercentage),
        imageUrl: imageUrl.trim() || undefined,
        dateDebut: dateDebut.toISOString(),
        dateFin: dateFin.toISOString(),
      };

      await promotionService.updatePromotion(parseInt(promoId), updateData);
      Alert.alert('Succès', 'Promotion mise à jour avec succès');
      router.back();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la promotion');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

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

        {/* Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.updateButton, saving && styles.buttonDisabled]}
            onPress={handleUpdatePromotion}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.updateButtonText}>Mettre à jour</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  updateButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
