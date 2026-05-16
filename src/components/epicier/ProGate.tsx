/**
 * ProGate — Garde-fou UI pour les fonctionnalités payantes.
 *
 * Deux modes d'usage :
 *
 * <pre>
 * // 1. Mode "wrapper" — masque/désactive le contenu si la feature n'est
 * //    pas dans le plan, et affiche un badge "PRO 🔒" superposé.
 * &lt;ProGate feature="hasCsvImport"&gt;
 *   &lt;Button title="Importer CSV" .../&gt;
 * &lt;/ProGate&gt;
 *
 * // 2. Mode "badge inline" — affiche juste un petit badge "PRO" à côté
 * //    d'un label, utile dans les listes de menu.
 * &lt;ProBadgeInline feature="hasLoyalty" /&gt;
 * </pre>
 *
 * Au tap sur le verrou, redirige vers /mon-abonnement.
 */

import { useRouter } from 'expo-router';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type SubscriptionFeature, useSubscription } from '../../hooks/useSubscription';

interface ProGateProps {
  feature: SubscriptionFeature;
  children: ReactNode;
  /** Si true, masque complètement les enfants quand la feature n'est pas
   * dans le plan. Sinon, affiche les enfants grisés avec un overlay. */
  hideWhenLocked?: boolean;
}

export function ProGate({ feature, children, hideWhenLocked }: ProGateProps) {
  const { hasFeature, loading } = useSubscription();
  const router = useRouter();

  if (loading) return <>{children}</>; // pas encore chargé → laisse passer
  if (hasFeature(feature)) return <>{children}</>;
  if (hideWhenLocked) return null;

  return (
    <View style={styles.gateContainer}>
      <View style={styles.disabledChild}>{children}</View>
      <Pressable
        onPress={() => router.push('/(epicier)/mon-abonnement')}
        style={styles.overlay}
      >
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockLabel}>PRO</Text>
      </Pressable>
    </View>
  );
}

/** Petit badge "PRO" affichable à côté d'un texte. Pas de gating ici —
 * c'est purement informatif, pour les éléments de menu/liste. */
export function ProBadgeInline({ feature }: { feature: SubscriptionFeature }) {
  const { hasFeature, loading } = useSubscription();
  if (loading || hasFeature(feature)) return null;
  return (
    <View style={styles.inlineBadge}>
      <Text style={styles.inlineBadgeText}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gateContainer: {
    position: 'relative',
  },
  disabledChild: {
    opacity: 0.35,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderRadius: 8,
  },
  lockIcon: {
    fontSize: 14,
  },
  lockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  inlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
  },
  inlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
