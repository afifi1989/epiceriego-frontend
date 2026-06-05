/**
 * Bus d'evenements pour la couche feedback authentification / reseau.
 *
 * Pourquoi un bus plutot que des appels directs depuis l'intercepteur axios ?
 *   - L'intercepteur n'est pas un composant React → ne peut pas utiliser
 *     useToast() ni interagir avec le contexte SafeArea / Theme.
 *   - On veut decoupler le moment ou l'evenement se produit (couche reseau)
 *     du moment ou il est affiche (couche UI). Plus testable, et n'importe
 *     quel ecran peut s'abonner si besoin (ex: debug overlay).
 *
 * Le bridge React {@link AuthFeedbackBridge} ecoute et orchestre les toasts.
 */

import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

export type AuthFeedbackEvent =
  // Cycle refresh transparent du token
  | 'refresh:start'      // payload: void
  | 'refresh:success'    // payload: void
  | 'refresh:failed'     // payload: { code?: string }
  // Reauth modal (declenche par api.ts quand refresh impossible)
  | 'reauth:required'    // payload: { email?: string; reason?: string }
  | 'reauth:success'     // payload: void  (emis par ReauthModal apres re-login OK)
  | 'reauth:cancelled'   // payload: void  (emis par ReauthModal apres dismiss/cancel)
  // Cycle reseau (emis par NetworkBanner via NetInfo)
  | 'network:offline'    // payload: void
  | 'network:online';    // payload: void

export interface AuthFeedbackPayloads {
  'refresh:start':    void;
  'refresh:success':  void;
  'refresh:failed':   { code?: string };
  'reauth:required':  { email?: string; reason?: string };
  'reauth:success':   void;
  'reauth:cancelled': void;
  'network:offline':  void;
  'network:online':   void;
}

const PREFIX = '@authFeedback/';

export const authFeedbackBus = {
  emit<E extends AuthFeedbackEvent>(event: E, payload?: AuthFeedbackPayloads[E]): void {
    DeviceEventEmitter.emit(PREFIX + event, payload);
  },

  on<E extends AuthFeedbackEvent>(
    event: E,
    listener: (payload: AuthFeedbackPayloads[E]) => void,
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener(PREFIX + event, listener);
  },
};
