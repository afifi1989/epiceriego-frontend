export { LivreurErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/constants/config';
import { authService } from '../../src/services/authService';
import { livreurService } from '../../src/services/livreurService';
import { AvailabilityToggle } from '../../src/components/livreur/AvailabilityToggle';
import { LivreurNotificationSettings, LivreurProfile, LivreurStats } from '../../src/type';

/** Formate une date ISO en « mois année » (ex. « janvier 2024 »). */
const formatMonthYear = (isoDate?: string): string => {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

export default function LivreurProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<LivreurProfile | null>(null);
  const [stats, setStats] = useState<LivreurStats | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<LivreurNotificationSettings>({
    pushNotifications: true,
    emailNotifications: true,
    orderNotifications: true,
    deliveryNotifications: true,
  });

  // Charger profil + stats + préférences depuis l'API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [profileResult, statsResult, settingsResult] = await Promise.allSettled([
          livreurService.getProfile(),
          livreurService.getStats(),
          livreurService.getNotificationSettings(),
        ]);

        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value);
        } else {
          // Fallback hors-ligne : infos de session stockées localement
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
          if (userData) {
            setProfile(JSON.parse(userData));
          }
        }

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value);
        }

        if (settingsResult.status === 'fulfilled') {
          setNotificationSettings(settingsResult.value);
        }
      } catch (error) {
        console.error('Erreur chargement profil livreur:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
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

  // Modifier une préférence de notification (sauvegarde immédiate)
  const handleSettingToggle = async (key: keyof LivreurNotificationSettings, value: boolean) => {
    const previous = notificationSettings;
    // Mise à jour optimiste : le switch répond instantanément
    setNotificationSettings({ ...previous, [key]: value });
    try {
      setSettingsSaving(true);
      await livreurService.updateNotificationSettings({ [key]: value });
    } catch (error: any) {
      // Échec serveur → on restaure l'état précédent
      setNotificationSettings(previous);
      Alert.alert('Erreur', typeof error === 'string' ? error : 'Impossible de sauvegarder la préférence');
    } finally {
      setSettingsSaving(false);
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
      {profile && (
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>👤</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile.nom}</Text>
            <Text style={styles.userEmail}>{profile.email}</Text>
            {profile.telephone && <Text style={styles.userPhone}>📞 {profile.telephone}</Text>}
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

      {/* Statistiques (chargées depuis GET /livreurs/stats) */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>📊 Mes Statistiques</Text>
        {stats ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.statLabel}>Note moyenne</Text>
                <Text style={styles.statIcon}>⭐</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
                <Text style={styles.statLabel}>Livraisons totales</Text>
                <Text style={styles.statIcon}>🚚</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Math.round(stats.successRate)}%</Text>
                <Text style={styles.statLabel}>Taux de succès</Text>
                <Text style={styles.statIcon}>✅</Text>
              </View>
            </View>
            <View style={styles.monthCard}>
              <Text style={styles.monthLabel}>Ce mois-ci (frais de livraison)</Text>
              <Text style={styles.monthValue}>
                {stats.thisMonthDeliveries} livraison(s) · {stats.thisMonthEarnings.toFixed(2)} DH
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoValue}>Statistiques indisponibles pour le moment</Text>
          </View>
        )}
      </View>

      {/* Infos adresse */}
      {profile?.adresse && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Mon Adresse</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Adresse:</Text>
            <Text style={styles.infoValue}>{profile.adresse}</Text>
          </View>
        </View>
      )}

      {/* Paramètres de notification */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>
          <TouchableOpacity onPress={() => setShowNotificationModal(true)}>
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

      {/* Modal de gestion des notifications */}
      <Modal
        visible={showNotificationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔔 Gérer les notifications</Text>
              {settingsSaving && <ActivityIndicator size="small" color="#9C27B0" />}
            </View>

            {(
              [
                { key: 'pushNotifications', label: 'Notifications push', hint: 'Alertes sur votre téléphone' },
                { key: 'emailNotifications', label: 'Notifications email', hint: 'Récapitulatifs par email' },
                { key: 'orderNotifications', label: 'Commandes', hint: 'Nouvelles commandes assignées' },
                { key: 'deliveryNotifications', label: 'Livraisons', hint: 'Changements de statut des livraisons' },
              ] as { key: keyof LivreurNotificationSettings; label: string; hint: string }[]
            ).map(({ key, label, hint }) => (
              <View key={key} style={styles.settingRow}>
                <View style={styles.settingTextBox}>
                  <Text style={styles.settingLabel}>{label}</Text>
                  <Text style={styles.settingHint}>{hint}</Text>
                </View>
                <Switch
                  value={notificationSettings[key]}
                  onValueChange={value => handleSettingToggle(key, value)}
                  trackColor={{ false: '#ccc', true: '#CE93D8' }}
                  thumbColor={notificationSettings[key] ? '#9C27B0' : '#f4f3f4'}
                  disabled={settingsSaving}
                />
              </View>
            ))}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowNotificationModal(false)}
            >
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.aboutValue}>{formatMonthYear(profile?.dateCreation)}</Text>
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
  monthCard: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 11,
    color: '#7B1FA2',
    marginBottom: 4,
    fontWeight: '600',
  },
  monthValue: {
    fontSize: 14,
    color: '#4A148C',
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingTextBox: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 12,
    color: '#888',
  },
  modalCloseButton: {
    backgroundColor: '#9C27B0',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
