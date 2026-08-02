/**
 * UpsellModal — Modal riche d'upsell déclenchée par le gate abonnement (402).
 *
 * Remplace l'ancien {@code Alert.alert} natif de l'intercepteur 402 (api.ts).
 * Écoute {@link subscriptionUpsellBus} : quand le backend renvoie un 402
 * {@code SubscriptionGateResponse}, on affiche le plan requis, le message
 * backend et un CTA « Voir les offres » vers /(epicier)/mon-abonnement.
 *
 * À monter une seule fois au niveau racine (cf app/_layout.tsx), sous les
 * providers Langue + SafeArea. N'affiche rien tant qu'aucun gate n'est reçu.
 *
 * Les gardes (rôle EPICIER, hors polling de fond, tag __subscriptionGateHandled)
 * restent dans api.ts : ce composant se contente d'afficher ce qu'on lui émet.
 */

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import {
  subscriptionUpsellBus,
  type SubscriptionGateResponse,
} from '../../services/subscriptionUpsellBus';
import { planHumanName } from '../../utils/planLabels';

export function UpsellModal() {
  const { t } = useLanguage();
  const [gate, setGate] = useState<SubscriptionGateResponse | null>(null);

  useEffect(() => {
    const sub = subscriptionUpsellBus.on((payload) => setGate(payload ?? {}));
    return () => sub.remove();
  }, []);

  if (!gate) return null;

  const planLabel = gate.requiredPlan
    ? planHumanName(gate.requiredPlan)
    : t('apiErrors.planSuperior');

  const title = gate.requiredPlan
    ? t('apiErrors.upsellTitle', { plan: planLabel })
    : t('apiErrors.subscriptionBlockedTitle');

  const body = gate.message
    ?? t('apiErrors.subscriptionBlockedMessage', { plan: planLabel });

  const close = () => setGate(null);

  const goToOffers = () => {
    close();
    try {
      router.push('/(epicier)/mon-abonnement');
    } catch (e) {
      console.warn('[UpsellModal] redirect mon-abonnement failed:', e);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🔒</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Pressable
            onPress={goToOffers}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{t('apiErrors.seeOffers')}</Text>
          </Pressable>

          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={styles.laterText}>{t('apiErrors.later')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 30 },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  cta: {
    width: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  later: {
    marginTop: 6,
    paddingVertical: 12,
  },
  laterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
