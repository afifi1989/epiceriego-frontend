import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../index';
import { useEpicerieTheme } from '../EpicerieThemeContext';

/**
 * Petit badge coloré pour mettre en valeur une promo, une catégorie ou un
 * état (nouveau, populaire, dernier exemplaire). Utilise la couleur
 * d'accent de l'épicerie pour se distinguer du CTA primaire.
 *
 * <h3>Variantes</h3>
 * <ul>
 *   <li><b>accent</b> (défaut) : fond accent, texte blanc — pour promo</li>
 *   <li><b>subtle</b> : fond primarySubtle, texte primary — pour catégorie</li>
 *   <li><b>outline</b> : bordure primary, texte primary, fond transparent</li>
 * </ul>
 */

type ThemedBadgeVariant = 'accent' | 'subtle' | 'outline';

interface ThemedBadgeProps {
  label: string;
  variant?: ThemedBadgeVariant;
  /** Icone à gauche (emoji ou texte court). */
  icon?: string;
  style?: ViewStyle;
}

export function ThemedBadge({ label, variant = 'accent', icon, style }: ThemedBadgeProps) {
  const theme = useTheme();
  const branding = useEpicerieTheme();

  const primary = branding?.primary ?? theme.colors.brand;
  const primarySubtle = branding?.primarySubtle ?? theme.colors.brandSubtle;
  const accent = branding?.accent ?? theme.colors.warning;

  let bg: string;
  let fg: string;
  let borderWidth = 0;
  let borderColor: string | undefined;

  if (variant === 'accent') {
    bg = accent;
    fg = '#FFFFFF';
  } else if (variant === 'subtle') {
    bg = primarySubtle;
    fg = primary;
  } else {
    // outline
    bg = 'transparent';
    fg = primary;
    borderWidth = 1;
    borderColor = primary;
  }

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderWidth, borderColor },
        style,
      ]}
    >
      {icon ? <Text style={[styles.icon, { color: fg }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 11,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
