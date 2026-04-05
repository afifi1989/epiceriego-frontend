import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { STORAGE_KEYS } from '../../src/constants/config';
import { getUserProfile, usePermissions } from '../../src/hooks/usePermissions';
import { authService } from '../../src/services/authService';
import { profileService } from '../../src/services/profileService';
import { LoginResponse, User } from '../../src/type';

// Configuration visuelle par rôle
const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  owner:        { label: 'Propriétaire', color: '#2196F3', icon: '👑' },
  manager:      { label: 'Manager',      color: '#9C27B0', icon: '🔑' },
  gestionnaire: { label: 'Gestionnaire', color: '#FF9800', icon: '📋' },
  caissier:     { label: 'Caissier',     color: '#4CAF50', icon: '🏪' },
};

export default function ProfilScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const { can } = usePermissions(loginData);

  // ── Modal : modifier informations ────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ nom: '', telephone: '' });
  const [saving, setSaving] = useState(false);

  // ── Modal : changer mot de passe ─────────────────────────────────────────────
  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (raw) setLoginData(JSON.parse(raw));

      const user = await profileService.getMyProfile();
      setUserProfile(user);
      setEditForm({ nom: user.nom || '', telephone: user.telephone || '' });
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ── Enregistrer les modifications du profil ───────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editForm.nom.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }
    setSaving(true);
    try {
      const updated = await profileService.updateProfile({
        nom: editForm.nom,
        telephone: editForm.telephone || undefined,
      });
      setUserProfile(updated);

      // Mettre à jour le nom dans AsyncStorage
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (raw) {
        const ld = JSON.parse(raw);
        ld.nom = updated.nom;
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(ld));
        setLoginData({ ...ld });
      }

      setShowEdit(false);
      Alert.alert('✅ Succès', 'Vos informations ont été mises à jour');
    } catch (e: any) {
      Alert.alert('Erreur', String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Changer le mot de passe ───────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    setPwdLoading(true);
    try {
      await profileService.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
      setShowPwd(false);
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('✅ Succès', 'Mot de passe modifié avec succès');
    } catch (e: any) {
      Alert.alert('Erreur', String(e));
    } finally {
      setPwdLoading(false);
    }
  };

  // ── Déconnexion ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => {
          try {
            await authService.logout();
            router.replace('/(auth)/login');
          } catch {
            router.replace('/(auth)/login');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const profile = getUserProfile(loginData);
  const roleConf = ROLE_CONFIG[profile] ?? ROLE_CONFIG.caissier;
  const displayName = userProfile?.nom || loginData?.nom || 'Utilisateur';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: roleConf.color }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{displayName}</Text>
        {loginData?.identifiant && (
          <Text style={[styles.userEmail, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700', fontSize: 15, color: '#fff', letterSpacing: 2 }]}>
            {loginData.identifiant}
          </Text>
        )}
        <Text style={styles.userEmail}>{loginData?.email || ''}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{roleConf.icon} {roleConf.label}</Text>
        </View>
      </View>

      {/* ── Informations personnelles ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mes informations</Text>
        <View style={styles.card}>
          {loginData?.identifiant && (
            <InfoRow icon="🆔" label="Identifiant" value={loginData.identifiant} />
          )}
          <InfoRow icon="👤" label="Nom" value={userProfile?.nom} />
          <InfoRow icon="📧" label="Email" value={loginData?.email} />
          <InfoRow icon="📱" label="Téléphone" value={userProfile?.telephone} last />
        </View>
      </View>

      {/* ── Mon compte ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon compte</Text>

        <ActionButton
          icon="✏️"
          label="Modifier mes informations"
          onPress={() => {
            setEditForm({ nom: userProfile?.nom || '', telephone: userProfile?.telephone || '' });
            setShowEdit(true);
          }}
        />

        <ActionButton
          icon="🔐"
          label="Changer mon mot de passe"
          onPress={() => {
            setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
            setShowPwd(true);
          }}
        />

        {/* Lien vers l'épicerie — propriétaire uniquement */}
        {can('settings:edit') && (
          <ActionButton
            icon="🏪"
            label="Mon épicerie"
            onPress={() => router.push('/(epicier)/profil-epicerie')}
            accent={roleConf.color}
          />
        )}

        {/* Collaborateurs */}
        {can('collaborateurs:view') && (
          <ActionButton
            icon="👥"
            label="Collaborateurs"
            onPress={() => router.push('/(epicier)/collaborateurs')}
          />
        )}
      </View>

      {/* ── Déconnexion ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>AbridGO Épicier v1.0.0</Text>
      </View>

      {/* ════════════════════════════════════════════════
          Modal — Modifier informations
      ════════════════════════════════════════════════ */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Modifier mes informations</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Nom complet *</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.nom}
              onChangeText={v => setEditForm(f => ({ ...f, nom: v }))}
              placeholder="Votre nom"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.telephone}
              onChangeText={v => setEditForm(f => ({ ...f, telephone: v }))}
              placeholder="0612345678"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════
          Modal — Changer mot de passe
      ════════════════════════════════════════════════ */}
      <Modal visible={showPwd} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Changer mon mot de passe</Text>
              <TouchableOpacity onPress={() => setShowPwd(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Mot de passe actuel *</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={styles.pwdInput}
                value={pwdForm.oldPassword}
                onChangeText={v => setPwdForm(f => ({ ...f, oldPassword: v }))}
                placeholder="••••••••"
                placeholderTextColor="#aaa"
                secureTextEntry={!showOld}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowOld(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showOld ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Nouveau mot de passe *</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={styles.pwdInput}
                value={pwdForm.newPassword}
                onChangeText={v => setPwdForm(f => ({ ...f, newPassword: v }))}
                placeholder="Minimum 8 caractères"
                placeholderTextColor="#aaa"
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showNew ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Confirmer le nouveau mot de passe *</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={styles.pwdInput}
                value={pwdForm.confirmPassword}
                onChangeText={v => setPwdForm(f => ({ ...f, confirmPassword: v }))}
                placeholder="Répétez le mot de passe"
                placeholderTextColor="#aaa"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, pwdLoading && styles.submitBtnDisabled]}
              onPress={handleChangePassword}
              disabled={pwdLoading}
            >
              {pwdLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Confirmer</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

// ── Composants internes ───────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, last = false,
}: { icon: string; label: string; value?: string | null; last?: boolean }) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{icon} {label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
      {!last && <View style={styles.divider} />}
    </>
  );
}

