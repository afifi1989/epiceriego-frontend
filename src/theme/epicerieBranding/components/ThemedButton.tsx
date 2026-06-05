import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../index';
import { useEpicerieTheme } from '../EpicerieThemeContext';

/**
 * Bouton CTA qui adopte automatiquement la couleur primaire de l'épicerie
 * courante (via {@link useEpicerieTheme}). Si hors contexte épicerie,
 * fallback à {@code theme.colors.brand} (vert AbridGO standard).
 *
 * <h3>Variantes</h3>
 * <ul>
 *   <li><b>solid</b> (défaut) : fond primary, texte onPrimary</li>
 *   <li><b>outline</b> : bordure primary, texte primary, fond transparent</li>
 *   <li><b>ghost</b> : pas de bordure, texte primary, fond transparent</li>
 * </ul>
 *
 * <h3>Pourquoi pas {@code TouchableOpacity}</h3>
 * Pressable gère mieux le feedback visuel (state-based style) sans
 * dégrader l'arborescence native.
 */

type ThemedButtonVariant = 'solid' | 'outline' | 'ghost';

interface ThemedButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ThemedButtonVariant;
  loading?: boolean;
  /** Override de la couleur primaire — utile pour cas spécifiques (action danger). */
  primaryOverride?: string;
  style?: ViewStyle;
  /** Étendre sur toute la largeur du parent. Défaut true. */
  fullWidth?: boolean;
}

export function ThemedButton({
  label,
  variant = 'solid',
  loading = false,
  primaryOverride,
  disabled,
  style,
  fullWidth = true,
  ...pressableProps
}: ThemedButtonProps) {
  const theme = useTheme();
  const branding = useEpicerieTheme();

  const primary = primaryOverride ?? branding?.primary ?? theme.colors.brand;
  const onPrimary = branding?.onPrimary ?? theme.colors.onBrand;

  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle[] = [styles.base];
  if (fullWidth) containerStyle.push(styles.fullWidth);

  let textColor = onPrimary;

  if (variant === 'solid') {
    containerStyle.push({ backgroundColor: primary });
    textColor = onPrimary;
  } else if (variant === 'outline') {
    containerStyle.push({
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: primary,
    });
    textColor = primary;
  } else if (variant === 'ghost') {
    containerStyle.push({ backgroundColor: 'transparent' });
    textColor = primary;
  }

  if (isDisabled) containerStyle.push(styles.disabled);
  if (style) containerStyle.push(style);

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        ...containerStyle,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
