import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface Props {
  /** Largeur du logo (défaut 200). La hauteur est calculée automatiquement (ratio 659:255). */
  size?: number;
  /** Conservé pour rétrocompatibilité — ignoré (le texte est inclus dans l'image) */
  showText?: boolean;
  /** Conservé pour rétrocompatibilité — ignoré */
  layout?: 'row' | 'column';
}

const LOGO_RATIO = 255 / 659; // hauteur / largeur de l'image originale

/**
 * Logo AbridGO — image distante.
 * Le texte "AbridGO" est inclus dans l'image, pas besoin de le rendre séparément.
 */
export default function AbridGOLogo({ size = 200 }: Props) {
  const width = size;
  const height = Math.round(size * LOGO_RATIO);

  return (
    <Image
      source={{ uri: 'https://afifi-mostafa.com/images/logo.webp' }}
      style={[styles.logo, { width, height }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
  },
});
