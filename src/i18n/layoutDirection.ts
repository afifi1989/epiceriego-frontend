import { I18nManager } from 'react-native';

/**
 * Verrouille l'application en LTR (gauche → droite) pour TOUTES les langues.
 *
 * ─── Pourquoi ────────────────────────────────────────────────────────────
 * `I18nManager` est un flag NATIF, GLOBAL et PERSISTANT :
 *   • global      → il miroite toute la mise en page (lignes, paddings,
 *                   alignements), sans aucune notion de « langue courante » ;
 *   • persistant  → il survit aux redémarrages et aux reloads du bundle JS ;
 *   • différé     → `forceRTL()` ne prend effet qu'au prochain démarrage natif
 *                   complet (un reload JS ne suffit pas).
 *
 * Conséquence du code précédent : une seule sélection de l'arabe activait
 * `forceRTL(true)` de façon permanente. Le retour au français appelait bien
 * `forceRTL(false)`, mais rien ne redémarrait l'app (`expo-updates` n'est pas
 * installé) — l'app restait donc en RTL dans TOUTES les langues.
 *
 * De plus, `allowRTL(true)` couplait la direction à la locale de l'appareil :
 * un téléphone configuré en arabe basculait l'app en RTL même en français.
 *
 * ─── Ce que ça change pour l'arabe ───────────────────────────────────────
 * Rien sur la lisibilité : le TEXTE arabe reste rendu de droite à gauche grâce
 * à l'algorithme bidirectionnel d'Unicode, qui est indépendant d'`I18nManager`.
 * Seul le MIROIR de la mise en page est abandonné. Si un vrai miroir est voulu
 * un jour, la bonne approche est un RTL au niveau des styles (dériver `isRTL`
 * de la langue et appliquer `row-reverse` / `textAlign` / `writingDirection`),
 * qui bascule instantanément et ne fuit jamais sur les autres langues.
 *
 * ─── Ordre d'exécution ───────────────────────────────────────────────────
 * Ce module est importé pour son EFFET DE BORD tout en haut de `app/_layout.tsx`,
 * afin de s'exécuter au chargement du bundle, avant la création de la moindre
 * vue — et non dans un `useEffect` après un `await AsyncStorage` (trop tard).
 *
 * NOTE : sur un appareil déjà bloqué en RTL, l'écriture du flag n'est visible
 * qu'au PROCHAIN lancement complet de l'app (contrainte native, pas un bug).
 */
export function lockLayoutDirectionToLTR(): void {
  try {
    // Découple la direction de la locale de l'appareil.
    I18nManager.allowRTL(false);

    // N'écrit le flag natif que s'il est réellement à corriger : évite une
    // écriture inutile en SharedPreferences/NSUserDefaults à chaque démarrage.
    if (I18nManager.isRTL) {
      I18nManager.forceRTL(false);
      console.warn(
        '[layoutDirection] Flag RTL natif détecté et désactivé. ' +
          'La mise en page redeviendra LTR au prochain démarrage complet de l\'app.',
      );
    }
  } catch (error) {
    console.warn('[layoutDirection] Impossible de verrouiller la direction en LTR:', error);
  }
}

// Effet de bord à l'import : appliqué au chargement du bundle.
lockLayoutDirectionToLTR();
