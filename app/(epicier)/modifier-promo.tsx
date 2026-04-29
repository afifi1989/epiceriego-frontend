import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy — redirige vers le nouveau wizard en mode édition.
 * Accepte l'ancien param `promoId` et le réémet sous `id` pour le wizard.
 */
export default function ModifierPromoRedirect() {
  const { promoId, id } = useLocalSearchParams<{ promoId?: string; id?: string }>();
  const finalId = id ?? promoId;
  const href = finalId
    ? (`/(epicier)/promo-wizard?id=${finalId}` as any)
    : (`/(epicier)/promo-wizard` as any);
  return <Redirect href={href} />;
}
