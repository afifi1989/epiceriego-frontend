import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/constants/config';
import { authService } from '../../src/services/authService';
import { livreurService } from '../../src/services/livreurService';
import { AvailabilityToggle } from '../../src/components/livreur/AvailabilityToggle';
import { User } from '../../src/type';

export default function LivreurProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    orderNotifications: true,
    deliveryNotifications: true,
  });

  // Charger les infos utilisateur
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Erreur chargement utilisateur:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Gérer la disponibilité
  const handleAvailabilityToggle = async (value: boolean) => {
    try {
      setAvailabilityLoading(true);
      await livreurService.updateAvailability(value, userLocation?.latitude, userLocation?.longitude);
      setIsAvailable(value);
    } catch (error: any) {
      console.error('Erreur disponibilité:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la disponibilité');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // Déconnexion
  const handleLogout = async (): Promise<void> => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Erreur déconnexion:', error);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* En-tête avec infos utilisateur */}
      {user && (
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>👤</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.nom}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            {user.telephone && <Text style={styles.userPhone}>📞 {user.telephone}</Text>}
          </View>
        </View>
      )}

      {/* Disponibilité */}
      <View style={styles.section}>
        <AvailabilityToggle
          isAvailable={isAvailable}
          onToggle={handleAvailabilityToggle}
          isLoading={availabilityLoading}
          location={userLocation}
        />
      </View>

      {/* Statistiques rapides */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>📊 Mes Statistiques</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Note moyenne</Text>
            <Text style={styles.statIcon}>⭐⭐⭐⭐⭐</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>247</Text>
            <Text style={styles.statLabel}>Livraisons totales</Text>
            <Text style={styles.statIcon}>🚚</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>98%</Text>
            <Text style={styles.statLabel}>Taux de succès</Text>
            <Text style={styles.statIcon}>✅</Text>
          </View>
        </View>
      </View>

      {/* Infos adresse */}
      {user && user.adresse && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Mon Adresse</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Adresse:</Text>
            <Text style={styles.infoValue}>{user.adresse}</Text>
          </View>
        </View>
      )}

      {/* Paramètres de notification */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>
          <TouchableOpacity onPress={() => setShowNotificationModal(!showNotificationModal)}>
            <Text style={styles.editButton}>Gérer</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notificationsList}>
          <View style={styles.notificationItem}>
            <Text style={styles.notificationLabel}>Notifications push</Text>
            <Text style={styles.notificationStatus}>
              {notificationSettings.pushNotifications ? '✅ Activé' : '❌ Désactivé'}
            </Text>
          </View>
          <View style={styles.notificationItem}>
            <Text style={styles.notificationLabel}>Livraisons</Text>
            <Text style={styles.notificationStatus}>
              {notificationSettings.deliveryNotifications ? '✅ Activé' : '❌ Désactivé'}
            </Text>
          </View>
        </View>
      </View>

      {/* À propos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ À propos</Text>
        <View style={styles.aboutBox}>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Rôle</Text>
            <Text style={styles.aboutValue}>Livreur</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Compte créé</Text>
            <Text style={styles.aboutValue}>Janvier 2024</Text>
          </View>
        </View>
      </View>

      {/* Aide et Support */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>❓</Text>
          <Text style={styles.actionLabel}>Centre d'aide</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Nous contacter</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionLabel}>Paramètres du compte</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton Déconnexion */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutIcon}>🚪</Text>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>

      {/* Conditions d'utilisation */}
      <View style={styles.footerSection}>
        <Text style={styles.footerLink}>Conditions d'utilisation</Text>
        <Text style={styles.footerSeparator}>•</Text>
        <Text style={styles.footerLink}>Politique de confidentialité</Text>
      </View>

      <View style={{ height: 20 }} />
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
  headerCard: {
    backgroundColor: '#9C27B0',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatar: {
    fontSize: 40,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    marginHorizontal: 15,
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  editButton: {
    color: '#9C27B0',
    fontSize: 13,
    fontWeight: '600',
  },
  statsSection: {
    marginHorizontal: 15,
    marginVertical: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9C27B0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 12,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  notificationsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  notificationStatus: {
    fontSize: 12,
    color: '#666',
  },
  aboutBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  aboutLabel: {
    fontSize: 13,
    color: '#666',
  },
  aboutValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 18,
    color: '#ccc',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 15,
    marginVertical: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  footerLink: {
    fontSize: 11,
    color: '#9C27B0',
    fontWeight: '500',
  },
  footerSeparator: {
    color: '#ccc',
  },
});
