/**
 * useOnboardingFlow — Hook qui orchestre l'état du wizard d'onboarding.
 *
 * Responsabilités :
 *  - Charger l'épicerie connectée (pour récupérer son ID, son type,
 *    son pays — utile pour adapter validation tél/format heures).
 *  - Charger l'OnboardingStatus en parallèle.
 *  - Exposer les actions complete/skip step génériques + structurelles.
 *  - Calculer l'index de l'étape courante (première non-résolue).
 *  - Re-fetch automatique du status après chaque action serveur.
 *
 * Le hook ne décide PAS du rendu — il est consommé par
 * `OnboardingWizardScreen` qui mappe l'étape courante à un composant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { epicerieService } from '../../services/epicerieService';
import { onboardingService } from '../../services/onboardingService';
import { geoService } from '../../services/geoService';
import type { Country, Epicerie } from '../../type';
import type { OnboardingStatus, OnboardingStepKey } from './types';
import {
  isOptionalStepResolved,
  isOptionalStepCompleted,
} from './types';
import { WIZARD_STEPS, type WizardStepId } from './stepDefinitions';

export interface OnboardingFlowState {
  /** Épicerie connectée — null tant que non chargée. */
  epicerie: Epicerie | null;
  /** Pays de l'épicerie (pour adaptations préfixe tél, locale…). */
  country: Country | null;
  /** Status onboarding tel que retourné par le backend. */
  status: OnboardingStatus | null;
  /** Index de l'étape courante (0-based) dans WIZARD_STEPS. */
  currentIndex: number;
  /** Booléen agrégeant les chargements initiaux. */
  loading: boolean;
  /** Booléen pour les actions (skip/complete). */
  busy: boolean;
}

export interface OnboardingFlowActions {
  /** Avance d'une étape sans persister côté backend (navigation locale). */
  goNext: () => void;
  /** Recule d'une étape (jamais en deçà de 0). */
  goBack: () => void;
  /** Saute directement à un index donné. */
  goTo: (index: number) => void;
  /** Marque l'étape courante "complete" et avance. */
  completeCurrent: () => Promise<void>;
  /** Marque l'étape courante "skip" et avance. */
  skipCurrent: () => Promise<void>;
  /** Re-fetch le status (utile après avoir sauvegardé l'épicerie). */
  reload: () => Promise<void>;
  /** Recharge les données épicerie après mutation (photo, GPS…). */
  reloadEpicerie: () => Promise<void>;
}

export function useOnboardingFlow(): OnboardingFlowState & OnboardingFlowActions {
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // ── Chargement initial ─────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const ep = await epicerieService.getMyEpicerie();
      setEpicerie(ep);

      // Charger en parallèle status et pays (le pays vient avec
      // l'épicerie via les sprints geo, mais on le re-fetch pour avoir
      // les détails complets — phonePrefix, defaultLocale).
      const [st, ctry] = await Promise.all([
        onboardingService.getStatus(ep.id),
        ep.country?.code
          ? geoService.getCountryByCode(ep.country.code).catch(() => null)
          : Promise.resolve(null),
      ]);
      setStatus(st);
      setCountry(ctry ?? ep.country ?? null);
      setCurrentIndex(computeFirstUnresolvedIndex(st));
    } catch (err) {
      console.warn('[useOnboardingFlow] init failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Navigation locale ──────────────────────────────────────────────

  const goNext = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < WIZARD_STEPS.length) {
      setCurrentIndex(index);
    }
  }, []);

  // ── Actions backend ────────────────────────────────────────────────

  const completeCurrent = useCallback(async () => {
    if (!epicerie || !status) return;
    const meta = WIZARD_STEPS[currentIndex];
    setBusy(true);
    try {
      // Steps STRUCTURAL ont leurs propres endpoints — c'est le composant
      // (StepType, StepCatalogue, StepClients) qui les appelle car ils
      // ont un payload spécifique. Ici on traite uniquement les CONFIGURABLE.
      if (meta.kind === 'CONFIGURABLE' && meta.apiKey) {
        const next = await onboardingService.completeStep(epicerie.id, meta.apiKey);
        setStatus(next);
      }
      goNext();
    } catch (err) {
      console.warn('[useOnboardingFlow] completeCurrent failed:', err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [currentIndex, epicerie, status, goNext]);

  const skipCurrent = useCallback(async () => {
    if (!epicerie || !status) return;
    const meta = WIZARD_STEPS[currentIndex];
    if (meta.required) return; // Garde-fou : pas de skip sur Type/Catalogue.
    setBusy(true);
    try {
      if (meta.kind === 'CONFIGURABLE' && meta.apiKey) {
        const next = await onboardingService.skipStep(epicerie.id, meta.apiKey);
        setStatus(next);
      } else if (meta.id === 'CLIENTS') {
        const next = await onboardingService.skipStepClients(epicerie.id);
        setStatus(next);
      }
      goNext();
    } catch (err) {
      console.warn('[useOnboardingFlow] skipCurrent failed:', err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [currentIndex, epicerie, status, goNext]);

  const reload = useCallback(async () => {
    if (!epicerie) return;
    const next = await onboardingService.getStatus(epicerie.id);
    setStatus(next);
  }, [epicerie]);

  const reloadEpicerie = useCallback(async () => {
    const ep = await epicerieService.getMyEpicerie();
    setEpicerie(ep);
  }, []);

  return useMemo(() => ({
    epicerie, country, status, currentIndex, loading, busy,
    goNext, goBack, goTo, completeCurrent, skipCurrent, reload, reloadEpicerie,
  }), [epicerie, country, status, currentIndex, loading, busy,
       goNext, goBack, goTo, completeCurrent, skipCurrent, reload, reloadEpicerie]);
}

/**
 * Trouve l'index de la première étape "non résolue" pour reprendre
 * l'onboarding au bon endroit. Stratégie :
 *  - Type pas complété → index 0
 *  - Étape configurable ni complétée ni skippée → cet index
 *  - Catalogue pas complété → son index
 *  - Clients ni complété ni skippé → son index
 *  - Sinon → dernière étape (l'écran "tout fait" sera géré par le wizard)
 */
function computeFirstUnresolvedIndex(status: OnboardingStatus): number {
  for (let i = 0; i < WIZARD_STEPS.length; i++) {
    const s = WIZARD_STEPS[i];
    if (s.id === 'TYPE' && !status.stepTypeCompleted) return i;
    if (s.id === 'CATALOGUE' && !status.stepCatalogueCompleted) return i;
    if (s.id === 'CLIENTS'
        && !status.stepClientsCompleted
        && !status.stepClientsSkipped) return i;
    if (s.kind === 'CONFIGURABLE' && s.apiKey
        && !isOptionalStepResolved(status, s.apiKey)) return i;
  }
  return WIZARD_STEPS.length - 1;
}

// Re-export pour faciliter les imports côté composants.
export { isOptionalStepCompleted };
