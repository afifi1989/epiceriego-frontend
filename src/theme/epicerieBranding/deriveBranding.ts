/**
 * Construit le thème effectif d'une épicerie depuis le DTO API.
 *
 * <p>Trois cas de fallback gracieux :</p>
 * <ol>
 *   <li><b>Couleurs explicites présentes</b> (primaryColor + primarySubtle +
 *       accentColor + onPrimaryColor) → on les utilise directement. Cas
 *       d'une épicerie en mode CUSTOM ou avec preset complet recopié.</li>
 *   <li><b>Code preset connu</b> mais couleurs absentes → on lit le preset
 *       local. Cas legacy si l'API a renvoyé uniquement le code (souvent
 *       le seed initial où les couleurs n'ont pas été dupliquées).</li>
 *   <li><b>Aucune info</b> → null. L'écran consommateur fallback au thème
 *       AbridGO global (zéro régression visuelle).</li>
 * </ol>
 */

import { Epicerie } from '../../type';
import { EpicerieThemePreset, getPreset } from './presets';

export interface EpicerieBranding extends EpicerieThemePreset {
  /** Slogan/tagline de la boutique, optionnel. */
  brandStatement?: string;
  /** URL absolue du logo (photoUrl). */
  logoUrl?: string;
  /** URL absolue de la bannière hero (presentationPhotoUrl). */
  bannerUrl?: string;
  /** Code preset effectif appliqué (pour debug + analytics). */
  effectivePreset: string;
}

/**
 * Calcule le branding effectif depuis l'objet Epicerie. Retourne null si
 * l'épicerie est sur le thème par défaut (DEFAULT ou absent) — laissant
 * l'écran utiliser le thème AbridGO standard sans override.
 *
 * <p><b>Pourquoi null pour DEFAULT</b> : éviter de recréer un layer de
 * theme context inutile quand l'épicerie n'a rien personnalisé. Le mobile
 * peut tester {@code if (branding)} avant d'appliquer override.</p>
 */
export function deriveBranding(epicerie: Epicerie | null | undefined): EpicerieBranding | null {
  if (!epicerie) return null;

  // Si l'épicier n'a rien personnalisé (theme_preset null ou DEFAULT et
  // aucune couleur custom) → pas de branding, fallback global.
  const preset = epicerie.themePreset;
  const hasCustomColors = !!(
    epicerie.primaryColor &&
    epicerie.primarySubtle &&
    epicerie.accentColor &&
    epicerie.onPrimaryColor
  );

  if ((!preset || preset === 'DEFAULT') && !hasCustomColors) {
    return null;
  }

  // Mode 1 : couleurs explicites présentes sur le DTO → priorité.
  // Mode 2 : code preset seul → lookup local des couleurs.
  const fallback = getPreset(preset);
  const primary = epicerie.primaryColor ?? fallback.primary;
  const primarySubtle = epicerie.primarySubtle ?? fallback.primarySubtle;
  const accent = epicerie.accentColor ?? fallback.accent;
  const onPrimary = epicerie.onPrimaryColor ?? fallback.onPrimary;

  // Pour le gradient hero, si on a un preset connu on prend son gradient
  // calibré. Sinon (mode CUSTOM) on dérive un gradient simple primary → un
  // poil plus foncé pour rester cohérent visuellement.
  const heroGradient: [string, string] = preset && preset !== 'CUSTOM'
    ? fallback.heroGradient
    : [primary, darken(primary, 0.12)];

  return {
    code: (preset as EpicerieBranding['code']) ?? 'DEFAULT',
    primary,
    primarySubtle,
    accent,
    onPrimary,
    heroGradient,
    brandStatement: epicerie.brandStatement,
    logoUrl: epicerie.photoUrl,
    bannerUrl: epicerie.presentationPhotoUrl,
    effectivePreset: preset ?? 'DEFAULT',
  };
}

/**
 * Assombrit une couleur hex d'un facteur 0..1 (0 = inchangé, 1 = noir).
 * Utilisé pour fabriquer un gradient cohérent en mode CUSTOM sans demander
 * une 2e couleur à l'épicier.
 */
function darken(hex: string, amount: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}
