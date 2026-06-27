export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * WhatsApp Business settings screen for epicier.
 * Allows enabling/disabling WhatsApp ordering, configuring phone number,
 * welcome message, and auto-accept preferences.
 */

import { WhatsAppShareCard } from '@/src/components/whatsapp/WhatsAppShareCard';
import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import whatsappSettingsService, { WhatsAppSettings } from '@/src/services/whatsappSettingsService';
import { useSubscription } from '@/src/hooks/useSubscription';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

const WHATSAPP_GREEN = '#25D366';

export default function WhatsAppSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WhatsAppSettings>({
    whatsappEnabled: false,
    whatsappWelcomeMessage: '',
    whatsappAutoAccept: false,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const router = useRouter();
  const { hasFeature, loading: subLoading } = useSubscription();
  // WhatsApp Business est inclus à partir du plan Essentiel. Sans la feature,
  // on n'affiche ni le QR ni l'activation (le backend renvoie 402 de toute
  // façon) — on propose l'upgrade à la place.
  const whatsappAllowed = hasFeature('hasWhatsapp');

  useFocusEffect(
    useCallback(() => {
      if (subLoading) return;           // attendre de connaître le plan
      if (!whatsappAllowed) {           // plan insuffisant → pas de fetch
        setLoading(false);
        return;
      }
      loadSettings();
    }, [subLoading, whatsappAllowed])
  );

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await whatsappSettingsService.getSettings();
      setSettings(data);
      setHasChanges(false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger les paramètres WhatsApp',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof WhatsAppSettings>(
    field: K,
    value: WhatsAppSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    // No phone validation needed — platform number is used

    try {
      setSaving(true);
      const updated = await whatsappSettingsService.updateSettings(settings);
      setSettings(updated);
      setHasChanges(false);
      Toast.show({
        type: 'success',
        text1: 'Enregistré',
        text2: 'Paramètres WhatsApp mis à jour',
      });
    } catch (error: any) {
      // Si l'intercepteur 402 a deja affiche l'Alert d'abonnement,
      // on n'empile pas un Toast generique. Sinon on affiche le
      // message du backend en priorite (clair) sinon fallback statique.
      if (!error?.__subscriptionGateHandled) {
        const backendMsg = error?.response?.data?.message ?? error?.message;
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: backendMsg ?? 'Impossible de sauvegarder les paramètres',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (subLoading || (whatsappAllowed && loading)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={WHATSAPP_GREEN} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="whatsapp" size={32} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>WhatsApp Business</Text>
            <Text style={styles.headerSubtitle}>
              Permettez à vos clients de passer des commandes directement via WhatsApp
              (texte ou message audio).
            </Text>
          </View>

          {!whatsappAllowed ? (
            /* Plan insuffisant : pas de QR ni d'activation, on propose l'upgrade. */
            <View style={styles.lockCard}>
              <View style={styles.lockIcon}>
                <MaterialCommunityIcons name="lock-outline" size={28} color={WHATSAPP_GREEN} />
              </View>
              <Text style={styles.lockTitle}>Plan Essentiel requis</Text>
              <Text style={styles.lockText}>
                Les commandes WhatsApp (QR à partager, lien wa.me, message de
                bienvenue) sont incluses à partir du plan Essentiel. Votre offre
                actuelle ne permet pas d’activer cette fonctionnalité.
              </Text>
              <TouchableOpacity
                style={styles.lockButton}
                onPress={() => router.push('/(epicier)/mon-abonnement')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="star-four-points" size={18} color="#fff" />
                <Text style={styles.lockButtonText}>Voir les offres</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          {/* Carte de partage : QR + lien wa.me à donner aux clients.
             Affichée au-dessus des autres sections car c'est l'action concrète
             que l'épicier va répéter (imprimer, partager). Les paramètres en
             dessous ne sont configurés qu'une fois à l'activation. */}
          <WhatsAppShareCard />

          {/* Enable Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Activer WhatsApp</Text>
                <Text style={styles.toggleDescription}>
                  Les clients pourront commander via WhatsApp
                </Text>
              </View>
              <Switch
                value={settings.whatsappEnabled}
                onValueChange={(value) => updateField('whatsappEnabled', value)}
                trackColor={{ false: Colors.border, true: WHATSAPP_GREEN + '80' }}
                thumbColor={settings.whatsappEnabled ? WHATSAPP_GREEN : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Welcome Message */}
          <View style={[styles.section, !settings.whatsappEnabled && styles.sectionDisabled]}>
            <Text style={styles.sectionTitle}>Message de bienvenue</Text>
            <Text style={styles.fieldHint}>
              Envoyé automatiquement quand un client commence une commande
            </Text>
            <TextInput
              style={[
                styles.textArea,
                !settings.whatsappEnabled && styles.inputDisabled,
              ]}
              value={settings.whatsappWelcomeMessage}
              onChangeText={(text) => updateField('whatsappWelcomeMessage', text)}
              placeholder="Bienvenue ! Envoyez votre liste de courses et nous vous préparerons votre commande."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={settings.whatsappEnabled}
            />
          </View>

          {/* Auto Accept */}
          <View style={[styles.section, !settings.whatsappEnabled && styles.sectionDisabled]}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Acceptation automatique</Text>
                <Text style={styles.toggleDescription}>
                  Les commandes WhatsApp seront automatiquement acceptées sans
                  validation manuelle
                </Text>
              </View>
              <Switch
                value={settings.whatsappAutoAccept}
                onValueChange={(value) => updateField('whatsappAutoAccept', value)}
                trackColor={{ false: Colors.border, true: WHATSAPP_GREEN + '80' }}
                thumbColor={settings.whatsappAutoAccept ? WHATSAPP_GREEN : '#f4f3f4'}
                disabled={!settings.whatsappEnabled}
              />
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialCommunityIcons
              name="information-outline"
              size={20}
              color={Colors.primary}
            />
            <Text style={styles.infoText}>
              Les clients peuvent envoyer leur liste de courses par texte ou message
              audio. L'IA identifie automatiquement les produits dans votre catalogue
              et propose un panier au client.
            </Text>
          </View>
          </>
          )}
        </ScrollView>

        {/* Save Button */}
        {hasChanges && whatsappAllowed && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  fieldHint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  toggleLabel: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleDescription: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  inputDisabled: {
    color: Colors.textTertiary,
  },
  textArea: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.text,
    minHeight: 100,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: '#fff',
  },
  // ── État verrouillé (plan insuffisant) ──
  lockCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lockIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: WHATSAPP_GREEN + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  lockTitle: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  lockText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  lockButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: '#fff',
  },
});
