export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Notification preferences — UX moderne et attractive.
 *
 * Design :
 *  - Header avec icône proéminente
 *  - Cards de famille avec icône colorée par famille (cohérent avec
 *    presentation.ts)
 *  - Section "essentielles" avec design verrouillé (cadenas + couleur grise)
 *  - Section "optionnelles" avec switches stylisés Material
 *  - Stats summary en haut : "8 actives sur 10"
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenState } from '../../src/components/shared/ScreenState';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  CRITICAL_FAMILIES,
  type NotificationPreferences,
  notificationPreferencesService,
} from '../../src/services/notifications';
import type { NotificationFamily } from '../../src/services/notifications';

const PRIMARY = '#4CAF50';

interface FamilyMeta {
  family: NotificationFamily;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  titleKey: string;
  descriptionKey: string;
  defaultTitle: string;
  defaultDescription: string;
}

const FAMILIES: FamilyMeta[] = [
  // Essentielles
  {
    family: 'ORDER',
    icon: 'cube-outline',
    color: '#1565c0',
    bgColor: '#e3f2fd',
    titleKey: 'notifPrefs.order.title',
    descriptionKey: 'notifPrefs.order.description',
    defaultTitle: 'Commandes',
    defaultDescription: 'Confirmation, préparation et statut',
  },
  {
    family: 'DELIVERY',
    icon: 'bicycle-outline',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    titleKey: 'notifPrefs.delivery.title',
    descriptionKey: 'notifPrefs.delivery.description',
    defaultTitle: 'Livraison',
    defaultDescription: 'Suivi en temps réel de vos livraisons',
  },
  {
    family: 'INVITATION',
    icon: 'mail-outline',
    color: '#d84315',
    bgColor: '#fbe9e7',
    titleKey: 'notifPrefs.invitation.title',
    descriptionKey: 'notifPrefs.invitation.description',
    defaultTitle: 'Invitations',
    defaultDescription: "Invitations d'épiceries pour devenir client",
  },
  {
    family: 'PAYMENT',
    icon: 'card-outline',
    color: '#283593',
    bgColor: '#e8eaf6',
    titleKey: 'notifPrefs.payment.title',
    descriptionKey: 'notifPrefs.payment.description',
    defaultTitle: 'Paiements & factures',
    defaultDescription: 'Paiements reçus, factures et mises à jour',
  },
  // Optionnelles
  {
    family: 'PROMOTION',
    icon: 'pricetag-outline',
    color: '#e65100',
    bgColor: '#fff3e0',
    titleKey: 'notifPrefs.promotion.title',
    descriptionKey: 'notifPrefs.promotion.description',
    defaultTitle: 'Promotions',
    defaultDescription: 'Offres et réductions des épiceries',
  },
  {
    family: 'LOYALTY',
    icon: 'star-outline',
    color: '#f57f17',
    bgColor: '#fff8e1',
    titleKey: 'notifPrefs.loyalty.title',
    descriptionKey: 'notifPrefs.loyalty.description',
    defaultTitle: 'Fidélité',
    defaultDescription: 'Points gagnés et récompenses',
  },
  {
    family: 'CART',
    icon: 'cart-outline',
    color: '#5d4037',
    bgColor: '#efebe9',
    titleKey: 'notifPrefs.cart.title',
    descriptionKey: 'notifPrefs.cart.description',
    defaultTitle: 'Rappels de panier',
    defaultDescription: "Rappel des articles laissés dans votre panier",
  },
  {
    family: 'CHAT',
    icon: 'chatbubble-ellipses-outline',
    color: '#00695c',
    bgColor: '#e0f2f1',
    titleKey: 'notifPrefs.chat.title',
    descriptionKey: 'notifPrefs.chat.description',
    defaultTitle: 'Messages',
    defaultDescription: 'Réponses du chatbot',
  },
  {
    family: 'EPICERIE',
    icon: 'storefront-outline',
    color: '#00838f',
    bgColor: '#e0f7fa',
    titleKey: 'notifPrefs.epicerie.title',
    descriptionKey: 'notifPrefs.epicerie.description',
    defaultTitle: 'Mises à jour épiceries',
    defaultDescription: 'Nouveautés des épiceries que vous suivez',
  },
  {
    family: 'INFO',
    icon: 'information-circle-outline',
    color: '#6a1b9a',
    bgColor: '#f3e5f5',
    titleKey: 'notifPrefs.info.title',
    descriptionKey: 'notifPrefs.info.description',
    defaultTitle: 'Informations générales',
    defaultDescription: 'Annonces et messages informatifs',
  },
];

