import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  ImageStyle,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

/**
 * Avatar carré d'une épicerie pour les listings (recherche, favoris, …).
 *
 * Affiche le logo {@code photoUrl} si fourni et chargeable, sinon retombe sur
 * l'emoji 🏪 dans une box de mêmes dimensions. Le fallback est aussi déclenché
 * à l'exécution si l'image est introuvable côté CDN ({@code onError}).
 *
 * <p>Tap sur le logo (uniquement quand il s'agit d'une vraie image) → ouvre
 * une vue plein écran avec le logo agrandi. La logique du modal est interne
 * au composant pour qu'il soit drop-in sans état parent. Le fallback emoji
 * n'est pas cliquable car il n'y a rien à voir en plus.</p>
 *
 * Conserver les mêmes dimensions image/fallback est important : la position
 * absolue d'éventuels overlays (bouton favori) reste stable selon le rendu.
 */
interface EpicerieLogoProps {
  photoUrl?: string | null;
  /** Taille (px) du carré. Défaut 64. */
  size?: number;
  /** Style additionnel — accepte les props communes ViewStyle/ImageStyle. */
  style?: StyleProp<ViewStyle & ImageStyle>;
  /** Texte alternatif pour l'accessibilité (nom de l'épicerie). */
  accessibilityLabel?: string;
}

export function EpicerieLogo({ photoUrl, size = 64, style, accessibilityLabel }: EpicerieLogoProps) {
  const [failed, setFailed] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);
  const dimension = { width: size, height: size, borderRadius: Math.min(12, size / 5) };
  const showImage = !!photoUrl && !failed;

  if (!showImage) {
    // Pas d'image → carré fallback non cliquable. Zoomer un emoji n'a aucun
    // intérêt utilisateur, et ça évite d'ouvrir un modal vide.
    return (
      <View style={[styles.fallback, dimension, style as StyleProp<ViewStyle>]}>
        <Text style={[styles.fallbackEmoji, { fontSize: size * 0.55 }]}>🏪</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setZoomVisible(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel ? `Agrandir le logo de ${accessibilityLabel}` : 'Agrandir le logo'}
        style={({ pressed }) => [pressed && styles.pressed]}
        hitSlop={4}
      >
        <Image
          source={{ uri: photoUrl as string }}
          style={[styles.image, dimension, style as StyleProp<ImageStyle>]}
          onError={() => setFailed(true)}
          resizeMode="cover"
        />
      </Pressable>

      <Modal
        visible={zoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomVisible(false)}
        statusBarTranslucent
      >
        {/* Backdrop : tap n'importe où ferme le modal. */}
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomVisible(false)}>
          <Pressable
            // Bloque la propagation : tap sur l'image elle-même ne ferme pas.
            onPress={() => {}}
            style={styles.zoomCard}
          >
            <Image
              source={{ uri: photoUrl as string }}
              style={styles.zoomImage}
              resizeMode="contain"
            />
            {accessibilityLabel ? (
              <Text style={styles.zoomCaption} numberOfLines={1}>{accessibilityLabel}</Text>
            ) : null}
          </Pressable>

          {/* Bouton de fermeture explicite en haut à droite. */}
          <Pressable
            style={styles.closeButton}
            onPress={() => setZoomVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const SCREEN = Dimensions.get('window');
const ZOOM_MAX = Math.min(SCREEN.width, SCREEN.height) * 0.85;

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#F5F5F5',
  },
  fallback: {
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    lineHeight: undefined,
  },
  pressed: {
    opacity: 0.85,
  },

  // ── Zoom modal ──────────────────────────────────────────────────
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  zoomCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  zoomImage: {
    width: ZOOM_MAX,
    height: ZOOM_MAX,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
  },
  zoomCaption: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: ZOOM_MAX,
    paddingHorizontal: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
});
