import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { authService } from '../../src/services/authService';
import { profileService } from '../../src/services/profileService';
import { User } from '../../src/type';

export default function ProfilScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await profileService.getMyProfile();
      setUser(userData);
      // TODO: Charger l'URL de la photo de profil si disponible
      // setProfilePhotoUrl(userData.photoUrl);
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      Alert.alert(t('common.error'), t('profile.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      t('profile.changePhoto'),
      '',
      [
        {
          text: t('profile.takePhoto'),
          onPress: () => takePictureWithCamera(),
        },
        {
          text: t('profile.chooseFromGallery'),
          onPress: () => pickImageFromGallery(),
        },
        ...(profilePhotoUrl ? [{
          text: t('profile.removePhoto'),
          style: 'destructive' as const,
          onPress: () => handleDeletePhoto(),
        }] : []),
        {
          text: t('common.cancel'),
          style: 'cancel' as const,
        },
      ]
    );
  };

  const takePictureWithCamera = async () => {
    try {
      // Demander la permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          t('profile.permissionRequired'),
          t('profile.cameraPermission')
        );
        return;
      }

      // Lancer l'appareil photo
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur caméra:', error);
      Alert.alert(t('common.error'), t('profile.photoError'));
    }
  };

  const pickImageFromGallery = async () => {
    try {
      // Demander la permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          t('profile.permissionRequired'),
          t('profile.galleryPermission')
        );
        return;
      }

      // Ouvrir la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur galerie:', error);
      Alert.alert(t('common.error'), t('profile.photoError'));
    }
  };

  const processImage = async (uri: string) => {
    try {
      setUploading(true);

      // Redimensionner et recadrer l'image pour un format carré optimal (400x400)
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 400, height: 400 } },
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log('[Profile] Image traitée:', manipulatedImage.uri);

      // Upload de l'image
      const response = await profileService.uploadProfilePhoto(manipulatedImage.uri);
      
      console.log('[Profile] Upload réussi:', response);

      // Mettre à jour l'affichage local
      setProfilePhotoUrl(response.photoUrl);

      Alert.alert(t('common.success'), t('profile.photoUpdated'));

      // Recharger le profil pour obtenir la nouvelle URL
      await loadUserData();
    } catch (error) {
      console.error('Erreur traitement image:', error);
      Alert.alert(t('common.error'), t('profile.photoError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = () => {
    Alert.alert(
      t('profile.removePhoto'),
      t('profile.confirmDeletePhoto'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);
              await profileService.deleteProfilePhoto();
              setProfilePhotoUrl(null);
              Alert.alert(t('common.success'), t('profile.photoDeleted'));
              await loadUserData();
            } catch (error) {
              console.error('Erreur suppression photo:', error);
              Alert.alert(t('common.error'), t('profile.photoError'));
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.confirmLogout'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Erreur déconnexion:', error);
              Alert.alert(t('common.error'), t('profile.logoutError'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handleChangePhoto}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.avatarPlaceholder}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.uploadingText}>{t('profile.uploadingPhoto')}</Text>
            </View>
          ) : profilePhotoUrl ? (
            <>
              <Image 
                source={{ uri: profilePhotoUrl }} 
                style={styles.avatarImage}
              />
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>✏️</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.avatarEmoji}>👤</Text>
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>📷</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.nom || t('profile.user')}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📧 {t('profile.email')}</Text>
            <Text style={styles.infoValue}>{user?.email || t('profile.notProvided')}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📱 {t('profile.phone')}</Text>
            <Text style={styles.infoValue}>
              {user?.telephone && user.telephone.trim() !== '' ? user.telephone : t('profile.notProvided')}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 {t('profile.address')}</Text>
            <Text style={styles.infoValue}>
              {user?.adresse && user.adresse.trim() !== '' ? user.adresse : t('profile.notProvided')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.actions')}</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/(commandes)')}
        >
          <Text style={styles.actionIcon}>🛍️</Text>
          <Text style={styles.actionText}>{t('profile.myOrders')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/favoris')}
        >
          <Text style={styles.actionIcon}>❤️</Text>
          <Text style={styles.actionText}>{t('profile.myFavorites')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/factures-paiements')}
        >
          <Text style={styles.actionIcon}>💳</Text>
          <Text style={styles.actionText}>{t('profile.myInvoices')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/invitations')}
        >
          <Text style={styles.actionIcon}>✉️</Text>
          <Text style={styles.actionText}>{t('profile.myInvitations')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/notifications')}
        >
          <Text style={styles.actionIcon}>📢</Text>
          <Text style={styles.actionText}>{t('profile.myNotifications')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/settings' as any)}
        >
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionText}>{t('profile.settings')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>❓</Text>
          <Text style={styles.actionText}>{t('profile.helpSupport')}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 {t('profile.logout')}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('app.version')}</Text>
      </View>
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
    backgroundColor: '#4CAF50',
    padding: 30,
    alignItems: 'center',
    paddingTop: 40,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 50,
  },
  uploadingText: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  editBadgeText: {
    fontSize: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    marginLeft: 5,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 24,
    color: '#ccc',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 18,
    margin: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#ff5252',
  },
  logoutText: {
    fontSize: 16,
    color: '#ff5252',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
