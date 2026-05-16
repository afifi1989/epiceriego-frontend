/**
 * Création / édition d'un client virtuel — UX moderne et attractive.
 *
 * Design choices :
 *  - Hero avec gradient et icône → setup the context immédiatement
 *  - Live preview de l'avatar en haut → l'épicier voit le résultat en tapant
 *  - Inputs avec icônes leading et focus state coloré
 *  - Validation inline visible (✓ vert quand le champ est OK)
 *  - Boutons full-width avec micro-feedback
 *  - Mode édition reconnaissable au premier coup d'œil (badge + couleur d'accent)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../../src/constants/config';
import { clientManagementService } from '../../../src/services/clientManagementService';
import { ClientEpicerieRelation } from '../../../src/type';

const PRIMARY = '#2196F3';
const ACCENT = '#FF9800'; // virtual / carnet
const SUCCESS = '#4CAF50';
const DANGER = '#F44336';

export default function NouveauClientVirtuelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    clientId?: string;
    name?: string;
    phone?: string;
    email?: string;
  }>();

  const editingClientId = params.clientId ? parseInt(params.clientId, 10) : null;
  const isEditMode = editingClientId !== null && !Number.isNaN(editingClientId);

  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<'name' | 'phone' | 'email' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) {
        const user = JSON.parse(raw);
        if (user.epicerieId) setEpicerieId(user.epicerieId);
      }
    });
  }, []);

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedEmail = email.trim();

  const isNameValid = trimmedName.length >= 2;
  const isPhoneValid = trimmedPhone.length === 0 || /^[+\d\s().-]{6,}$/.test(trimmedPhone);
  const isEmailValid = trimmedEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const isFormValid = isNameValid && isPhoneValid && isEmailValid && epicerieId !== null;

  const initials = trimmedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('') || '?';

  const handleSubmit = async () => {
    if (!isFormValid || !epicerieId) return;

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
      };

      let relation: ClientEpicerieRelation;
      if (isEditMode && editingClientId !== null) {
        relation = await clientManagementService.updateVirtualClient(
          epicerieId,
          editingClientId,
          payload
        );
        Alert.alert('Modifié', `${relation.clientNom} a été mis à jour.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        relation = await clientManagementService.createVirtualClient(epicerieId, payload);
        Alert.alert(
          'Client créé',
          `${relation.clientNom} est maintenant dans votre carnet.`,
          [
            {
              text: 'Voir le carnet',
              onPress: () =>
                router.replace({
                  pathname: '/(epicier)/carnet-client',
                  params: { id: String(relation.clientId) },
                }),
            },
            { text: 'Retour', onPress: () => router.back(), style: 'cancel' },
          ]
        );
      }
    } catch (error: any) {
      if (!error?.__subscriptionGateHandled) {
        Alert.alert(
          'Erreur',
          error?.response?.data?.message
            ?? (typeof error === 'string'
              ? error
              : isEditMode
                ? 'Impossible de modifier le client virtuel'
                : 'Impossible de créer le client virtuel')
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.kbAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ─── Header ─── */}
        <View
          style={[
            styles.header,
            { backgroundColor: isEditMode ? ACCENT : PRIMARY },
          ]}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {isEditMode ? 'ÉDITION' : 'NOUVEAU'}
              </Text>
            </View>
          </View>

          {/* Live avatar preview */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
            <View style={styles.avatarMeta}>
              <Text style={styles.headerTitle}>
                {trimmedName || (isEditMode ? 'Modifier le client' : 'Nouveau client')}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isEditMode
                  ? 'Mettre à jour les informations'
                  : 'Carnet — sans application'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Content ─── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info card (créer uniquement) */}
          {!isEditMode && (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="bulb-outline" size={20} color="#1565c0" />
              </View>
              <Text style={styles.infoText}>
                Pour les clients qui paient en espèces et n'ont pas l'application.
                Quand ils s'inscriront avec ce numéro,{' '}
                <Text style={styles.infoBold}>leur historique sera préservé</Text>.
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.formCard}>
            <FormField
              icon="person-outline"
              label="Nom du client"
              required
              focused={focused === 'name'}
              valid={isNameValid && trimmedName.length > 0}
              error={trimmedName.length > 0 && !isNameValid ? 'Au moins 2 caractères' : null}
            >
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Mohammed Ait Ali"
                placeholderTextColor="#aaa"
                autoCapitalize="words"
                editable={!saving}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
              />
            </FormField>

            <FormField
              icon="call-outline"
              label="Téléphone"
              hint="Recommandé pour le rattachement automatique"
              focused={focused === 'phone'}
              valid={isPhoneValid && trimmedPhone.length > 0}
              error={trimmedPhone.length > 0 && !isPhoneValid ? 'Format invalide' : null}
            >
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+212 6 00 00 00 00"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                editable={!saving}
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused(null)}
              />
            </FormField>

            <FormField
              icon="mail-outline"
              label="Email"
              hint="Optionnel — pour vos archives"
              focused={focused === 'email'}
              valid={isEmailValid && trimmedEmail.length > 0}
              error={trimmedEmail.length > 0 && !isEmailValid ? 'Email invalide' : null}
            >
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="exemple@email.com"
                placeholderTextColor="#aaa"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </FormField>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ─── Sticky bottom bar ─── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: isEditMode ? ACCENT : PRIMARY },
              !isFormValid && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isEditMode ? 'checkmark-circle' : 'add-circle'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.submitBtnText}>
                  {isEditMode ? 'Enregistrer' : 'Créer le client'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Reusable form field ─────────────────────────────────────────

interface FormFieldProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  required?: boolean;
  focused: boolean;
  valid: boolean;
  error: string | null;
  children: React.ReactNode;
}

function FormField({
  icon,
  label,
  hint,
  required,
  focused,
  valid,
  error,
  children,
}: FormFieldProps) {
  const borderColor = error ? DANGER : focused ? PRIMARY : '#e0e0e0';

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {valid && !error && (
          <Ionicons name="checkmark-circle" size={16} color={SUCCESS} />
        )}
      </View>
      <View style={[styles.inputWrap, { borderColor }]}>
        <View style={styles.inputIcon}>
          <Ionicons
            name={icon}
            size={18}
            color={error ? DANGER : focused ? PRIMARY : '#999'}
          />
        </View>
        {children}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PRIMARY },
  kbAvoid: { flex: 1, backgroundColor: '#f5f7fa' },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
  },
  avatarMeta: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Info card
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565c0',
    lineHeight: 18,
  },
  infoBold: { fontWeight: '700' },

  // Form
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  field: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.2,
  },
  required: { color: DANGER },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    paddingLeft: 14,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: 15,
    color: '#333',
  },
  hintText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  errorText: {
    fontSize: 11,
    color: DANGER,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 14 : 18,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
