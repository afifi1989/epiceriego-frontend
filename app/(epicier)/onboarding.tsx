export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Onboarding Wizard — point d'entrée /onboarding pour l'épicier.
 *
 * Architecture :
 *  - Le hook useOnboardingFlow gère état + actions (load, complete, skip).
 *  - WIZARD_STEPS définit l'ordre et les métadonnées des 9 étapes.
 *  - OnboardingStepShell rend le squelette commun (stepper + header + footer).
 *  - Chaque étape est un composant `forwardRef<StepHandle, StepProps>`
 *    qui expose un submit() ; le shell appelle ce submit via ref.
 *
 * Steps :
 *  1. TYPE         (obligatoire)
 *  2. LOCATION     (skippable)
 *  3. PHOTOS       (skippable)
 *  4. DESCRIPTION  (skippable)
 *  5. HOURS        (skippable)
 *  6. DELIVERY     (skippable)
 *  7. WHATSAPP     (skippable)
 *  8. CATALOGUE    (obligatoire)
 *  9. CLIENTS      (skippable, déjà existant)
 *
 * Tout step skippé pourra être complété plus tard depuis Settings.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingStepShell } from '../../src/features/onboarding/components/OnboardingStepShell';
import { useOnboardingFlow } from '../../src/features/onboarding/useOnboardingFlow';
import { WIZARD_STEPS } from '../../src/features/onboarding/stepDefinitions';
import {
  isOptionalStepResolved,
  type OnboardingStepKey,
} from '../../src/features/onboarding/types';
import { onboardingService } from '../../src/services/onboardingService';

import { StepType } from '../../src/features/onboarding/steps/StepType';
import { StepLocation } from '../../src/features/onboarding/steps/StepLocation';
import { StepPhotos } from '../../src/features/onboarding/steps/StepPhotos';
import { StepDescription } from '../../src/features/onboarding/steps/StepDescription';
import { StepHours } from '../../src/features/onboarding/steps/StepHours';
import { StepDelivery } from '../../src/features/onboarding/steps/StepDelivery';
// StepWhatsapp n'est plus dans le wizard (lie a l'abonnement) — reste
// importable depuis Parametres ou il est utilise pour la re-edition.
import { StepPlan } from '../../src/features/onboarding/steps/StepPlan';
import { StepCatalogue } from '../../src/features/onboarding/steps/StepCatalogue';
import { StepFinaliserStock } from '../../src/features/onboarding/steps/StepFinaliserStock';
import { StepClients } from '../../src/features/onboarding/steps/StepClients';
import type { StepHandle } from '../../src/features/onboarding/steps/stepProps';

