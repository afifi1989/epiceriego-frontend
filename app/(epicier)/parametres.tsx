export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Hub paramètres unifié — épicier mobile.
 *
 * <p>Centralise tous les paramètres et configurations en une seule entrée
 * navigable, en remplacement de l'éparpillement entre profil, profil-epicerie,
 * dashboard "Plus", etc.</p>
 *
 * <p>Architecture : 8 cartes par catégorie, chaque carte est un lien vers
 * l'écran dédié existant (zéro refonte des écrans en question, on les
 * réutilise tels quels). Cartes filtrées par permission pour qu'un
 * caissier ne voie que ce qu'il peut configurer.</p>
 *
 * <p>UI épicier mobile en français uniquement.</p>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../src/constants/config';
import { usePermissions, Feature } from '../../src/hooks/usePermissions';
import { useSubscription, type SubscriptionFeature } from '../../src/hooks/useSubscription';
import { ProBadgeInline } from '../../src/components/epicier/ProGate';
import { LoginResponse } from '../../src/type';

interface SettingCard {
  icon: string;
  iconColor: string;
  bg: string;
  title: string;
  description: string;
  route: string;
  /** Permission requise pour afficher la carte. undefined = visible pour tous. */
  feature?: Feature;
  /**
   * Feature payante requise (plan). Si définie et absente du plan : la carte
   * affiche un badge « PRO 🔒 » et le tap redirige vers l'upsell au lieu
   * d'ouvrir l'écran verrouillé. Indépendant de `feature` (permission collab).
   */
  proFeature?: SubscriptionFeature;
}

export default function ParametresHubScreen() {
  const router = useRouter();
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const { can } = usePermissions(loginData);
  const { hasFeature } = useSubscription();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) setLoginData(JSON.parse(raw));
    });
  }, []);

  const cards: SettingCard[] = [
    {
      icon: '🏪',
      iconColor: '#1976D2',
      bg: '#E3F2FD',
      title: 'Épicerie',
      description: 'Nom, adresse, photos, description',
      route: '/(epicier)/modifier-infos',
      feature: 'settings:edit',
    },
    {
      icon: '⏰',
      iconColor: '#7B1FA2',
      bg: '#F3E5F5',
      title: 'Horaires d\'ouverture',
      description: 'Configurer les créneaux par jour',
      route: '/(epicier)/horaires',
      feature: 'settings:edit',
    },
    {
      icon: '🚚',
      iconColor: '#388E3C',
      bg: '#E8F5E9',
      title: 'Livraison',
      description: 'Zones, prix et types de livraison',
      route: '/(epicier)/parametres-epicerie?section=DELIVERY',
      feature: 'settings:edit',
    },
    {
      icon: '💳',
      iconColor: '#F57C00',
      bg: '#FFF3E0',
      title: 'Caisse & Imprimante',
      description: 'Session de caisse, tickets, paramètres impression',
      route: '/(epicier)/printer-settings',
      feature: 'settings:edit',
    },
    {
      icon: '🗄️',
      iconColor: '#2C7BD0',
      bg: '#E3F0FB',
      title: 'Caisses',
      description: 'Gérer vos registres (multi-caisse) et la caisse de ce poste',
      route: '/(epicier)/caisses',
      feature: 'settings:edit',
    },
    {
      icon: '💬',
      iconColor: '#25D366',
      bg: '#E0F7E9',
      title: 'WhatsApp Business',
      description: 'Activation, message de bienvenue, auto-accept',
      route: '/(epicier)/whatsapp-settings',
      feature: 'settings:edit',
      proFeature: 'hasWhatsapp',
    },
    {
      icon: '⭐',
      iconColor: '#F57F17',
      bg: '#FFF8E1',
      title: 'Programme de fidélité',
      description: 'Points, tampons, récompenses clients',
      route: '/(epicier)/fidelite',
      feature: 'settings:edit',
      proFeature: 'hasLoyalty',
    },
    {
      icon: '🔍',
      iconColor: '#0288D1',
      bg: '#E1F5FE',
      title: 'Recherche & synonymes',
      description: 'Mots-clés darija/français pour la caisse',
      route: '/(epicier)/mots-cles-recherche',
      feature: 'synonyms:manage',
    },
    {
      icon: '👥',
      iconColor: '#C2185B',
      bg: '#FCE4EC',
      title: 'Équipe',
      description: 'Collaborateurs et rôles',
      route: '/(epicier)/collaborateurs',
      feature: 'collaborateurs:view',
    },
  ];

  // Si le user n'a aucune permission (cas extrême), on affiche la grille
  // mais sans contenu — préférable à un crash. Le filtre par feature gère
  // les autres cas.
  const visibleCards = cards.filter(c => !c.feature || can(c.feature));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Tout pour configurer votre épicerie au même endroit.
        </Text>

        {visibleCards.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyText}>
              Aucun paramètre disponible avec votre rôle actuel.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visibleCards.map(card => {
              // Verrou plan : la carte reste visible (découverte de la feature)
              // mais le tap redirige vers l'upsell tant que le plan ne l'inclut pas.
              const locked = !!card.proFeature && !hasFeature(card.proFeature);
              return (
                <TouchableOpacity
                  key={card.route}
                  style={styles.card}
                  onPress={() =>
                    locked
                      ? router.push('/(epicier)/mon-abonnement')
                      : router.push(card.route as any)
                  }
                  activeOpacity={0.85}
                >
                  <View style={[styles.iconBox, { backgroundColor: card.bg }]}>
                    <Text style={styles.icon}>{card.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      {card.proFeature && <ProBadgeInline feature={card.proFeature} />}
                    </View>
                    <Text style={styles.cardDescription}>{card.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#bdbdbd" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Lien aide en bas */}
        <TouchableOpacity
          style={styles.helpLink}
          onPress={() => router.push('/(epicier)/aide-support' as any)}
        >
          <Ionicons name="help-circle-outline" size={20} color="#1976d2" />
          <Text style={styles.helpText}>Besoin d'aide ? Consulter le support</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },
  intro: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  grid: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  emptyBlock: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  helpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
});
