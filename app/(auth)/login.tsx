// ============================================
// app/(auth)/login.tsx
// Écran de connexion avec comptes mémorisés et rôle pré-sélectionné
// ============================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import { signInWithGoogle, isGoogleCancelError } from '../../src/services/googleAuthService';
import { epicerieService } from '../../src/services/epicerieService';
import { onboardingService } from '../../src/services/onboardingService';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'CLIENT' | 'EPICIER' | 'LIVREUR';

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

const ROLE_META: Record<Role, { label: string; icon: string; color: string; tagline: string }> = {
  CLIENT:  { label: 'Espace Client',  icon: '🛒', color: '#4CAF50', tagline: 'Commandez auprès de vos épiceries' },
  EPICIER: { label: 'Espace Épicier', icon: '🏪', color: '#2196F3', tagline: 'Gérez votre boutique au quotidien' },
  LIVREUR: { label: 'Espace Livreur', icon: '🚗', color: '#FF9800', tagline: 'Acceptez et gérez vos livraisons' },
};

const SAVED_ACCOUNTS_KEY = 'saved_accounts';

function isValidRole(r: any): r is Role {
  return r === 'CLIENT' || r === 'EPICIER' || r === 'LIVREUR';
}

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
  const params = useLocalSearchParams<{ role?: string }>();

  /**
   * Rôle verrouillé par la query param venant de la page select-role.
   * Null = l'utilisateur a ouvert les "comptes enregistrés" directement,
   * aucun filtre par rôle n'est appliqué.
   */
  const lockedRole: Role | null = useMemo(
    () => (isValidRole(params.role) ? params.role : null),
    [params.role]
  );

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  /** Rôle effectif utilisé pour l'UI et pour expectedRole côté API. */
  const [selectedRole, setSelectedRole] = useState<string | null>(lockedRole);

  const isIdentifiant = /^AL\d{5}$/.test(login.trim());
  const primaryColor = selectedRole ? getRoleColor(selectedRole) : '#4CAF50';
  const roleMeta = lockedRole ? ROLE_META[lockedRole] : null;

  // Charge les comptes et filtre par rôle verrouillé
  useEffect(() => {
    loadSavedAccounts().then(accounts => {
      const filtered = lockedRole ? accounts.filter(a => a.role === lockedRole) : accounts;
      setSavedAccounts(filtered);
      if (filtered.length === 0) setShowForm(true);
    });
  }, [lockedRole]);

  // Synchronise selectedRole avec lockedRole
  useEffect(() => {
    if (lockedRole) setSelectedRole(lockedRole);
  }, [lockedRole]);

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
        const all = await removeAccount(accountLogin);
        const visible = lockedRole ? all.filter(a => a.role === lockedRole) : all;
        setSavedAccounts(visible);
        if (visible.length === 0) setShowForm(true);
      }},
    ]);
  }, [lockedRole]);

  const backToAccountList = useCallback(() => {
    setLogin('');
    setPassword('');
    setRedirectTarget(null);
    // Si le rôle est verrouillé par l'URL, on ne le relâche pas
    if (!lockedRole) setSelectedRole(null);
    setShowForm(false);
  }, [lockedRole]);

  const handleChangeSpace = useCallback(() => {
    router.replace('/(auth)/select-role');
  }, [router]);

  /**
   * Google Sign-In : récupère un idToken via la lib native, puis l'envoie au
   * backend qui find-or-create un user CLIENT et applique le device check.
   * Disponible uniquement pour le rôle CLIENT.
   */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const fcmToken = await pushNotificationService.getTokenForLogin();
      const outcome = await authService.loginWithGoogle(idToken, fcmToken);

      if (outcome.kind === 'deviceVerificationRequired') {
        router.replace({
          pathname: '/(auth)/verify-device' as any,
          params: {
            verificationToken: outcome.data.verificationToken,
            maskedEmail: outcome.data.maskedEmail,
            deviceLabel: outcome.data.deviceLabel || '',
          },
        });
        return;
      }
      const data = outcome.data;
      await saveAccount({ login: data.email, nom: data.nom, role: data.role });
      if (data.mustChangePassword) router.replace('/change-password');
      else if (data.role === 'CLIENT') router.replace('/(client)');
      else router.replace('/');
    } catch (err: any) {
      if (isGoogleCancelError(err)) {
        // L'utilisateur a fermé la modal Google — pas d'erreur à afficher
        return;
      }
      const msg = typeof err === 'string' ? err : err?.message || 'Erreur Google Sign-In';
      Alert.alert('Erreur', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePhoneOtpLogin = () => {
    router.push('/(auth)/phone-otp' as any);
  };

  const handleLogin = async () => {
    const v = login.trim();
    if (!v || !password) { Alert.alert('Erreur', 'Veuillez remplir tous les champs'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !/^AL\d{5}$/.test(v)) {
      Alert.alert('Erreur', 'Saisissez un email valide ou un identifiant (ex: AL00001)'); return;
    }

    setLoading(true);
    try {
      const fcmToken = await pushNotificationService.getTokenForLogin();
      // Le rôle attendu envoyé au backend : lockedRole en priorité, sinon celui du compte sélectionné
      const expectedRole = lockedRole ?? (selectedRole ?? null);
      const outcome = await authService.login(v, password, fcmToken, expectedRole);

      // Device pas trusted → écran verify-device
      if (outcome.kind === 'deviceVerificationRequired') {
        router.replace({
          // Cast : la route est ajoutée à .expo/types lors du prochain `npx expo start`
          pathname: '/(auth)/verify-device' as any,
          params: {
            verificationToken: outcome.data.verificationToken,
            maskedEmail: outcome.data.maskedEmail,
            deviceLabel: outcome.data.deviceLabel || '',
          },
        });
        return;
      }

      const userData = outcome.data;
      await saveAccount({ login: v, nom: userData.nom, role: userData.role, identifiant: userData.identifiant || undefined });

      if (userData.mustChangePassword) { router.replace('/change-password'); return; }

      // Pour EPICIER : vérifier l'onboarding AVANT redirection pour éviter
      // le flash dashboard → onboarding. Si l'onboarding n'est pas terminé,
      // on route directement vers /onboarding sans passer par le dashboard.
      // Le check est best-effort : en cas d'erreur API, on retombe sur le
      // comportement standard (le layout fera un second check au mount).
      if (userData.role === 'EPICIER') {
        let needsOnboarding = false;
        try {
          const epicerie = await epicerieService.getMyEpicerie();
          const status = await onboardingService.getStatus(epicerie.id);
          needsOnboarding = !status?.completed;
        } catch {
          // Service indisponible — fallback dashboard, le layout corrigera.
        }
        if (needsOnboarding) {
          router.replace('/(epicier)/onboarding');
        } else if (redirectTarget) {
          router.replace(redirectTarget as any);
          setRedirectTarget(null);
        } else {
          router.replace('/(epicier)/dashboard');
        }
        return;
      }

      if (redirectTarget) { router.replace(redirectTarget as any); setRedirectTarget(null); }
      else if (userData.role === 'CLIENT') router.replace('/(client)');
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
      <StatusBar barStyle="light-content" backgroundColor="#1B2A4A" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back to select-role ── */}
        <TouchableOpacity style={s.backBtn} onPress={handleChangeSpace} activeOpacity={0.7}>
          <Text style={s.backBtnText}>‹ Changer d'espace</Text>
        </TouchableOpacity>

        {/* ── Logo ── */}
        <View style={s.logoWrap}>
          <AbridGOLogo size={160} />
        </View>

        {/* ── Role badge (if locked) ── */}
        {roleMeta && (
          <View style={[s.roleBadge, { borderColor: roleMeta.color + '50', backgroundColor: roleMeta.color + '15' }]}>
            <Text style={s.roleBadgeIcon}>{roleMeta.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.roleBadgeTitle, { color: roleMeta.color }]}>{roleMeta.label}</Text>
              <Text style={s.roleBadgeTag}>{roleMeta.tagline}</Text>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ACCOUNT PICKER
        ════════════════════════════════════════════════════════════════════ */}
        {!showForm && savedAccounts.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {lockedRole ? 'Comptes enregistrés' : 'Choisir un compte'}
            </Text>
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

            <TouchableOpacity style={s.otherBtn} onPress={() => { setLogin(''); setShowForm(true); }} activeOpacity={0.6}>
              <Text style={s.otherBtnText}>+ Autre compte</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            LOGIN FORM
        ════════════════════════════════════════════════════════════════════ */}
        {showForm && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Connexion</Text>

              {/* ── Boutons auth alternative (CLIENT seulement) ── */}
              {selectedRole === 'CLIENT' && (
                <View style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[s.googleBtn, googleLoading && { opacity: 0.6 }]}
                    onPress={handleGoogleSignIn}
                    disabled={googleLoading || loading}
                    activeOpacity={0.7}
                  >
                    {googleLoading ? (
                      <ActivityIndicator color="#1B2A4A" size="small" />
                    ) : (
                      <>
                        <Text style={s.googleIcon}>G</Text>
                        <Text style={s.googleBtnText}>Continuer avec Google</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.phoneBtn}
                    onPress={handlePhoneOtpLogin}
                    disabled={loading || googleLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={s.phoneIcon}>📱</Text>
                    <Text style={s.phoneBtnText}>Connexion par téléphone</Text>
                  </TouchableOpacity>

                  <View style={s.sep}>
                    <View style={s.sepLine} />
                    <Text style={s.sepText}>ou par email</Text>
                    <View style={s.sepLine} />
                  </View>
                </View>
              )}

              <TextInput style={s.input} placeholder="Identifiant (AL00001) ou Email"
                placeholderTextColor="#aaa" value={login} onChangeText={setLogin}
                keyboardType={isIdentifiant ? 'default' : 'email-address'}
                autoCapitalize="none" autoCorrect={false} />

              <TextInput style={s.input} placeholder="Mot de passe"
                placeholderTextColor="#aaa" value={password} onChangeText={setPassword}
                secureTextEntry autoCapitalize="none" />

              <TouchableOpacity
                style={[s.loginBtn, { backgroundColor: primaryColor }, loading && { opacity: 0.6 }]}
                onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.loginBtnText}>Se connecter</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[s.linkText, { color: primaryColor }]}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {savedAccounts.length > 0 && (
                <TouchableOpacity style={s.linkRow} onPress={backToAccountList}>
                  <Text style={[s.linkText, { color: '#2196F3' }]}>Mes comptes mémorisés</Text>
                </TouchableOpacity>
              )}

              <View style={s.sep}><View style={s.sepLine} /><Text style={s.sepText}>ou</Text><View style={s.sepLine} /></View>

              <TouchableOpacity
                style={[s.registerBtn, { borderColor: primaryColor }]}
                // Le role choisi dans select-role est propage a register pour
                // eviter de redemander le type de compte (deja choisi a l'ecran
                // d'accueil). Fallback CLIENT si aucun role n'est en param.
                onPress={() => router.push({
                  pathname: '/(auth)/register',
                  params: { role: selectedRole ?? 'CLIENT' },
                })}
                activeOpacity={0.7}>
                <Text style={[s.registerBtnText, { color: primaryColor }]}>Créer un compte</Text>
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
    backgroundColor: '#1B2A4A',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // Back
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  backBtnText: {
    color: '#b8c4dd',
    fontSize: 14,
    fontWeight: '600',
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },

  // Role badge
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  roleBadgeIcon: { fontSize: 24, marginRight: 12 },
  roleBadgeTitle: { fontSize: 15, fontWeight: '700' },
  roleBadgeTag: { fontSize: 12, color: '#b8c4dd', marginTop: 2 },

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
    fontSize: 14,
    fontWeight: '600',
  },
  registerBtn: {
    borderWidth: 1.5,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  registerBtnText: {
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

  // ── Boutons Google + Phone (CLIENT only) ──────────────────────────────
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#dadce0',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 10,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    textAlign: 'center',
    lineHeight: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  googleBtnText: {
    color: '#1B2A4A',
    fontSize: 15,
    fontWeight: '600',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 4,
  },
  phoneIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  phoneBtnText: {
    color: '#1B2A4A',
    fontSize: 15,
    fontWeight: '600',
  },
});
