/**
 * Bus d'évènements pour l'upsell d'abonnement (gate 402).
 *
 * Même raison d'être que {@code authFeedbackBus} : l'intercepteur axios n'est
 * pas un composant React, il ne peut donc pas afficher une modal riche
 * (contexte SafeArea / router / langue). Il émet un évènement ; le bridge
 * React {@link UpsellModal} écoute et affiche la modal d'upsell.
 *
 * Remplace l'ancien {@code Alert.alert} natif du 402 dans api.ts.
 */

import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

/**
 * Corps renvoyé par le backend sur un 402 (SubscriptionGateResponse). Tous les
 * champs sont optionnels côté client : on tolère un backend plus ancien.
 */
export interface SubscriptionGateResponse {
  /** Flag technique de la feature bloquée (ex: "hasPromotions"). */
  feature?: string;
  /** Code du plan courant de l'épicier (ex: "DECOUVERTE"). */
  currentPlan?: string;
  /** Code du plan minimum requis (ex: "PRO"). */
  requiredPlan?: string;
  /** Message humain déjà localisé par le backend, si fourni. */
  message?: string;
}

const EVENT = '@subscriptionUpsell/gate';

export const subscriptionUpsellBus = {
  /** Émis par l'intercepteur 402 (api.ts). */
  emit(payload: SubscriptionGateResponse): void {
    DeviceEventEmitter.emit(EVENT, payload);
  },

  /** Abonnement du bridge React (UpsellModal). */
  on(listener: (payload: SubscriptionGateResponse) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener(EVENT, listener);
  },
};
