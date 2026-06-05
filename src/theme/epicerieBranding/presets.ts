/**
 * Presets de couleurs par épicerie — miroir local du catalogue backend
 * (table {@code epicerie_color_presets}, migration V101).
 *
 * <p>Le mobile garde une copie locale pour deux raisons :</p>
 * <ul>
 *   <li><b>Performance</b> : pas besoin d'un fetch /branding/presets juste pour
 *       afficher une bannière — les valeurs sont disponibles synchrones.</li>
 *   <li><b>Offline-first</b> : le rendu doit marcher même sans réseau (en
 *       reconstruisant le thème depuis le code preset stocké sur l'épicerie).</li>
 * </ul>
 *
 * <p>Si la liste backend évolue (nouveau preset ajouté), il suffit d'ajouter
 * la ligne ici. Les épiceries utilisant un preset inconnu fallback à DEFAULT.</p>
 */

export type EpicerieThemePresetCode =
    | 'DEFAULT'
    | 'WARM'
    | 'COOL'
    | 'MINIMAL'
    | 'VIBRANT'
    | 'CUSTOM';

export interface EpicerieThemePreset {
  code: EpicerieThemePresetCode;
  primary: string;
  primarySubtle: string;
  accent: string;
  onPrimary: string;
  /** Dégradé hero (du clair au plus foncé) — calculé visuellement à partir du primary. */
  heroGradient: [string, string];
}

/**
 * Catalogue des presets. Les couleurs sont identiques à celles seedées en
 * BDD (V101 → epicerie_color_presets). Toute divergence = bug visuel.
 */
export const EPICERIE_PRESETS: Record<EpicerieThemePresetCode, EpicerieThemePreset> = {
  DEFAULT: {
    code: 'DEFAULT',
    primary: '#22A152',
    primarySubtle: '#E6F4EA',
    accent: '#FFA726',
    onPrimary: '#FFFFFF',
    heroGradient: ['#22A152', '#1B7F3F'],
  },
  WARM: {
    code: 'WARM',
    primary: '#D97706',
    primarySubtle: '#FEF3C7',
    accent: '#DC2626',
    onPrimary: '#FFFFFF',
    heroGradient: ['#F59E0B', '#D97706'],
  },
  COOL: {
    code: 'COOL',
    primary: '#0EA5E9',
    primarySubtle: '#E0F2FE',
    accent: '#06B6D4',
    onPrimary: '#FFFFFF',
    heroGradient: ['#38BDF8', '#0284C7'],
  },
  MINIMAL: {
    code: 'MINIMAL',
    primary: '#18181B',
    primarySubtle: '#F4F4F5',
    accent: '#6B7280',
    onPrimary: '#FFFFFF',
    heroGradient: ['#27272A', '#18181B'],
  },
  VIBRANT: {
    code: 'VIBRANT',
    primary: '#EC4899',
    primarySubtle: '#FCE7F3',
    accent: '#14B8A6',
    onPrimary: '#FFFFFF',
    heroGradient: ['#F472B6', '#DB2777'],
  },
  // CUSTOM : preset "sentinel" pour épicerie qui a override les couleurs.
  // Les valeurs ici servent uniquement de fallback si l'API renvoie code
  // CUSTOM sans couleurs (cas anormal). Le vrai thème vient du DTO.
  CUSTOM: {
    code: 'CUSTOM',
    primary: '#22A152',
    primarySubtle: '#E6F4EA',
    accent: '#FFA726',
    onPrimary: '#FFFFFF',
    heroGradient: ['#22A152', '#1B7F3F'],
  },
};

/** Récupère un preset par son code, fallback DEFAULT si inconnu (forward-compat). */
export function getPreset(code: string | null | undefined): EpicerieThemePreset {
  if (!code) return EPICERIE_PRESETS.DEFAULT;
  const preset = EPICERIE_PRESETS[code as EpicerieThemePresetCode];
  return preset ?? EPICERIE_PRESETS.DEFAULT;
}
