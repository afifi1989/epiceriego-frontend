import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { authService } from '../../src/services/authService';
import { invoiceService } from '../../src/services/invoiceService';
import { settingsService } from '../../src/services/settingsService';
import type {
  Invoice,
  NotificationSettings,
  UserPreferences,
} from '../../src/type';

const LANGUAGE_OPTIONS = [
  { label: 'Français', value: 'fr' },
  { label: 'العربية', value: 'ar' },
  { label: 'English', value: 'en' },
  { label: 'Tamazight (ⴰⵜⵎⴰⵣⵎⴰⵖⵜ)', value: 'tz' },
];

const TIMEZONE_OPTIONS = [
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
];

const CURRENCY_OPTIONS = [
  { label: 'EUR (DH)', value: 'EUR' },
  { label: 'MAD (DH)', value: 'MAD' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  // États pour les notifications
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushNotifications: true,
    emailNotifications: true,
    orderNotifications: true,
    promoNotifications: true,
    deliveryNotifications: true,
  });

  // États pour les préférences
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: 'fr',
    darkMode: false,
    currency: 'EUR',
    timezone: 'Europe/Paris',
  });

  // États généraux
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // États pour les modales
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // États pour changement de mot de passe
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // États pour suppression de compte
  const [deleteForm, setDeleteForm] = useState({
    password: '',
    confirmation: '',
  });
  const [checkingDebt, setCheckingDebt] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);

  // Charger les settings au chargement
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('[SettingsScreen] Chargement des paramètres...');
      const allSettings = await settingsService.getAllSettings();
      setNotifications(allSettings.notifications);
      setPreferences(allSettings.preferences);
      console.log('[SettingsScreen] ✅ Paramètres chargés avec succès');
    } catch (error) {
      console.error('[SettingsScreen] ❌ Erreur chargement paramètres:', error);
      Alert.alert(t('common.error'), t('settings.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour les notifications
  const handleNotificationChange = async (key: keyof NotificationSettings) => {
    try {
      const updated = { ...notifications, [key]: !notifications[key] };
      setNotifications(updated);
      setIsSaving(true);
      await settingsService.updateNotificationSettings(updated);
      console.log(`[SettingsScreen] ✅ ${key} mis à jour`);
    } catch (error) {
      console.error(`[SettingsScreen] ❌ Erreur mise à jour ${key}:`, error);
      // Revenir à l'état précédent en cas d'erreur
      setNotifications({ ...notifications });
      Alert.alert(t('common.error'), String(error));
    } finally {
      setIsSaving(false);
    }
  };

  // Mettre à jour les préférences
  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    try {
      const updated = { ...preferences, [key]: value };
      setPreferences(updated);
      setIsSaving(true);
      await settingsService.updateUserPreferences(updated);
      console.log(`[SettingsScreen] ✅ ${key} mis à jour`);
    } catch (error) {
      console.error(`[SettingsScreen] ❌ Erreur mise à jour ${key}:`, error);
      // Revenir à l'état précédent en cas d'erreur
      setPreferences({ ...preferences });
      Alert.alert(t('common.error'), String(error));
    } finally {
      setIsSaving(false);
    }
  };

  // Changer le mot de passe
  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      Alert.alert(t('common.error'), t('settings.enterCurrentPassword'));
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      Alert.alert(t('common.error'), t('settings.passwordMinLength'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert(t('common.error'), t('settings.passwordMismatch'));
      return;
    }

    try {
      setIsSaving(true);
      await settingsService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      Alert.alert(t('common.success'), t('settings.passwordChanged'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePasswordModal(false);
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setIsSaving(false);
    }
  };

  // Vérifier les crédits en cours avant d'autoriser la suppression
  const handleRequestDeleteAccount = async () => {
    setCheckingDebt(true);
    try {
      const invoices = await invoiceService.getMyUnpaidInvoices();
      setUnpaidInvoices(invoices);

      if (invoices.length > 0) {
        const totalDebt = invoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
        // Regrouper par epicerie
        const byStore = new Map<string, number>();
        for (const inv of invoices) {
          const name = inv.epicerieName || `Epicerie #${inv.epicerieId}`;
          byStore.set(name, (byStore.get(name) ?? 0) + (inv.amount ?? 0));
        }
        const storeLines = Array.from(byStore.entries())
          .map(([name, amount]) => `  - ${name} : ${amount.toFixed(2)} DH`)
          .join('\n');

        Alert.alert(
          'Suppression impossible',
          `Vous avez ${invoices.length} facture${invoices.length > 1 ? 's' : ''} impayee${invoices.length > 1 ? 's' : ''} pour un total de ${totalDebt.toFixed(2)} DH :\n\n${storeLines}\n\nVeuillez regulariser votre situation aupres de ${byStore.size > 1 ? 'ces epiceries' : 'cette epicerie'} avant de supprimer votre compte.`,
          [
            { text: 'Voir mes factures', onPress: () => router.push('/(client)/factures-paiements' as any) },
            { text: 'Fermer', style: 'cancel' },
          ],
        );
        return;
      }

      // Pas de dette — ouvrir le modal de suppression
      setDeleteForm({ password: '', confirmation: '' });
      setShowDeleteAccountModal(true);
    } catch (error) {
      console.error('[Settings] Erreur verification dette:', error);
      // En cas d'erreur reseau, on laisse quand meme acceder au modal
      // (le backend refusera aussi si dette)
      setDeleteForm({ password: '', confirmation: '' });
      setShowDeleteAccountModal(true);
    } finally {
      setCheckingDebt(false);
    }
  };

  // Supprimer le compte
  const handleDeleteAccount = async () => {
    if (!deleteForm.password) {
      Alert.alert(t('common.error'), t('settings.enterPassword'));
      return;
    }
    if (deleteForm.confirmation !== 'DELETE_MY_ACCOUNT') {
      Alert.alert(t('common.error'), t('settings.typeDeleteConfirmation'));
      return;
    }

    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteWarning'),
      [
        { text: t('settings.cancel'), onPress: () => {} },
        {
          text: t('settings.deleteForever'),
          onPress: async () => {
            try {
              setIsSaving(true);
              await settingsService.deleteAccount({
                password: deleteForm.password,
                confirmation: deleteForm.confirmation,
              });
              Alert.alert(t('common.success'), t('settings.accountDeleted') || 'Compte supprimé avec succès');
              // Déconnexion automatique
              await authService.logout();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert(t('common.error'), String(error));
            } finally {
              setIsSaving(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Déconnexion
  const handleLogout = async () => {
    Alert.alert(t('settings.logout'), t('orders.confirmLogout'), [
      { text: t('settings.cancel'), onPress: () => {} },
      {
        text: t('settings.logout'),
        onPress: async () => {
          try {
            await authService.logout();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert(t('common.error'), t('settings.logoutError'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      {/* Section Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 {t('settings.notifications')}</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.pushNotifications')}</Text>
            <Text style={styles.settingDescription}>{t('settings.receivePushAlerts')}</Text>
          </View>
          <Switch
            value={notifications.pushNotifications}
            onValueChange={() => handleNotificationChange('pushNotifications')}
            disabled={isSaving}
          />
        </View>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push('/(client)/notification-preferences' as any)}
        >
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>
              {t('settings.notificationPreferences') || '⚙️ Préférences avancées'}
            </Text>
            <Text style={styles.settingDescription}>
              {t('settings.notificationPreferencesDesc') ||
                'Gérer chaque catégorie de notification (commandes, promos, fidélité…)'}
            </Text>
          </View>
          <Text style={{ fontSize: 18, color: '#999' }}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push('/push-diagnostic' as any)}
        >
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>🔧 Diagnostic Push</Text>
            <Text style={styles.settingDescription}>
              Vérifier permissions, token Expo et enregistrement backend
            </Text>
          </View>
          <Text style={{ fontSize: 18, color: '#999' }}>›</Text>
        </TouchableOpacity>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.emailNotifications')}</Text>
            <Text style={styles.settingDescription}>{t('settings.receiveEmails')}</Text>
          </View>
          <Switch
            value={notifications.emailNotifications}
            onValueChange={() => handleNotificationChange('emailNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.orderNotifications')}</Text>
            <Text style={styles.settingDescription}>{t('settings.orderUpdates')}</Text>
          </View>
          <Switch
            value={notifications.orderNotifications}
            onValueChange={() => handleNotificationChange('orderNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.promoNotifications')}</Text>
            <Text style={styles.settingDescription}>{t('settings.specialOffers')}</Text>
          </View>
          <Switch
            value={notifications.promoNotifications}
            onValueChange={() => handleNotificationChange('promoNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.deliveryNotifications')}</Text>
            <Text style={styles.settingDescription}>{t('settings.deliveryUpdates')}</Text>
          </View>
          <Switch
            value={notifications.deliveryNotifications}
            onValueChange={() => handleNotificationChange('deliveryNotifications')}
            disabled={isSaving}
          />
        </View>
      </View>

      {/* Section Préférences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ {t('settings.preferences')}</Text>

        {/* Langue */}
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => setShowLanguageModal(true)}
        >
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.language')}</Text>
            <Text style={styles.settingDescription}>
              {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label}
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Fuseau horaire */}
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => setShowTimezoneModal(true)}
        >
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.timezone')}</Text>
            <Text style={styles.settingDescription}>{preferences.timezone}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Mode sombre */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>{t('settings.darkMode')}</Text>
            <Text style={styles.settingDescription}>{t('settings.enableDarkMode')}</Text>
          </View>
          <Switch
            value={preferences.darkMode}
            onValueChange={(value) => handlePreferenceChange('darkMode', value)}
            disabled={isSaving}
          />
        </View>
      </View>

      {/* Section Sécurité */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 {t('settings.security')}</Text>

        <TouchableOpacity
          style={styles.buttonItem}
          onPress={() => setShowChangePasswordModal(true)}
        >
          <Text style={styles.buttonItemText}>{t('settings.changePassword')}</Text>
        </TouchableOpacity>
      </View>

      {/* Section Compte */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 {t('settings.account')}</Text>

        <TouchableOpacity style={styles.buttonItem} onPress={handleLogout}>
          <Text style={styles.buttonItemText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonItem, styles.dangerButton]}
          onPress={handleRequestDeleteAccount}
          disabled={checkingDebt}
        >
          {checkingDebt ? (
            <ActivityIndicator size="small" color="#d32f2f" />
          ) : (
            <Text style={styles.dangerButtonText}>{t('settings.deleteAccount')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal Langue */}
      <Modal visible={showLanguageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.selectLanguage')}</Text>
            {LANGUAGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  language === option.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setLanguage(option.value as any);
                  setShowLanguageModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    language === option.value && styles.modalOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={styles.closeButtonText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Devise */}
      <Modal visible={showCurrencyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.selectCurrency')}</Text>
            {CURRENCY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  preferences.currency === option.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  handlePreferenceChange('currency', option.value);
                  setShowCurrencyModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    preferences.currency === option.value && styles.modalOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCurrencyModal(false)}
            >
              <Text style={styles.closeButtonText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Fuseau horaire */}
      <Modal visible={showTimezoneModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.selectTimezone')}</Text>
            {TIMEZONE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  preferences.timezone === option.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  handlePreferenceChange('timezone', option.value);
                  setShowTimezoneModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    preferences.timezone === option.value && styles.modalOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTimezoneModal(false)}
            >
              <Text style={styles.closeButtonText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Changer mot de passe */}
      <Modal visible={showChangePasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.changePassword')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('settings.currentPassword')}
              placeholderTextColor="#999"
              secureTextEntry
              value={passwordForm.currentPassword}
              onChangeText={(text) =>
                setPasswordForm({ ...passwordForm, currentPassword: text })
              }
              editable={!isSaving}
            />

            <TextInput
              style={styles.input}
              placeholder={t('settings.newPassword')}
              placeholderTextColor="#999"
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={(text) =>
                setPasswordForm({ ...passwordForm, newPassword: text })
              }
              editable={!isSaving}
            />

            <TextInput
              style={styles.input}
              placeholder={t('settings.confirmPassword')}
              placeholderTextColor="#999"
              secureTextEntry
              value={passwordForm.confirmPassword}
              onChangeText={(text) =>
                setPasswordForm({ ...passwordForm, confirmPassword: text })
              }
              editable={!isSaving}
            />

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleChangePassword}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>{t('settings.confirm')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowChangePasswordModal(false)}
              disabled={isSaving}
            >
              <Text style={styles.closeButtonText}>{t('settings.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Supprimer compte */}
      <Modal visible={showDeleteAccountModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.deleteAccount')}</Text>
            <Text style={styles.warningText}>{t('settings.deleteWarning')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('settings.yourPassword')}
              placeholderTextColor="#999"
              secureTextEntry
              value={deleteForm.password}
              onChangeText={(text) => setDeleteForm({ ...deleteForm, password: text })}
              editable={!isSaving}
            />

            <TextInput
              style={styles.input}
              placeholder={t('settings.typeDeleteConfirmation')}
              placeholderTextColor="#999"
              value={deleteForm.confirmation}
              onChangeText={(text) =>
                setDeleteForm({ ...deleteForm, confirmation: text })
              }
              editable={!isSaving}
            />

            <TouchableOpacity
              style={[styles.confirmButton, styles.dangerButton]}
              onPress={handleDeleteAccount}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.dangerButtonText}>{t('settings.deleteForever')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDeleteAccountModal(false)}
              disabled={isSaving}
            >
              <Text style={styles.closeButtonText}>{t('settings.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    flex: 1,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
  },
  arrow: {
    fontSize: 24,
    color: '#4CAF50',
    marginLeft: 12,
  },
  buttonItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  buttonItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },
  dangerButton: {
    backgroundColor: '#ffebee',
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d32f2f',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderRadius: 6,
    marginBottom: 6,
  },
  modalOptionActive: {
    backgroundColor: '#e8f5e9',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  modalOptionTextActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});
