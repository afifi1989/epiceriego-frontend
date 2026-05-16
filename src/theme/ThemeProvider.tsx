import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { ColorPalette, ColorScheme, darkColors, lightColors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

export interface Theme {
  scheme:     ColorScheme;
  colors:     ColorPalette;
  spacing:    typeof spacing;
  radius:     typeof radius;
  shadows:    typeof shadows;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Force un schéma. Sinon: suit la préférence système (`useColorScheme`).
   * En attendant l'activation du dark mode produit, garder `'light'`.
   */
  forceScheme?: ColorScheme;
}

export function ThemeProvider({ children, forceScheme = 'light' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = forceScheme ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo<Theme>(() => ({
    scheme,
    colors:     scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    shadows,
    typography,
  }), [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
