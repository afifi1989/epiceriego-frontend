import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Skeleton, useToast } from '../../src/components/feedback';
import { useLanguage } from '../../src/context/LanguageContext';
import { authService } from '../../src/services/authService';
import { profileService } from '../../src/services/profileService';
import { User } from '../../src/type';

export default function ProfilScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await profileService.getMyProfile();
      setUser(userData);
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      toast.error(t('common.error'), t('profile.loadError'));
    } finally {
      setLoading(false);
    }
  };


  const handleLogout = async () => {
    // Confirmation native conservée: action destructive (déconnexion =
    // perte du contexte session). Native Alert avec destructive style est
    // le pattern attendu — utilisateur voit clairement le risque.
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
              toast.error(t('common.error'), t('profile.logoutError'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        {/* Header avatar/nom/email en placeholder */}
        <View style={styles.header}>
          <Skeleton variant="text" width="55%" height={22} style={{ marginBottom: 8, alignSelf: 'center' }} />
          <Skeleton variant="text" width="70%" style={{ alignSelf: 'center' }} />
        </View>

        {/* Carte info personnelle */}
        <View style={styles.section}>
          <Skeleton variant="text" width="40%" height={18} style={{ marginBottom: 12 }} />
          <View style={styles.infoCard}>
            {[0, 1, 2].map(i => (
              <React.Fragment key={i}>
                <View style={styles.infoRow}>
                  <Skeleton variant="text" width="35%" />
                  <Skeleton variant="text" width="45%" />
                </View>
                {i < 2 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Boutons d'actions */}
        <View style={styles.section}>
          <Skeleton variant="text" width="35%" height={18} style={{ marginBottom: 12 }} />
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} variant="rect" height={56} style={{ marginBottom: 10, borderRadius: 12 }} />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
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
          onPress={() => router.push('/(client)/fidelite' as any)}
        >
          <Text style={styles.actionIcon}>⭐</Text>
          <Text style={styles.actionText}>{t('profile.myLoyalty')}</Text>
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

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(client)/aide-support' as any)}
        >
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
  header: {
    backgroundColor: '#4CAF50',
    padding: 30,
    alignItems: 'center',
    paddingTop: 40,
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
