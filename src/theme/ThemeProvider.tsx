import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorPalette, ColorScheme, darkColors, lightColors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

/** Clé de persistance locale de la préférence de thème (mode sombre). */
export const DARK_MODE_STORAGE_KEY = 'app_dark_mode';

export interface Theme {
  scheme:     ColorScheme;
  colors:     ColorPalette;
  spacing:    typeof spacing;
  radius:     typeof radius;
  shadows:    typeof shadows;
  typography: typeof typography;
}

/** API impérative de contrôle du thème (exposée au toggle des paramètres). */
export interface ThemeControl {
  /** `true` si le thème courant est sombre. */
  isDark: boolean;
  /** Active/désactive le mode sombre, persiste localement, applique en direct. */
  setDarkMode: (enabled: boolean) => Promise<void>;
}

const ThemeContext = createContext<Theme | null>(null);
const ThemeControlContext = createContext<ThemeControl | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Force un schéma en dur (utile pour les tests / previews). Quand fourni,
   * il l'emporte sur la préférence utilisateur persistée.
   */
  forceScheme?: ColorScheme;
}

export function ThemeProvider({ children, forceScheme }: ThemeProviderProps) {
  // Préférence sombre persistée localement. `null` = pas encore chargée ou
  // aucune préférence explicite → on retombe sur le thème clair (défaut
  // produit sûr tant que tous les écrans ne sont pas migrés au thème).
  const [darkPref, setDarkPref] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(DARK_MODE_STORAGE_KEY)
      .then((value) => {
        if (!mounted || value == null) return;
        setDarkPref(value === 'true');
      })
      .catch((error) => {
        console.warn('[ThemeProvider] ⚠️ Lecture préférence thème échouée:', error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setDarkMode = useCallback(async (enabled: boolean) => {
    setDarkPref(enabled);
    try {
      await AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.warn('[ThemeProvider] ⚠️ Persistance préférence thème échouée:', error);
    }
  }, []);

  const scheme: ColorScheme =
    forceScheme ?? (darkPref ? 'dark' : 'light');

  const theme = useMemo<Theme>(() => ({
    scheme,
    colors:     scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    shadows,
    typography,
  }), [scheme]);

  const control = useMemo<ThemeControl>(() => ({
    isDark: scheme === 'dark',
    setDarkMode,
  }), [scheme, setDarkMode]);

  return (
    <ThemeContext.Provider value={theme}>
      <ThemeControlContext.Provider value={control}>
        {children}
      </ThemeControlContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}

/**
 * Contrôle impératif du thème (toggle mode sombre). À utiliser dans l'écran
 * Paramètres. Retourne un fallback inerte hors provider pour ne pas crasher.
 */
export function useThemeControl(): ThemeControl {
  const ctx = useContext(ThemeControlContext);
  if (ctx) return ctx;
  return { isDark: false, setDarkMode: async () => {} };
}