function ActionButton({
  icon, label, onPress, accent,
}: { icon: string; label: string; onPress: () => void; accent?: string }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, accent && { borderLeftWidth: 4, borderLeftColor: accent }]}
      onPress={onPress}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f6fa' },

  // Header
  header: { padding: 30, paddingTop: 45, alignItems: 'center' },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarInitial: { fontSize: 40, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 10, letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    marginBottom: 4,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  infoLabel: { fontSize: 14, color: '#666', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#1a1a2e', fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 10 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },

  // Action button
  actionBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  actionIcon: { fontSize: 22, marginRight: 14 },
  actionLabel: { flex: 1, fontSize: 15, color: '#1a1a2e', fontWeight: '500' },
  chevron: { fontSize: 22, color: '#ccc' },

  // Logout
  logoutBtn: {
    margin: 16, marginTop: 24,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: '#f44336',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  logoutText: { fontSize: 15, color: '#f44336', fontWeight: '700' },

  footer: { paddingBottom: 24, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#bbb' },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  sheetScroll: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    flexGrow: 1, justifyContent: 'flex-end',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  closeBtn: { fontSize: 22, color: '#999', padding: 4 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: '#fafafa', marginBottom: 16, color: '#1a1a2e',
  },

  pwdRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    backgroundColor: '#fafafa', marginBottom: 16, paddingHorizontal: 12,
  },
  pwdInput: { flex: 1, height: 48, fontSize: 15, color: '#1a1a2e' },
  eyeBtn: { padding: 8 },
  eyeText: { fontSize: 18 },

  submitBtn: {
    backgroundColor: '#2196F3', borderRadius: 12,
    height: 50, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
