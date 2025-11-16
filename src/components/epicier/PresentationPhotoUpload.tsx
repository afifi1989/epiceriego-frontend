import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { epicerieService } from '../../services/epicerieService';
import { Epicerie } from '../../type';
import { FallbackImage } from '../../../components/client/FallbackImage';

interface PresentationPhotoUploadProps {
  epicerie: Epicerie | null;
  epicerieId: number;
  onPhotoUpdated: (epicerie: Epicerie) => void;
}

const { width } = Dimensions.get('window');

export const PresentationPhotoUpload: React.FC<PresentationPhotoUploadProps> = ({
  epicerie,
  epicerieId,
  onPhotoUpdated,
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner une image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la caméra');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur caméra:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à la caméra');
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      Alert.alert('Erreur', 'Veuillez sélectionner une image');
      return;
    }

    setUploading(true);
    try {
      const result = epicerie?.presentationPhotoUrl
        ? await epicerieService.updatePresentationPhoto(epicerieId, selectedImage)
        : await epicerieService.uploadPresentationPhoto(epicerieId, selectedImage);

      setSelectedImage(null);
      onPhotoUpdated(result);
      Alert.alert(
        'Succès',
        epicerie?.presentationPhotoUrl
          ? 'Photo de présentation mise à jour avec succès!'
          : 'Photo de présentation ajoutée avec succès!'
      );
    } catch (error: any) {
      console.error('Erreur upload:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'uploader la photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer la photo de présentation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setUploading(true);
            try {
              await epicerieService.deletePresentationPhoto(epicerieId);
              onPhotoUpdated({
                ...epicerie!,
                presentationPhotoUrl: undefined,
              });
              Alert.alert('Succès', 'Photo de présentation supprimée');
            } catch (error: any) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la photo');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Titre */}
      <Text style={styles.title}>📸 Photo de Présentation</Text>
      <Text style={styles.subtitle}>Affichée sur la vignette de votre épicerie</Text>

      {/* Aperçu de la photo existante */}
      {epicerie?.presentationPhotoUrl && !selectedImage && (
        <View style={styles.previewContainer}>
          <FallbackImage
            urls={[epicerie.presentationPhotoUrl]}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewText}>Photo actuelle</Text>
          </View>
        </View>
      )}

      {/* Aperçu de la nouvelle image sélectionnée */}
      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: selectedImage }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewText}>Nouvelle photo</Text>
          </View>
        </View>
      )}

      {/* Boutons d'action */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={pickImage}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>📁 Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={takePhoto}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>📷 Caméra</Text>
        </TouchableOpacity>
      </View>

      {/* Boutons d'upload/suppression */}
      {selectedImage && (
        <TouchableOpacity
          style={[styles.button, styles.uploadButton]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>✅ Confirmer l'upload</Text>
          )}
        </TouchableOpacity>
      )}

      {epicerie?.presentationPhotoUrl && !selectedImage && (
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={handleDelete}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>🗑️ Supprimer</Text>
        </TouchableOpacity>
      )}

      {/* Message info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ℹ️ Format recommandé: 16:9 (bannière)
          {'\n'}Taille max: 10 MB
          {'\n'}Formats: JPG, PNG
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  previewContainer: {
    width: '100%',
    height: (width - 64) * (9 / 16),
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: '#388E3C',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    marginTop: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 18,
  },
});
