// ============================================
// app/(auth)/select-role.tsx
// Premier ecran : selection du type de compte
// ============================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import AbridGOLogo from '../../src/components/shared/AbridGOLogo';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'CLIENT' | 'EPICIER' | 'LIVREUR';

interface RoleCard {
  role: Role;
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface SavedAccount {
  login: string;
  nom: string;
  role: string;
  identifiant?: string;
}

const SAVED_ACCOUNTS_KEY = 'saved_accounts';

const ROLES: RoleCard[] = [
  {
    role: 'CLIENT',
    icon: '🛒',
    title: 'Espace Client',
    description: 'Commandez auprès de vos épiceries locales',
    color: '#4CAF50',
  },
  {
    role: 'EPICIER',
    icon: '🏪',
    title: 'Espace Épicier',
    description: 'Gérez vos produits, commandes et clients',
    color: '#2196F3',
  },
  {
    role: 'LIVREUR',
    icon: '🚗',
    title: 'Espace Livreur',
    description: 'Acceptez et gérez vos livraisons',
    color: '#FF9800',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function SelectRoleScreen() {
  const router = useRouter();
  const [savedAccountCount, setSavedAccountCount] = useState(0);

  const loadSavedAccounts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
      const accounts: SavedAccount[] = raw ? JSON.parse(raw) : [];
      setSavedAccountCount(accounts.length);
    } catch {
      setSavedAccountCount(0);
    }
  }, []);

  useEffect(() => {
    loadSavedAccounts();
  }, [loadSavedAccounts]);

  const handleSelectRole = useCallback(
    (role: Role) => {
      router.push({ pathname: '/(auth)/login', params: { role } });
    },
    [router]
  );

  const openAllSavedAccounts = useCallback(() => {
    // Ouvre le login SANS role → la page affichera la liste des comptes memorises
    // quel que soit leur role.
    router.push({ pathname: '/(auth)/login', params: {} });
  }, [router]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#1B2A4A" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={s.logoWrap}>
          <AbridGOLogo size={180} />
        </View>

        {/* ── Titre ── */}
        <View style={s.header}>
          <Text style={s.title}>Bienvenue</Text>
          <Text style={s.subtitle}>Choisissez votre espace pour continuer</Text>
        </View>

        {/* ── Cards roles ── */}
        <View style={s.cards}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.role}
              style={[s.card, { borderLeftColor: r.color }]}
              onPress={() => handleSelectRole(r.role)}
              activeOpacity={0.7}
            >
              <View style={[s.cardIconWrap, { backgroundColor: r.color + '15' }]}>
                <Text style={s.cardIcon}>{r.icon}</Text>
              </View>
              <View style={s.cardContent}>
                <Text style={[s.cardTitle, { color: r.color }]}>{r.title}</Text>
                <Text style={s.cardDesc}>{r.description}</Text>
              </View>
              <Text style={[s.cardArrow, { color: r.color }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Acces rapide aux comptes memorises (tous roles confondus) ── */}
        {savedAccountCount > 0 && (
          <TouchableOpacity
            style={s.savedLink}
            onPress={openAllSavedAccounts}
            activeOpacity={0.7}
          >
            <Text style={s.savedLinkText}>
              ↩  {savedAccountCount === 1
                ? 'Accéder à mon compte enregistré'
                : `Accéder à mes ${savedAccountCount} comptes enregistrés`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Footer info ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Une seule app, trois espaces.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B2A4A' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 12, paddingBottom: 32 },

  logoWrap: { alignItems: 'center', marginBottom: 24, marginTop: 8 },

  header: { alignItems: 'center', marginBottom: 28 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#b8c4dd',
    textAlign: 'center',
  },

  cards: { marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIcon: { fontSize: 26 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#7a8099', lineHeight: 16 },
  cardArrow: { fontSize: 28, fontWeight: '300', marginLeft: 8 },

  savedLink: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  savedLinkText: {
    color: '#b8c4dd',
    fontSize: 13,
    fontWeight: '600',
  },

  footer: { alignItems: 'center', marginTop: 8 },
  footerText: {
    color: '#7a8099',
    fontSize: 12,
  },
});