export default function OnboardingWizardScreen() {
  const router = useRouter();
  const flow = useOnboardingFlow();
  const stepRef = useRef<StepHandle>(null);

  // Une fois l'onboarding terminé côté backend, on redirige vers le
  // dashboard. La détection se fait sur le flag `completed` du status.
  useEffect(() => {
    if (flow.status?.completed) {
      router.replace('/(epicier)/dashboard');
    }
  }, [flow.status?.completed, router]);

  // ── Loading initial ─────────────────────────────────────────────
  if (flow.loading || !flow.epicerie || !flow.status) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const meta = WIZARD_STEPS[flow.currentIndex];
  const status = flow.status;

  // ── Indices résolus pour le visuel du stepper ──────────────────
  // PLAN est toujours considéré "résolu" : le trial PRO est créé
  // automatiquement au signup, donc dès l'arrivée sur le wizard,
  // l'épicier a déjà un abonnement valide. La step sert juste à le
  // confirmer/le changer — pas à le bloquer.
  const resolvedIndices = new Set<number>();
  WIZARD_STEPS.forEach((s, idx) => {
    if (s.id === 'TYPE' && status.stepTypeCompleted) resolvedIndices.add(idx);
    else if (s.id === 'PLAN') resolvedIndices.add(idx);
    // FINALISER_STOCK n'a pas de flag backend (optionnel, sans incidence sur
    // la complétion de l'onboarding) → toujours considéré résolu, comme PLAN.
    else if (s.id === 'FINALISER_STOCK') resolvedIndices.add(idx);
    else if (s.id === 'CATALOGUE' && status.stepCatalogueCompleted) resolvedIndices.add(idx);
    else if (s.id === 'CLIENTS'
        && (status.stepClientsCompleted || status.stepClientsSkipped)) resolvedIndices.add(idx);
    else if (s.kind === 'CONFIGURABLE' && s.apiKey
        && isOptionalStepResolved(status, s.apiKey)) resolvedIndices.add(idx);
  });

  // ── Handler "Continuer" : délègue au step via ref ──────────────
  const handleContinue = async () => {
    const ok = await stepRef.current?.submit();
    if (!ok) return;

    // Pour les steps configurables, marquer le flag "complete" côté
    // backend AVANT d'avancer. Pour les steps structurels, le step
    // a déjà appelé son endpoint dédié dans son submit().
    if (meta.kind === 'CONFIGURABLE' && meta.apiKey) {
      try {
        await onboardingService.completeStep(
          flow.epicerie!.id,
          meta.apiKey as OnboardingStepKey,
        );
      } catch {
        // L'erreur a déjà été notifiée à l'utilisateur dans le step.
        return;
      }
    }
    await flow.reload();
    // Recharger l'épicerie pour que le step suivant ait des données
    // à jour (ex: StepDelivery dépend de city.id et currentLocation).
    await flow.reloadEpicerie();
    flow.goNext();
  };

  // ── Handler "Ignorer" : skip côté backend + avance ─────────────
  const handleSkip = async () => {
    if (meta.required) return;
    try {
      await flow.skipCurrent();
    } catch {
      // On reste sur le step si erreur — l'utilisateur peut réessayer.
    }
  };

  // ── Mode Express : skip toutes les étapes optionnelles à partir
  // d'ici jusqu'à la prochaine étape obligatoire (ou la fin). Permet
  // à l'épicier pressé d'atteindre directement le catalogue. Toutes
  // les étapes skippées seront éditables plus tard via Paramètres.
  const optionalsToSkipCount = useMemo(() => {
    let n = 0;
    for (let i = flow.currentIndex; i < WIZARD_STEPS.length; i++) {
      const s = WIZARD_STEPS[i];
      if (s.required) break;
      if (s.kind === 'CONFIGURABLE' && s.apiKey
          && !isOptionalStepResolved(flow.status!, s.apiKey)) {
        n++;
      }
      if (s.id === 'CLIENTS' && !status.stepClientsCompleted && !status.stepClientsSkipped) {
        n++;
      }
    }
    return n;
  }, [flow.currentIndex, flow.status, status.stepClientsCompleted, status.stepClientsSkipped]);

  const handleExpressMode = () => {
    if (optionalsToSkipCount < 2) return; // pas la peine si 0 ou 1
    Alert.alert(
      '⚡ Mode Express',
      `Sauter ${optionalsToSkipCount} étape(s) optionnelle(s) ? Tu pourras les compléter plus tard dans Paramètres.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Sauter tout',
          style: 'destructive',
          onPress: async () => {
            // Skip en série jusqu'à atteindre une étape obligatoire
            // ou la fin du wizard.
            let safety = WIZARD_STEPS.length + 1;
            while (safety-- > 0) {
              const currentMeta = WIZARD_STEPS[flow.currentIndex];
              if (currentMeta.required) break;
              try {
                await flow.skipCurrent();
              } catch {
                break;
              }
            }
          },
        },
      ]
    );
  };

  // Temps restant : somme des estimatedSeconds des étapes pas encore résolues.
  const timeRemainingSec = useMemo(() => {
    return WIZARD_STEPS.reduce((sum, s, idx) => {
      return resolvedIndices.has(idx) ? sum : sum + s.estimatedSeconds;
    }, 0);
  }, [resolvedIndices]);

  // ── Mappage step → composant rendu ─────────────────────────────
  const renderStep = () => {
    const stepProps = {
      epicerie: flow.epicerie!,
      country: flow.country,
      busy: flow.busy,
    };
    switch (meta.id) {
      case 'TYPE':        return <StepType        ref={stepRef} {...stepProps} />;
      case 'LOCATION':    return <StepLocation    ref={stepRef} {...stepProps} />;
      case 'PHOTOS':      return <StepPhotos      ref={stepRef} {...stepProps} />;
      case 'DESCRIPTION': return <StepDescription ref={stepRef} {...stepProps} />;
      case 'HOURS':       return <StepHours       ref={stepRef} {...stepProps} />;
      case 'DELIVERY':    return <StepDelivery    ref={stepRef} {...stepProps} />;
      case 'PLAN':        return <StepPlan        ref={stepRef} {...stepProps} />;
      case 'CATALOGUE':   return <StepCatalogue   ref={stepRef} {...stepProps} />;
      case 'FINALISER_STOCK': return <StepFinaliserStock ref={stepRef} {...stepProps} />;
      case 'CLIENTS':     return <StepClients     ref={stepRef} {...stepProps} />;
    }
  };

  // Libellé du bouton continuer adapté à l'étape
  const continueLabel = (() => {
    if (meta.id === 'CATALOGUE') return 'Importer le catalogue';
    if (meta.id === 'FINALISER_STOCK') return 'Enregistrer le stock';
    if (meta.id === 'CLIENTS')   return 'Inviter mes clients';
    if (meta.id === 'PLAN')      return 'Valider mon plan';
    if (flow.currentIndex === WIZARD_STEPS.length - 1) return 'Terminer';
    return 'Continuer';
  })();

  return (
    <OnboardingStepShell
      meta={meta}
      currentIndex={flow.currentIndex}
      resolvedIndices={resolvedIndices}
      busy={flow.busy}
      onBack={flow.currentIndex > 0 ? flow.goBack : undefined}
      onSkip={meta.required ? undefined : handleSkip}
      onContinue={handleContinue}
      continueLabel={continueLabel}
      onJumpTo={flow.goTo}
      timeRemainingSec={timeRemainingSec}
      onExpressMode={optionalsToSkipCount >= 2 ? handleExpressMode : undefined}
    >
      {renderStep()}
    </OnboardingStepShell>
  );
}
