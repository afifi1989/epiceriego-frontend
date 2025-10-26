import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { epicerieService } from '../../src/services/epicerieService';
import { Epicerie } from '../../src/type';

export default function ModifierProfilScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);

  const [formData, setFormData] = useState({
    nomEpicerie: '',
    description: '',
    adresse: '',
    telephone: '',
    horaires: '',
  });

  useEffect(() => {
    loadEpicerie();
  }, []);

  const loadEpicerie = async () => {
    try {
      const data = await epicerieService.getMyEpicerie();
      setEpicerie(data);
      setFormData({
        nomEpicerie: data.nomEpicerie || '',
        description: data.description || '',
        adresse: data.adresse || '',
        telephone: data.telephone || '',
        horaires: data.horaires || '',
      });
    } catch (error) {
      console.error('Erreur chargement épicerie:', error);
      Alert.alert('Erreur', 'Impossible de charger les données de l\'épicerie');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nomEpicerie.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'épicerie est requis');
      return;
    }

    if (!formData.adresse.trim()) {
      Alert.alert('Erreur', 'L\'adresse est requise');
      return;
    }

    if (!formData.telephone.trim()) {
      Alert.alert('Erreur', 'Le téléphone est requis');
      return;
    }

    setSaving(true);
    try {
      await epicerieService.updateMyEpicerie({
        nomEpicerie: formData.nomEpicerie,
        description: formData.description,
        adresse: formData.adresse,
        telephone: formData.telephone,
        horaires: formData.horaires,
      });

      Alert.alert('Succès', 'Profil mise à jour avec succès', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Erreur mise à jour:', error);
      Alert.alert('Erreur', error || 'Impossible de mettre à jour le profil');
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <Text style={styles.headerSubtitle}>Mettez à jour les informations de votre épicerie</Text>
      </View>

      <View style={styles.formSection}>
        {/* Nom Épicerie */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom de l'épicerie *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom de votre épicerie"
            value={formData.nomEpicerie}
            onChangeText={(text) => setFormData({ ...formData, nomEpicerie: text })}
            placeholderTextColor="#999"
          />
        </View>

        {/* Adresse */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Adresse *</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Adresse de votre épicerie"
            value={formData.adresse}
            onChangeText={(text) => setFormData({ ...formData, adresse: text })}
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Téléphone */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Téléphone *</Text>
          <TextInput
            style={styles.input}
            placeholder="Numéro de téléphone"
            value={formData.telephone}
            onChangeText={(text) => setFormData({ ...formData, telephone: text })}
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Décrivez votre épicerie"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Horaires */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Horaires</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Ex: Lun-Ven: 9h-19h, Sam: 9h-18h"
            value={formData.horaires}
            onChangeText={(text) => setFormData({ ...formData, horaires: text })}
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        <Text style={styles.requiredNote}>* Champs obligatoires</Text>
      </View>

      <View style={styles.buttonContainer}>
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
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>💾 Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
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
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 15,
    paddingBottom: 25,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  formSection: {
    padding: 15,
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
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  multilineInput: {
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  requiredNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  spacer: {
    height: 20,
  },
});
