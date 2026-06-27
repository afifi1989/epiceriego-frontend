export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
// Rouge "danger" unifié sur la palette du design system (était #ff5252).
import { lightColors } from '../../src/theme/colors';
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
import { EditPhoneModal } from '../../src/components/client/EditPhoneModal';
import { EditAddressModal } from '../../src/components/client/EditAddressModal';
import { User } from '../../src/type';

/**
 * Ligne d'action du profil — factorise les 9 entrées (icône + libellé +
 * chevron) et porte l'accessibilité en un seul endroit (role bouton, label =
 * libellé traduit, sans lire l'emoji décoratif).
 */
function ActionRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionText}>{label}</Text>
      <Text style={styles.actionArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfilScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  // Controle la modal d'edition du telephone (flow OTP en 2 etapes).
  const [showEditPhone, setShowEditPhone] = useState(false);
  // Modal d'edition de l'adresse postale (texte + reverse geocoding optionnel).
  const [showEditAddress, setShowEditAddress] = useState(false);

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

          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setShowEditPhone(true)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`${t('profile.phone')} — ${user?.telephone?.trim() || t('profile.notProvided')}`}
          >
            <Text style={styles.infoLabel}>📱 {t('profile.phone')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              <Text style={styles.infoValue}>
                {user?.telephone && user.telephone.trim() !== '' ? user.telephone : t('profile.notProvided')}
              </Text>
              <Text style={{ marginStart: 6, color: '#4CAF50', fontWeight: '600' }}>
                {user?.telephone && user.telephone.trim() !== '' ? '✎' : '+'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setShowEditAddress(true)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`${t('profile.address')} — ${user?.adresse?.trim() || t('profile.notProvided')}`}
          >
            <Text style={styles.infoLabel}>📍 {t('profile.address')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              <Text style={styles.infoValue} numberOfLines={2}>
                {user?.adresse && user.adresse.trim() !== '' ? user.adresse : t('profile.notProvided')}
              </Text>
              <Text style={{ marginStart: 6, color: '#4CAF50', fontWeight: '600' }}>
                {user?.adresse && user.adresse.trim() !== '' ? '✎' : '+'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.actions')}</Text>

        <ActionRow icon="🛍️" label={t('profile.myOrders')} onPress={() => router.push('/(client)/(commandes)')} />
        <ActionRow icon="❤️" label={t('profile.myFavorites')} onPress={() => router.push('/(client)/favoris')} />
        <ActionRow icon="📒" label={t('profile.myCarnet')} onPress={() => router.push('/(client)/mon-carnet')} />
        <ActionRow icon="💳" label={t('profile.myInvoices')} onPress={() => router.push('/(client)/factures-paiements')} />
        <ActionRow icon="⭐" label={t('profile.myLoyalty')} onPress={() => router.push('/(client)/fidelite' as any)} />
        <ActionRow icon="✉️" label={t('profile.myInvitations')} onPress={() => router.push('/(client)/invitations')} />
        <ActionRow icon="📢" label={t('profile.myNotifications')} onPress={() => router.push('/(client)/notifications')} />
        <ActionRow icon="⚙️" label={t('profile.settings')} onPress={() => router.push('/(client)/settings' as any)} />
        <ActionRow icon="❓" label={t('profile.helpSupport')} onPress={() => router.push('/(client)/aide-support' as any)} />
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel={t('profile.logout')}
      >
        <Text style={styles.logoutText}>🚪 {t('profile.logout')}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('app.version')}</Text>
      </View>

      <EditPhoneModal
        visible={showEditPhone}
        onClose={() => setShowEditPhone(false)}
        currentPhone={user?.telephone}
        onSuccess={(updated) => setUser(updated)}
      />

      <EditAddressModal
        visible={showEditAddress}
        onClose={() => setShowEditAddress(false)}
        currentAddress={user?.adresse}
        currentLatitude={user?.latitude}
        currentLongitude={user?.longitude}
        onSuccess={(updated) => setUser(updated)}
      />
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
    marginStart: 5,
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
    marginStart: 10,
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
    marginEnd: 15,
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
    borderColor: lightColors.danger,
  },
  logoutText: {
    fontSize: 16,
    color: lightColors.danger,
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
