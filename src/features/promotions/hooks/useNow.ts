import { useEffect, useState } from 'react';

/**
 * Tick périodique léger qui force un re-render des écrans affichant des promos.
 *
 * M-g : `activePromosForEpicerie`/`bestPromoForX` ne réévaluent la fenêtre
 * temporelle (`dateDebut ≤ now ≤ dateFin`) qu'au moment du rendu. Sans un tick,
 * une promo qui expire pendant que l'écran reste ouvert continuerait d'être
 * affichée/remisée jusqu'au prochain fetch. Ce hook déclenche un re-render
 * périodique : au tick suivant l'expiration, `bestPromoForX` revérifie la
 * fenêtre et cesse de renvoyer la promo → prix barré/badge disparaissent.
 *
 * Volontairement léger : un seul `setInterval` par écran (JAMAIS un timer par
 * item), nettoyé au unmount pour éviter toute fuite.
 *
 * @param intervalMs période du tick (défaut 30 s). Ne pas descendre trop bas :
 *   l'objectif est de rafraîchir l'affichage des promos, pas d'animer.
 * @returns l'horodatage courant (change à chaque tick).
 */
export function useNow(intervalMs: number = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
