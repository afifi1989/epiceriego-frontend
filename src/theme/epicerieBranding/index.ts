/**
 * Module branding par épicerie — barrel export.
 *
 * <p>Aucun composant ici n'importe React Native depuis le top — tout est
 * sûr à importer côté tests / SSR.</p>
 */

export {
  EpicerieThemeProvider,
  useEpicerieTheme,
} from './EpicerieThemeContext';

export {
  deriveBranding,
  type EpicerieBranding,
} from './deriveBranding';

export {
  EPICERIE_PRESETS,
  getPreset,
  type EpicerieThemePreset,
  type EpicerieThemePresetCode,
} from './presets';

export { ThemedHero, ThemedButton, ThemedBadge } from './components';
