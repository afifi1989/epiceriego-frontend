/**
 * Composant pour permettre à l'épicier de choisir et uploader une photo de profil
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

interface ProfilePhotoUploadProps {
  photoUrl?: string;
  onPhotoSelected: (uri: string, base64?: string) => void;
  uploading?: boolean;
}

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  photoUrl,
  onPhotoSelected,
  uploading = false,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      // Demander les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de l\'accès à votre galerie pour changer la photo de profil'
        );
        return;
      }

      // Ouvrir le sélecteur d'images
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        const base64 = result.assets[0].base64;

        console.log('[ProfilePhotoUpload] Image sélectionnée:', {
          uri: imageUri,
          size: result.assets[0].width + 'x' + result.assets[0].height,
          hasBase64: !!base64,
        });

        setSelectedImage(imageUri);
        onPhotoSelected(imageUri, base64 ?? undefined);
      }
    } catch (error) {
      console.error('[ProfilePhotoUpload] Erreur sélection image:', error);
      Alert.alert(
        'Erreur',
        'Impossible de sélectionner l\'image. Veuillez réessayer.'
      );
    }
  };

  const takePhoto = async () => {
    try {
      // Demander les permissions de caméra
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de l\'accès à votre caméra pour prendre une photo'
        );
        return;
      }

      // Ouvrir la caméra
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        const base64 = result.assets[0].base64;

        console.log('[ProfilePhotoUpload] Photo prise:', {
          uri: imageUri,
          size: result.assets[0].width + 'x' + result.assets[0].height,
          hasBase64: !!base64,
        });

        setSelectedImage(imageUri);
        onPhotoSelected(imageUri, base64 ?? undefined);
      }
    } catch (error) {
      console.error('[ProfilePhotoUpload] Erreur prise de photo:', error);
      Alert.alert(
        'Erreur',
        'Impossible de prendre une photo. Veuillez réessayer.'
      );
    }
  };

  // Déterminer quelle photo afficher (nouvelle sélection ou existante)
  const displayImage = selectedImage || photoUrl;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photo de profil de l'épicerie</Text>

      {/* Zone d'affichage de la photo */}
      <View style={styles.photoContainer}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={styles.photo}
            onError={(error) => {
              console.warn('[ProfilePhotoUpload] Erreur chargement image:', error);
            }}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <MaterialIcons name="store" size={60} color="#2196F3" />
            <Text style={styles.placeholderText}>Ajouter une photo</Text>
          </View>
        )}

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.uploadingText}>Mise à jour...</Text>
          </View>
        )}
      </View>

      {/* Boutons d'action */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.galleryButton]}
          onPress={pickImage}
          disabled={uploading}
        >
          <MaterialIcons name="photo-library" size={20} color="#fff" />
          <Text style={styles.buttonText}>Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cameraButton]}
          onPress={takePhoto}
          disabled={uploading}
        >
          <MaterialIcons name="camera-alt" size={20} color="#fff" />
          <Text style={styles.buttonText}>Caméra</Text>
        </TouchableOpacity>
      </View>

      {displayImage && !uploading && (
        <Text style={styles.helpText}>
          La photo sera mise à jour lors de la sauvegarde du profil
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  photoContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    borderWidth: 3,
    borderColor: '#2196F3',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },

  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },

  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 75,
  },

  uploadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },

  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 15,
  },

  button: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },

  galleryButton: {
    backgroundColor: '#2196F3',
  },

  cameraButton: {
    backgroundColor: '#4CAF50',
  },

  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  helpText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
