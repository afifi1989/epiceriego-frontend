/**
 * StepClients — Étape (optionnelle) : invitation des premiers clients.
 *
 * Deux choix offerts :
 *  - "Inviter mes clients" : marque step-clients complete + redirige
 *    vers l'écran d'invitation existant.
 *  - "Plus tard" : route vers le dashboard ; le wizard appellera
 *    skipStepClients via le footer "Ignorer".
 *
 * submit() équivaut à "inviter maintenant" — on marque complete et le
 * wizard naviguera vers l'écran d'invitation côté parent.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { onboardingService } from '../../../services/onboardingService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

export const StepClients = forwardRef<StepHandle, StepProps>(
  function StepClients({ epicerie }, ref) {
    const router = useRouter();

    useImperativeHandle(ref, () => ({
      async submit() {
        try {
          await onboardingService.completeStepClients(epicerie.id);
          router.replace('/(epicier)/inviter-clients');
          // ⚠️ On retourne false EXPRES : le step a déjà navigué hors du wizard.
          // Si on retournait true, le parent ferait `flow.reload()` qui mettrait
          // `status.completed=true`, ce qui déclencherait `router.replace('/dashboard')`
          // dans le useEffect parent et écraserait notre redirection ci-dessus.
          // Côté backend, completeStepClients est déjà appelé : aucun état à perdre.
          return false;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Impossible de continuer');
          return false;
        }
      },
    }));

    return (
      <View>
        <View style={styles.celebrate}>
          <Text style={styles.bigIcon}>🎉</Text>
          <Text style={styles.bigTitle}>Bravo, vous y êtes presque !</Text>
          <Text style={styles.lead}>
            Dernière étape pour démarrer du bon pied : invitez vos premiers
            clients pour qu'ils puissent commander chez vous dès aujourd'hui.
          </Text>
        </View>

        <View style={styles.card}>
          <FeatureRow
            icon="📨"
            title="Inviter par SMS ou Email"
            desc="Envoyez un lien à vos clients fidèles pour qu'ils s'inscrivent en quelques secondes."
          />
          <View style={styles.divider} />
          <FeatureRow
            icon="🏷️"
            title="Comptes clients en boutique"
            desc="Créez des comptes carnet pour vos clients réguliers sans smartphone."
          />
        </View>

        <Text style={styles.footnote}>
          Pas pressé ? Cliquez sur « Plus tard » en haut — vous pourrez inviter
          vos clients à tout moment depuis l'écran « Clients » du dashboard.
        </Text>
      </View>
    );
  }
);

interface FeatureRowProps {
  icon: string;
  title: string;
  desc: string;
}

function FeatureRow({ icon, title, desc }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconWrap}>
        <Text style={styles.rowIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  celebrate: {
    alignItems: 'center',
    paddingBottom: space.lg,
  },
  bigIcon: { fontSize: 56, marginBottom: space.sm },
  bigTitle: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.lg,
    marginBottom: space.lg,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 20 },
  rowTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 2,
  },
  rowDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.md,
  },

  footnote: {
    ...typography.caption,
    color: colors.textSubtle,
    textAlign: 'center',
    paddingHorizontal: space.md,
  },
});
