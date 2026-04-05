// ============================================
// app/(auth)/login.tsx
// Écran de connexion avec comptes mémorisés
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AbridGOLogo from '../../src/components/shared/AbridGOLogo';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';

// ── Types ────────────────────────────────────────────────────────────────────

interface SavedAccount {
  login: string;
  nom: string;
  role: string;
  identifiant?: string;
}

interface QuickLink {
  icon: string;
  label: string;
  route: string;
}

const ROLE_QUICK_LINKS: Record<string, QuickLink[]> = {
  EPICIER: [
    { icon: '📋', label: 'Commandes',     route: '../(epicier)/commandes' },
    { icon: '👥', label: 'Clients',       route: '../(epicier)/clients-list' },
    { icon: '🛒', label: 'Vente directe', route: '../(epicier)/vente-directe' },
    { icon: '📦', label: 'Produits',      route: '../(epicier)/produits' },
  ],
  CLIENT: [
    { icon: '🏪', label: 'Épiceries',  route: '/(client)/epiceries' },
    { icon: '🛒', label: 'Panier',     route: '/(client)/cart' },
    { icon: '📋', label: 'Commandes',  route: '/(client)/commandes' },
  ],
  LIVREUR: [
    { icon: '🚗', label: 'Livraisons', route: '/(livreur)/deliveries' },
    { icon: '📜', label: 'Historique',  route: '/(livreur)/history' },
  ],
};

const SPACES = [
  { icon: '🏪', label: 'Espace Épicier', desc: 'Gérez vos produits, commandes et clients', color: '#2196F3' },
  { icon: '🛒', label: 'Espace Client',  desc: 'Commandez auprès de vos épiceries locales', color: '#4CAF50' },
  { icon: '🚗', label: 'Espace Livreur', desc: 'Acceptez et gérez vos livraisons',          color: '#FF9800' },
];

const SAVED_ACCOUNTS_KEY = 'saved_accounts';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = await loadSavedAccounts();
  const idx = accounts.findIndex(a => a.login === account.login);
  if (idx >= 0) accounts[idx] = account;
  else accounts.unshift(account);
  await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 5)));
}

async function removeAccount(login: string): Promise<SavedAccount[]> {
  const accounts = await loadSavedAccounts();
  const filtered = accounts.filter(a => a.login !== login);
  await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
  return filtered;
}

function getRoleLabel(r: string) { return r === 'EPICIER' ? 'Épicier' : r === 'CLIENT' ? 'Client' : r === 'LIVREUR' ? 'Livreur' : r; }
function getRoleColor(r: string) { return r === 'EPICIER' ? '#2196F3' : r === 'CLIENT' ? '#4CAF50' : r === 'LIVREUR' ? '#FF9800' : '#666'; }
function getInitial(n: string) { return (n || '?').charAt(0).toUpperCase(); }

// ── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const isIdentifiant = /^AL\d{5}$/.test(login.trim());

  useEffect(() => {
    loadSavedAccounts().then(accounts => {
      setSavedAccounts(accounts);
      if (accounts.length === 0) setShowForm(true);
    });
  }, []);

  const selectAccount = useCallback((account: SavedAccount) => {
    setLogin(account.login);
    setPassword('');
    setSelectedRole(account.role);
    setRedirectTarget(null);
    setShowForm(true);
  }, []);

  const handleRemoveAccount = useCallback((accountLogin: string) => {
    Alert.alert('Supprimer ce compte ?', 'L\'identifiant ne sera plus mémorisé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const remaining = await removeAccount(accountLogin);
        setSavedAccounts(remaining);
        if (remaining.length === 0) setShowForm(true);
      }},
    ]);
  }, []);

  const backToAccountList = useCallback(() => {
    setLogin('');
    setPassword('');
    setRedirectTarget(null);
    setSelectedRole(null);
    setShowForm(false);
  }, []);

  const handleLogin = async () => {
    const v = login.trim();
    if (!v || !password) { Alert.alert('Erreur', 'Veuillez remplir tous les champs'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !/^AL\d{5}$/.test(v)) {
      Alert.alert('Erreur', 'Saisissez un email valide ou un identifiant (ex: AL00001)'); return;
    }

    setLoading(true);
    try {
      const fcmToken = await pushNotificationService.getTokenForLogin();
      const userData = await authService.login(v, password, fcmToken);
      await saveAccount({ login: v, nom: userData.nom, role: userData.role, identifiant: userData.identifiant || undefined });
      await new Promise(resolve => setTimeout(resolve, 500));

      if (userData.mustChangePassword) { router.replace('/change-password'); return; }
      if (redirectTarget) { router.replace(redirectTarget as any); setRedirectTarget(null); }
      else if (userData.role === 'CLIENT') router.replace('/(client)');
      else if (userData.role === 'EPICIER') router.replace('../(epicier)/dashboard');
      else if (userData.role === 'LIVREUR') router.replace('/(livreur)/deliveries');
    } catch (error: any) {
      if (error.isUnverified) {
        Alert.alert('Compte non vérifié', error.message, [
          { text: 'Vérifier', onPress: () => router.push({ pathname: '/(auth)/verify-account', params: { email: error.email } }) },
          { text: 'Annuler', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Erreur', typeof error === 'string' ? error : 'Erreur de connexion');
      }
    } finally { setLoading(false); }
  };

  // ── Quick links for selected role ──
  const quickLinks = selectedRole ? (ROLE_QUICK_LINKS[selectedRole] || []) : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F3F7" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={s.logoWrap}>
          <AbridGOLogo size={180} />
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            ACCOUNT PICKER
        ════════════════════════════════════════════════════════════════════ */}
        {!showForm && savedAccounts.length > 0 && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Choisir un compte</Text>
              {savedAccounts.map(account => (
                <TouchableOpacity key={account.login} style={s.accountRow}
                  onPress={() => selectAccount(account)}
                  onLongPress={() => handleRemoveAccount(account.login)}
                  activeOpacity={0.6}
                >
                  <View style={[s.avatar, { backgroundColor: getRoleColor(account.role) }]}>
                    <Text style={s.avatarText}>{getInitial(account.nom)}</Text>
                  </View>
                  <View style={s.accountMid}>
                    <Text style={s.accountName} numberOfLines={1}>{account.nom}</Text>
                    <Text style={s.accountSub} numberOfLines={1}>{account.identifiant || account.login}</Text>
                  </View>
                  <View style={[s.rolePill, { backgroundColor: getRoleColor(account.role) + '15' }]}>
                    <Text style={[s.rolePillText, { color: getRoleColor(account.role) }]}>{getRoleLabel(account.role)}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <View style={s.sep}><View style={s.sepLine} /><Text style={s.sepText}>ou</Text><View style={s.sepLine} /></View>

              <TouchableOpacity style={s.otherBtn} onPress={() => { setLogin(''); setSelectedRole(null); setShowForm(true); }} activeOpacity={0.6}>
                <Text style={s.otherBtnText}>+ Autre compte</Text>
              </TouchableOpacity>
            </View>

            {/* Spaces */}
            <View style={s.card}>
              <Text style={s.sectionLabel}>Une app, trois espaces</Text>
              {SPACES.map(sp => (
                <View key={sp.label} style={s.spaceRow}>
                  <View style={[s.spaceIcon, { backgroundColor: sp.color + '12' }]}><Text style={{ fontSize: 18 }}>{sp.icon}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.spaceName, { color: sp.color }]}>{sp.label}</Text>
                    <Text style={s.spaceDesc}>{sp.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            LOGIN FORM
        ════════════════════════════════════════════════════════════════════ */}
        {showForm && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Connexion</Text>

              <TextInput style={s.input} placeholder="Identifiant (AL00001) ou Email"
                placeholderTextColor="#aaa" value={login} onChangeText={setLogin}
                keyboardType={isIdentifiant ? 'default' : 'email-address'}
                autoCapitalize="none" autoCorrect={false} />

              <TextInput style={s.input} placeholder="Mot de passe"
                placeholderTextColor="#aaa" value={password} onChangeText={setPassword}
                secureTextEntry autoCapitalize="none" />

              <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.6 }]}
                onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.loginBtnText}>Se connecter</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={s.linkText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {savedAccounts.length > 0 && (
                <TouchableOpacity style={s.linkRow} onPress={backToAccountList}>
                  <Text style={[s.linkText, { color: '#2196F3' }]}>Mes comptes mémorisés</Text>
                </TouchableOpacity>
              )}

              <View style={s.sep}><View style={s.sepLine} /><Text style={s.sepText}>ou</Text><View style={s.sepLine} /></View>

              <TouchableOpacity style={s.registerBtn} onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
                <Text style={s.registerBtnText}>Créer un compte</Text>
              </TouchableOpacity>
            </View>

            {/* ── Quick access (if saved account selected) ── */}
            {quickLinks.length > 0 && (
              <View style={s.card}>
                <Text style={s.sectionLabel}>Accès rapide</Text>
                {quickLinks.map(link => {
                  const color = getRoleColor(selectedRole!);
                  const active = redirectTarget === link.route;
                  return (
                    <TouchableOpacity key={link.route} activeOpacity={0.6}
                      style={[s.quickRow, active && { backgroundColor: color + '10', borderColor: color + '35' }]}
                      onPress={() => setRedirectTarget(active ? null : link.route)}
                    >
                      <Text style={{ fontSize: 17, marginRight: 12 }}>{link.icon}</Text>
                      <Text style={s.quickLabel}>{link.label}</Text>
                      {active && <View style={[s.quickCheck, { backgroundColor: color }]}><Text style={s.quickCheckText}>✓</Text></View>}
                    </TouchableOpacity>
                  );
                })}
                <Text style={s.hint}>
                  {redirectTarget ? 'Redirection directe après connexion' : 'Optionnel — choisissez une destination'}
                </Text>
              </View>
            )}

            {/* ── Spaces (if new account / no role) ── */}
            {!selectedRole && (
              <View style={s.card}>
                <Text style={s.sectionLabel}>Une app, trois espaces</Text>
                {SPACES.map(sp => (
                  <View key={sp.label} style={s.spaceRow}>
                    <View style={[s.spaceIcon, { backgroundColor: sp.color + '12' }]}><Text style={{ fontSize: 18 }}>{sp.icon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.spaceName, { color: sp.color }]}>{sp.label}</Text>
                      <Text style={s.spaceDesc}>{sp.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F3F7',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },

  // Account rows
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fb',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  accountMid: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  accountSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Separators
  sep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  sepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ddd',
  },
  sepText: {
    marginHorizontal: 10,
    color: '#bbb',
    fontSize: 13,
  },

  // Buttons
  otherBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  otherBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },

  // Form
  input: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
    color: '#222',
  },
  loginBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  linkText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  registerBtn: {
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  registerBtnText: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '700',
  },

  // Quick access
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    marginBottom: 6,
  },
  quickLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  quickCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCheckText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 6,
  },

  // Spaces
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#fafafa',
    marginBottom: 6,
  },
  spaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  spaceName: {
    fontSize: 13,
    fontWeight: '700',
  },
  spaceDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
});
