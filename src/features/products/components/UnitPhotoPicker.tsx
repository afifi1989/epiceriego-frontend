import { Colors } from '../../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { unitService } from '../../../services/unitService';

interface UnitPhotoPickerProps {
  productId: number;
  unitId: number;
  photoUrl?: string | null;
  onChanged: (newPhotoUrl: string | null) => void;
}

/**
 * Per-variant photo upload widget. Shown inside the variant edit form once the
 * variant exists (we need an `unitId` for the dedicated media endpoint). When
 * `photoUrl` is null, the client UI falls back to the product's main photo —
 * the hint text below the "Add" button makes that explicit so the épicier
 * knows nothing is broken.
 */
export const UnitPhotoPicker: React.FC<UnitPhotoPickerProps> = ({
  productId, unitId, photoUrl, onChanged
}) => {
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);

  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'accès aux photos pour continuer.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setBusy('upload');
    try {
      const { photoUrl: newUrl } = await unitService.setUnitPhoto(
        productId, unitId, result.assets[0].uri
      );
      onChanged(newUrl);
    } catch (err: any) {
      Alert.alert('Échec', err?.message || 'Impossible d\'envoyer la photo');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer la photo ?',
      'La variante reprendra la photo du produit.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await unitService.clearUnitPhoto(productId, unitId);
              onChanged(null);
            } catch (err: any) {
              Alert.alert('Échec', err?.response?.data?.message || 'Impossible de supprimer');
            } finally {
              setBusy(null);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photo de cette variante</Text>

      {photoUrl ? (
        <View style={styles.row}>
          <Image source={{ uri: photoUrl }} style={styles.thumb} />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, busy && styles.btnDisabled]}
              onPress={pickAndUpload}
              disabled={!!busy}
            >
              {busy === 'upload'
                ? <ActivityIndicator size="small" color="#1565c0" />
                : <><Ionicons name="image-outline" size={16} color="#1565c0" />
                    <Text style={styles.btnSecondaryText}>Changer</Text></>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger, busy && styles.btnDisabled]}
              onPress={confirmDelete}
              disabled={!!busy}
            >
              {busy === 'delete'
                ? <ActivityIndicator size="small" color="#c62828" />
                : <><Ionicons name="trash-outline" size={16} color="#c62828" />
                    <Text style={styles.btnDangerText}>Supprimer</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.addBtn, busy && styles.btnDisabled]}
            onPress={pickAndUpload}
            disabled={!!busy}
          >
            {busy === 'upload'
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>Ajouter une photo</Text></>}
          </TouchableOpacity>
          <Text style={styles.fallbackHint}>
            Sans photo dédiée, la photo du produit sera utilisée.
          </Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 72, height: 72, borderRadius: 10,
    backgroundColor: '#eee', borderWidth: 1, borderColor: '#ddd'
  },
  actions: { flex: 1, gap: 6 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1
  },
  btnSecondary: { borderColor: '#90caf9', backgroundColor: '#e3f2fd' },
  btnSecondaryText: { color: '#1565c0', fontWeight: '600', fontSize: 13 },
  btnDanger: { borderColor: '#ef9a9a', backgroundColor: '#ffebee' },
  btnDangerText: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, paddingVertical: 11, borderRadius: 10
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fallbackHint: { fontSize: 11, color: '#999', marginTop: 6, fontStyle: 'italic' }
});
