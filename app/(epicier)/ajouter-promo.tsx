import { Redirect } from 'expo-router';

/**
 * Legacy — redirige vers le nouveau wizard de création.
 * Conservé pour compat deep-links et navigation externe.
 */
export default function AjouterPromoRedirect() {
  return <Redirect href={'/(epicier)/promo-wizard' as any} />;
}
