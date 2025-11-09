import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { epicerieService } from '../../src/services/epicerieService';
import { ProfilePhotoUpload } from '../../components/epicier/ProfilePhotoUpload';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ModifierInfosScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nomEpicerie: '',
    description: '',
    adresse: '',
    latitude: '',
    longitude: '',
    telephonePro: '',
    telephonePersonnel: '',
    photoUrl: '',
    nomGerant: '',
    prenomGerant: '',
    emailGerant: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await epicerieService.getMyEpicerie();
      
      setEpicerieId(data.id);
      setFormData({
        nomEpicerie: data.nomEpicerie || '',
        description: data.description || '',
        adresse: data.adresse || '',
        latitude: data.latitude?.toString() || '',
        longitude: data.longitude?.toString() || '',
        telephonePro: data.telephonePro || data.telephone || '',
        telephonePersonnel: data.telephonePersonnel || '',
        photoUrl: data.photoUrl || '',
        nomGerant: data.nomGerant || '',
        prenomGerant: data.prenomGerant || '',
        emailGerant: data.emailGerant || '',
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelected = (uri: string, base64?: string) => {
    console.log('[ModifierInfos] Photo sélectionnée');
    setSelectedPhotoUri(uri);
    setSelectedPhotoBase64(base64 || undefined);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.nomEpicerie.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'épicerie est requis');
      return;
    }
    if (!formData.adresse.trim()) {
      Alert.alert('Erreur', 'L\'adresse est requise');
      return;
    }

    // Validation latitude/longitude si fournies
    if (formData.latitude && isNaN(Number(formData.latitude))) {
      Alert.alert('Erreur', 'La latitude doit être un nombre valide');
      return;
    }
    if (formData.longitude && isNaN(Number(formData.longitude))) {
      Alert.alert('Erreur', 'La longitude doit être un nombre valide');
      return;
    }

    try {
      setSaving(true);

      // D'abord, uploader la photo si une nouvelle a été sélectionnée
      if (selectedPhotoUri) {
        try {
          setUploading(true);
          console.log('[ModifierInfos] Upload de la photo...');
          await epicerieService.uploadProfilePhoto(selectedPhotoUri, selectedPhotoBase64);
          setSelectedPhotoUri(null);
          setSelectedPhotoBase64(null);
        } catch (uploadError) {
          Alert.alert('Erreur', `Erreur upload photo: ${uploadError}`);
          setUploading(false);
          setSaving(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      // Ensuite, mettre à jour les autres informations
      const updateData: any = {
        nomEpicerie: formData.nomEpicerie,
        description: formData.description,
        adresse: formData.adresse,
        telephonePro: formData.telephonePro,
        telephonePersonnel: formData.telephonePersonnel,
        nomGerant: formData.nomGerant,
        prenomGerant: formData.prenomGerant,
        emailGerant: formData.emailGerant,
      };

      if (formData.latitude) {
        updateData.latitude = Number(formData.latitude);
      }
      if (formData.longitude) {
        updateData.longitude = Number(formData.longitude);
      }

      await epicerieService.updateMyEpicerie(updateData);
      Alert.alert('✅ Succès', 'Les informations ont été mises à jour', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {/* Section Photo de Profil */}
          <ProfilePhotoUpload
            photoUrl={formData.photoUrl}
            onPhotoSelected={handlePhotoSelected}
            uploading={uploading}
          />

          <Text style={styles.sectionTitle}>Informations de l'épicerie</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Nom de l'épicerie <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.nomEpicerie}
              onChangeText={(text) => setFormData({ ...formData, nomEpicerie: text })}
              placeholder="Ex: Épicerie du Centre"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Une belle épicerie au cœur de la ville..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Adresse <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.adresse}
              onChangeText={(text) => setFormData({ ...formData, adresse: text })}
              placeholder="123 rue de la Paix, 75000 Paris"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={formData.latitude}
                onChangeText={(text) => setFormData({ ...formData, latitude: text })}
                placeholder="48.8566"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={formData.longitude}
                onChangeText={(text) => setFormData({ ...formData, longitude: text })}
                placeholder="2.3522"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone professionnel</Text>
            <TextInput
              style={styles.input}
              value={formData.telephonePro}
              onChangeText={(text) => setFormData({ ...formData, telephonePro: text })}
              placeholder="+33123456789"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photo (URL)</Text>
            <TextInput
              style={styles.input}
              value={formData.photoUrl}
              onChangeText={(text) => setFormData({ ...formData, photoUrl: text })}
              placeholder="https://example.com/photo.jpg"
              placeholderTextColor="#999"
              keyboardType="url"
              autoCapitalize="none"
            />
            {formData.photoUrl && (
              <Text style={styles.hint}>
                💡 L'image sera affichée aux clients
              </Text>
            )}
          </View>

          <Text style={[styles.sectionTitle, styles.sectionTitleMargin]}>
            Informations du gérant
          </Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={formData.prenomGerant}
                onChangeText={(text) => setFormData({ ...formData, prenomGerant: text })}
                placeholder="Jean"
                placeholderTextColor="#999"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                value={formData.nomGerant}
                onChangeText={(text) => setFormData({ ...formData, nomGerant: text })}
                placeholder="Dupont"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={formData.emailGerant}
              onChangeText={(text) => setFormData({ ...formData, emailGerant: text })}
              placeholder="jean.dupont@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone personnel</Text>
            <TextInput
              style={styles.input}
              value={formData.telephonePersonnel}
              onChangeText={(text) => setFormData({ ...formData, telephonePersonnel: text })}
              placeholder="+33698765432"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.requiredNote}>
            <Text style={styles.requiredNoteText}>
              <Text style={styles.required}>*</Text> Champs obligatoires
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>💾 Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 15,
  },
  sectionTitleMargin: {
    marginTop: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  requiredNote: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  requiredNoteText: {
    fontSize: 14,
    color: '#856404',
  },
  footer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
