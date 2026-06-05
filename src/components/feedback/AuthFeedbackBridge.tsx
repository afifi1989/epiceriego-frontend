import { useEffect, useRef } from 'react';
import { authFeedbackBus } from '../../services/auth/authFeedbackBus';
import { useToast } from './ToastProvider';

/**
 * Pont entre le bus d'evenements d'auth/reseau (cote couche reseau, non-React)
 * et le ToastProvider (cote UI). A monter une seule fois sous ToastProvider.
 *
 * Pourquoi un composant separe :
 *   - useToast() ne peut etre appele qu'en contexte React.
 *   - Le composant n'affiche rien, il orchestre uniquement les toasts.
 *   - On garde le bus pur (zero dependance UI).
 *
 * Strategie d'affichage :
 *   - refresh:start  → toast info "Reconnexion en cours" (longue duree, ferme manuellement)
 *   - refresh:success → dismiss le toast en cours + success bref "Reconnecte"
 *   - refresh:failed → dismiss + error "Session expiree" (la redirection est
 *     declenchee par l'intercepteur, pas par ce bridge)
 *   - network:offline → toast warning persistant (le banner global est la source
 *     primaire ; le toast initial sert juste a notifier le passage)
 *   - network:online → success bref "Connexion retablie"
 */
export function AuthFeedbackBridge() {
  const toast = useToast();
  const refreshToastId = useRef<string | null>(null);

  useEffect(() => {
    const dismissRefresh = () => {
      if (refreshToastId.current) {
        toast.dismiss(refreshToastId.current);
        refreshToastId.current = null;
      }
    };

    const subs = [
      authFeedbackBus.on('refresh:start', () => {
        // Toast longue duree (20s) : on le ferme nous-meme a succes/echec
        dismissRefresh();
        refreshToastId.current = toast.show({
          variant: 'info',
          title: 'Reconnexion en cours...',
          message: 'Veuillez patienter, restauration de votre session.',
          duration: 20000,
          silent: true,
        });
      }),

      authFeedbackBus.on('refresh:success', () => {
        dismissRefresh();
        toast.show({
          variant: 'success',
          title: 'Session restauree',
          duration: 1800,
          silent: true,
        });
      }),

      authFeedbackBus.on('refresh:failed', () => {
        // Le toast 'Reconnexion en cours' est ferme silencieusement : le
        // ReauthModal va prendre le relais et s'afficher en overlay. Pas
        // de toast d'erreur ici — il ferait doublon avec le modal qui
        // explique deja clairement la situation a l'utilisateur.
        dismissRefresh();
      }),

      authFeedbackBus.on('reauth:success', () => {
        // Confirmation breve apres re-login reussi via le modal.
        toast.success('Reconnecte', 'Vous pouvez reprendre votre activite.');
      }),

      authFeedbackBus.on('network:offline', () => {
        toast.warning(
          'Mode hors ligne',
          'Les donnees affichees peuvent etre obsoletes.',
        );
      }),

      authFeedbackBus.on('network:online', () => {
        toast.success('Connexion retablie', 'Synchronisation en cours.');
      }),
    ];

    return () => subs.forEach(s => s.remove());
  }, [toast]);

  return null;
}
