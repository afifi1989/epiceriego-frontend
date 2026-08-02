export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Redirect } from 'expo-router';

/**
 * Écran retiré — redirection de compatibilité.
 *
 * <p>« Factures & Paiements » a été fusionné dans « Mon carnet » :
 * la consultation (dette, historique, avances) vit dans le relevé du
 * carnet, et l'encaissement des factures est désormais réservé à
 * l'épicier (action « Encaisser » de son carnet client). Le paiement
 * en ligne côté client était de toute façon inopérant (aucune
 * passerelle de tokenisation PCI-DSS intégrée).</p>
 *
 * <p>Ce fichier ne subsiste que pour que les anciens points d'entrée
 * (deep links, notifications, écrans non mis à jour) atterrissent au
 * bon endroit au lieu d'un 404. Aucune UI, aucun appel réseau.</p>
 */
export default function FacturesPaiementsRedirect() {
  return <Redirect href="/(client)/mon-carnet" />;
}
