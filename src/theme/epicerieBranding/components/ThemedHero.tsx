import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../index';
import { useEpicerieTheme } from '../EpicerieThemeContext';

/**
 * Hero responsive affiché en haut de l'écran détail épicerie.
 *
 * <h3>Comportement</h3>
 * <ul>
 *   <li>Fond = couleur primaire de l'épicerie (ou thème AbridGO si pas de branding)</li>
 *   <li>Image bannière en background si {@code bannerUrl} fourni (avec overlay sombre
 *       pour garantir la lisibilité du texte)</li>
 *   <li>Logo circulaire 64px à gauche si {@code logoUrl} fourni</li>
 *   <li>Nom + slogan superposés</li>
 * </ul>
 *
 * <h3>Performance</h3>
 * Utilise {@code expo-image} (cache disque natif + decode hors UI thread).
 * Pas de gradient lib → fond solide + image = render léger.
 */
interface ThemedHeroProps {
  name: string;
  /** Affiché en petit sous le nom (note, type boutique, etc). Optionnel. */
  subtitle?: string;
  /** Children rendus sous le hero (typiquement les stats / CTA). Optionnel. */
  children?: React.ReactNode;
}

export function ThemedHero({ name, subtitle, children }: ThemedHeroProps) {
  const theme = useTheme();
  const branding = useEpicerieTheme();

  // Fallback gracieux : si pas de branding → couleur AbridGO standard
  const primaryColor = branding?.primary ?? theme.colors.brand;
  const onPrimary = branding?.onPrimary ?? theme.colors.onBrand;
  const accent = branding?.accent ?? theme.colors.brand;
  const bannerUrl = branding?.bannerUrl;
  const logoUrl = branding?.logoUrl;
  const tagline = branding?.brandStatement;

  return (
    <View style={[styles.container, { backgroundColor: primaryColor }]}>
      {/* Bannière en background, overlay sombre par-dessus pour lisibilité */}
      {bannerUrl ? (
        <>
          <ExpoImage
            source={{ uri: bannerUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
          <View style={styles.bannerOverlay} pointerEvents="none" />
        </>
      ) : null}

      <View style={styles.content}>
        {/* Logo circulaire à gauche, fallback avatar initiales */}
        {logoUrl ? (
          <ExpoImage
            source={{ uri: logoUrl }}
            style={styles.logo}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={[styles.logoFallback, { backgroundColor: accent }]}>
            <Text style={[styles.logoInitial, { color: onPrimary }]}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Nom + slogan */}
        <View style={styles.textBlock}>
          <Text style={[styles.name, { color: onPrimary }]} numberOfLines={2}>
            {name}
          </Text>
          {tagline ? (
            <Text
              style={[styles.tagline, { color: onPrimary, opacity: 0.9 }]}
              numberOfLines={2}
            >
              {tagline}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: onPrimary, opacity: 0.75 }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {children ? <View style={styles.childrenWrap}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  // Overlay sombre semi-transparent sur la bannière pour garantir
  // contraste texte blanc même sur image claire. Niveau 0.35 = WCAG-friendly
  // sans trop ternir l'image.
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontSize: 26,
    fontWeight: '700',
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  childrenWrap: {
    marginTop: 14,
  },
});