export default function NotificationPreferencesScreen() {
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingFamily, setUpdatingFamily] = useState<NotificationFamily | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const prefs = await notificationPreferencesService.get();
      setPreferences(prefs);
    } catch (error) {
      console.error('[NotifPrefs] Erreur chargement:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  const handleToggle = async (family: NotificationFamily) => {
    if (!preferences) return;
    if (CRITICAL_FAMILIES.has(family)) return;

    const previousValue = preferences[family];
    const nextValue = !previousValue;

    setPreferences({ ...preferences, [family]: nextValue });
    setUpdatingFamily(family);

    const success = await notificationPreferencesService.update(family, nextValue);

    if (!success) {
      setPreferences({ ...preferences, [family]: previousValue });
      Alert.alert(
        t('common.error') || 'Erreur',
        t('notifPrefs.updateError') || 'Impossible de mettre à jour la préférence'
      );
    }

    setUpdatingFamily(null);
  };

  const tr = (key: string, fallback: string) => {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
  };

  const optionalItems = useMemo(
    () => FAMILIES.filter(f => !CRITICAL_FAMILIES.has(f.family)),
    []
  );
  const criticalItems = useMemo(
    () => FAMILIES.filter(f => CRITICAL_FAMILIES.has(f.family)),
    []
  );

  const activeOptionalCount = useMemo(() => {
    if (!preferences) return 0;
    return optionalItems.filter(f => preferences[f.family]).length;
  }, [preferences, optionalItems]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  // Erreur réseau: écran dédié avec « Réessayer » plutôt qu'un spinner infini.
  if (error || !preferences) {
    return <ScreenState variant="error" onRetry={loadPreferences} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <View style={styles.heroIcon}>
              <Ionicons name="notifications" size={32} color="#fff" />
            </View>
          </View>
          <Text style={styles.heroTitle}>
            {tr('notifPrefs.title', 'Préférences de notifications')}
          </Text>
          <Text style={styles.heroSubtitle}>
            {tr(
              'notifPrefs.subtitle',
              'Choisissez les notifications que vous souhaitez recevoir.'
            )}
          </Text>

          {/* Active counter pill */}
          <View style={styles.heroPill}>
            <Ionicons name="checkmark-circle" size={14} color={PRIMARY} />
            <Text style={styles.heroPillText}>
              {activeOptionalCount}/{optionalItems.length} catégories actives
            </Text>
          </View>
        </View>

        {/* Critical section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="lock-closed" size={14} color="#888" />
          <Text style={styles.sectionTitle}>
            {tr('notifPrefs.criticalSection', 'Notifications essentielles')}
          </Text>
        </View>
        <Text style={styles.sectionDescription}>
          {tr(
            'notifPrefs.criticalDescription',
            'Indispensables — toujours actives.'
          )}
        </Text>
        <View style={styles.list}>
          {criticalItems.map(meta => (
            <PreferenceCard
              key={meta.family}
              meta={meta}
              tr={tr}
              locked
            />
          ))}
        </View>

        <View style={{ height: 24 }} />

        {/* Optional section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="options-outline" size={14} color="#888" />
          <Text style={styles.sectionTitle}>
            {tr('notifPrefs.optionalSection', 'Notifications optionnelles')}
          </Text>
        </View>
        <Text style={styles.sectionDescription}>
          {tr(
            'notifPrefs.optionalDescription',
            'Activez ou désactivez selon vos préférences.'
          )}
        </Text>
        <View style={styles.list}>
          {optionalItems.map(meta => (
            <PreferenceCard
              key={meta.family}
              meta={meta}
              tr={tr}
              enabled={preferences[meta.family]}
              updating={updatingFamily === meta.family}
              onToggle={() => handleToggle(meta.family)}
            />
          ))}
        </View>

        {/* Footer hint */}
        <View style={styles.footerCard}>
          <Ionicons name="bulb-outline" size={18} color={PRIMARY} />
          <Text style={styles.footerText}>
            {tr(
              'notifPrefs.androidHint',
              "Astuce : sur Android, vous pouvez aussi gérer chaque catégorie depuis les paramètres système."
            )}
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Preference Card ───────────────────────────────────────────

interface PreferenceCardProps {
  meta: FamilyMeta;
  tr: (key: string, fallback: string) => string;
  locked?: boolean;
  enabled?: boolean;
  updating?: boolean;
  onToggle?: () => void;
}

function PreferenceCard({
  meta,
  tr,
  locked,
  enabled = true,
  updating,
  onToggle,
}: PreferenceCardProps) {
  const dimmed = !locked && !enabled;

  return (
    <View style={[styles.card, dimmed && styles.cardDimmed]}>
      <View style={[styles.cardIcon, { backgroundColor: meta.bgColor }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, dimmed && styles.dimmedText]}>
          {tr(meta.titleKey, meta.defaultTitle)}
        </Text>
        <Text style={[styles.cardDescription, dimmed && styles.dimmedText]}>
          {tr(meta.descriptionKey, meta.defaultDescription)}
        </Text>
      </View>
      <View style={styles.cardAction}>
        {locked ? (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={14} color="#999" />
          </View>
        ) : updating ? (
          <ActivityIndicator size="small" color={PRIMARY} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: '#ddd', true: '#a5d6a7' }}
            thumbColor={enabled ? PRIMARY : '#fff'}
            ios_backgroundColor="#ddd"
          />
        )}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PRIMARY },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f7fa',
  },

  scroll: { flex: 1, backgroundColor: '#f5f7fa' },
  scrollContent: { paddingBottom: 30 },

  // Hero
  hero: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconWrap: {
    marginBottom: 12,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionDescription: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 16,
  },

  // List of cards
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardDimmed: {
    backgroundColor: '#fafafa',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  dimmedText: { opacity: 0.55 },
  cardAction: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer hint
  footerCard: {
    flexDirection: 'row',
    gap: 10,
    margin: 16,
    marginTop: 24,
    padding: 14,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#2e7d32',
    lineHeight: 17,
  },
});
