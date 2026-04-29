/**
 * Conventions partagées par tous les composants de step.
 *
 * Chaque step est un composant `forwardRef` qui expose une méthode
 * `submit()` via `useImperativeHandle`. Le wizard parent appelle
 * cette méthode quand l'utilisateur clique sur le bouton "Continuer"
 * du footer commun (cf. OnboardingStepShell).
 *
 * Cette inversion de contrôle évite que chaque step réimplémente son
 * propre footer et garantit une UX cohérente sur toutes les étapes.
 */

import type { Country, Epicerie } from '../../../type';

export interface StepProps {
  epicerie: Epicerie;
  country: Country | null;
  busy: boolean;
}

/**
 * Interface exposée par chaque step via ref.
 * Le wizard récupère cet objet et appelle `submit()` quand il faut
 * valider/sauvegarder/avancer.
 */
export interface StepHandle {
  /**
   * Sauvegarde les données et marque l'étape comme complete.
   *
   * @returns `true` si succès (le wizard avance), `false` si validation
   *          échouée (le wizard reste sur l'étape).
   */
  submit: () => Promise<boolean>;
}
