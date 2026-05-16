/**
 * Tokens couleur sémantiques pour EpicerieGo.
 *
 * Règle: ne pas écrire de hex en dur dans les écrans — toujours passer par
 * `useTheme().colors.<role>`. Les variantes light/dark sont définies ici
 * pour préparer le dark mode (activable via le provider) sans réécrire les
 * écrans plus tard.
 */

export type ColorScheme = 'light' | 'dark';

export interface ColorPalette {
  // Marque (rôle: client = vert, epicier = bleu, livreur = violet)
  brand:           string;
  brandSubtle:     string;
  brandStrong:     string;
  onBrand:         string;

  // Statut sémantique
  success:         string;
  successSubtle:   string;
  warning:         string;
  warningSubtle:   string;
  danger:          string;
  dangerSubtle:    string;
  info:            string;
  infoSubtle:      string;

  // Surface
  background:      string;
  surface:         string;
  surfaceMuted:    string;
  surfaceElevated: string;
  border:          string;
  borderStrong:    string;
  overlay:         string;

  // Texte
  textPrimary:     string;
  textSecondary:   string;
  textMuted:       string;
  textInverse:     string;
  textOnDanger:    string;
  textLink:        string;
}

export const lightColors: ColorPalette = {
  brand:           '#22A152',
  brandSubtle:     '#E6F4EA',
  brandStrong:     '#1B7F3F',
  onBrand:         '#FFFFFF',

  success:         '#22A152',
  successSubtle:   '#E6F4EA',
  warning:         '#E5A21B',
  warningSubtle:   '#FFF6E1',
  danger:          '#D64545',
  dangerSubtle:    '#FCE7E7',
  info:            '#2C7BD0',
  infoSubtle:      '#E3F0FB',

  background:      '#F5F6F8',
  surface:         '#FFFFFF',
  surfaceMuted:    '#FAFAFA',
  surfaceElevated: '#FFFFFF',
  border:          '#ECECEC',
  borderStrong:    '#D6D6D6',
  overlay:         'rgba(15, 23, 42, 0.45)',

  textPrimary:     '#1A1D21',
  textSecondary:   '#52575C',
  textMuted:       '#8A8F94',
  textInverse:     '#FFFFFF',
  textOnDanger:    '#FFFFFF',
  textLink:        '#2C7BD0',
};

export const darkColors: ColorPalette = {
  brand:           '#3DBE6F',
  brandSubtle:     '#1F2D24',
  brandStrong:     '#5BD588',
  onBrand:         '#0B0F0C',

  success:         '#3DBE6F',
  successSubtle:   '#1F2D24',
  warning:         '#F0B638',
  warningSubtle:   '#332A18',
  danger:          '#E66565',
  dangerSubtle:    '#3A1F1F',
  info:            '#5AA0E5',
  infoSubtle:      '#1B2A3B',

  background:      '#0F1115',
  surface:         '#161A20',
  surfaceMuted:    '#1B2026',
  surfaceElevated: '#1F242B',
  border:          '#262C34',
  borderStrong:    '#363D46',
  overlay:         'rgba(0, 0, 0, 0.6)',

  textPrimary:     '#F1F3F5',
  textSecondary:   '#B6BBC1',
  textMuted:       '#7B8088',
  textInverse:     '#0F1115',
  textOnDanger:    '#FFFFFF',
  textLink:        '#7AB6F0',
};
