/**
 * Helper centralise pour afficher une Alert d'erreur sur mobile.
 *
 * Conventions :
 * <ul>
 *   <li>Si l'erreur a deja ete prise en charge par l'intercepteur 402
 *       (Alert "Plan requis" deja affichee), on skip pour eviter d'empiler.
 *       Flag {@code __subscriptionGateHandled} pose par l'intercepteur
 *       dans {@code src/services/api.ts}.</li>
 *   <li>Sinon on prefere le message du backend
 *       ({@code err.response.data.message}) puis {@code err.message}
 *       puis le fallback statique.</li>
 * </ul>
 *
 * Usage :
 * <pre>
 *   try { await service.create(...); }
 *   catch (err: any) { showErrorAlert(err, 'Creation impossible'); }
 * </pre>
 */
import { Alert } from 'react-native';

export function showErrorAlert(err: any, fallback = 'Une erreur est survenue', title = 'Erreur'): void {
  if (err?.__subscriptionGateHandled) return;
  const backendMsg = err?.response?.data?.message ?? err?.message;
  Alert.alert(title, backendMsg ?? fallback);
}

/**
 * Variante Toast pour les ecrans qui utilisent react-native-toast-message
 * plutot qu'Alert. On accepte un getter pour eviter d'importer Toast
 * dans des fichiers qui n'en ont pas besoin.
 */
export function shouldShowErrorToast(err: any): boolean {
  return !err?.__subscriptionGateHandled;
}

export function getErrorMessage(err: any, fallback = 'Une erreur est survenue'): string {
  return err?.response?.data?.message ?? err?.message ?? fallback;
}
