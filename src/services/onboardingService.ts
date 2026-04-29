/**
 * OnboardingService — API pour le parcours d'onboarding épicier.
 *
 * Endpoints historiques :
 * - GET  /onboarding/status/{epicerieId}
 * - GET  /onboarding/catalogue/{epicerieType}
 * - POST /onboarding/{epicerieId}/step-type
 * - POST /onboarding/{epicerieId}/import-catalogue
 * - POST /onboarding/{epicerieId}/step-clients
 * - POST /onboarding/{epicerieId}/skip-clients
 *
 * Endpoints génériques (étapes configurables) :
 * - POST /onboarding/{epicerieId}/step/{stepKey}/complete
 * - POST /onboarding/{epicerieId}/step/{stepKey}/skip
 *
 * Convention : {@link completeStep} / {@link skipStep} marquent
 * uniquement le flag onboarding. Les données métier (latitude,
 * photoUrl, horaires…) doivent avoir été persistées <i>avant</i>
 * via les endpoints existants de l'épicerie (PUT /epiceries/my-epicerie,
 * upload photo, etc.). Cette séparation permet à l'épicier de
 * re-paramétrer ces champs depuis Settings sans rouvrir l'onboarding.
 */

import api from './api';
import { OnboardingStatus, CatalogueItem, OnboardingStepKey } from '../features/onboarding/types';

export const onboardingService = {

  async getStatus(epicerieId: number): Promise<OnboardingStatus> {
    const response = await api.get<OnboardingStatus>(`/onboarding/status/${epicerieId}`);
    return response.data;
  },

  async getCatalogue(epicerieType: string): Promise<CatalogueItem[]> {
    const response = await api.get<CatalogueItem[]>(`/onboarding/catalogue/${epicerieType}`);
    return response.data;
  },

  async completeStepType(epicerieId: number): Promise<OnboardingStatus> {
    const response = await api.post<OnboardingStatus>(`/onboarding/${epicerieId}/step-type`);
    return response.data;
  },

  async importCatalogue(
    epicerieId: number,
    seedIds: string[],
    priceOverrides?: { seedId: string; prix: number }[],
  ): Promise<OnboardingStatus> {
    const response = await api.post<OnboardingStatus>(`/onboarding/${epicerieId}/import-catalogue`, {
      seedIds,
      priceOverrides: priceOverrides ?? [],
    });
    return response.data;
  },

  async completeStepClients(epicerieId: number): Promise<OnboardingStatus> {
    const response = await api.post<OnboardingStatus>(`/onboarding/${epicerieId}/step-clients`);
    return response.data;
  },

  async skipStepClients(epicerieId: number): Promise<OnboardingStatus> {
    const response = await api.post<OnboardingStatus>(`/onboarding/${epicerieId}/skip-clients`);
    return response.data;
  },

  // ── Étapes configurables génériques (Location, Photos, …) ──────────

  async completeStep(epicerieId: number, stepKey: OnboardingStepKey): Promise<OnboardingStatus> {
    const response = await api.post<OnboardingStatus>(
      `/onboarding/${epicerieId}/step/${stepKey}/complete`
    );
    return response.data;
  },

  async skipStep(epicerieId: number, stepKey: OnboardingStepKey): Promise<OnboardingStatus> {
    const response = await api.post<OnboardingStatus>(
      `/onboarding/${epicerieId}/step/${stepKey}/skip`
    );
    return response.data;
  },
};
