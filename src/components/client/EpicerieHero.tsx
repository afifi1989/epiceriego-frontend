import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * EpicerieHero — bannière immersive de la page épicerie.
 *
 * <p>300px de haut, image présentation en fond avec dégradé noir bas pour la
 * lisibilité des actions flottantes. Volontairement <em>sans</em> texte
 * superposé : le nom et l'adresse sont portés par le {@link EpicerieIdentityBar}
 * juste en dessous → photo respirée, identité lisible sur fond blanc.</p>
 *
 * <p>4 actions top : retour, favori, recherche (révèle la barre slide-down),
 * et un slot ⋯ réservé pour "partager / signaler" plus tard. Position absolue
 * sur l'image, fond translucide pour ne pas voler de pixels à la photo.</p>
 *
 * <p>Fallback : si {@code photoUrl} est absent ou échoue à charger, on remplit
 * la zone avec {@code brandPrimary} + emoji 🏪. Zéro placeholder gris triste.</p>
 */
export interface EpicerieHeroProps {
  photoUrl?: string | null;
  brandPrimary: string;
  /** Couleur des icônes flottantes sur l'image (blanc par défaut, lisible sur tout). */
  iconColor?: string;
  isFavorite?: boolean;
  onBack: () => void;
  onFavorite?: () => void;
  onSearch: () => void;
  onMore?: () => void;
  /** Tap sur l'image elle-même → typiquement ouvre le zoom plein écran. */
  onImagePress?: () => void;
  /** Hauteur du hero. Défaut 300 (immersif type Airbnb). */
  height?: number;
  /**
   * Position de scroll partagée (Animated.Value alimentée par le onScroll de la
   * liste, useNativeDriver). Si fournie, l'image du hero applique un léger
   * parallax (translateY + zoom au pull-to-refresh) pour un effet immersif.
   */
  scrollY?: Animated.Value;
  style?: ViewStyle;
}

export const EpicerieHero: React.FC<EpicerieHeroProps> = ({
  photoUrl,
  brandPrimary,
  iconColor = '#FFFFFF',
  isFavorite = false,
  onBack,
  onFavorite,
  onSearch,
  onMore,
  onImagePress,
  height = 300,
  scrollY,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = !!photoUrl && !imgFailed;

  // ── Pop animé du cœur favori ──────────────────────────────────────────
  // Petite impulsion scale au tap pour donner du "poids" au geste. Native
  // driver : transform pris en charge sans passer par le JS thread.
  const heartScale = React.useRef(new Animated.Value(1)).current;
  const handleFavoritePress = React.useCallback(() => {
    heartScale.setValue(0.8);
    Animated.spring(heartScale, {
      toValue: 1,
      friction: 3,
      tension: 140,
      useNativeDriver: true,
    }).start();
    onFavorite?.();
  }, [heartScale, onFavorite]);

  // ── Parallax de l'image ───────────────────────────────────────────────
  // translateY suit le scroll à vitesse réduite (effet de profondeur), scale
  // agrandit l'image en overscroll haut (pull). Bornes subtiles + wrapper
  // débordant (top/bottom -height*0.4) pour ne jamais révéler de vide.
  const parallaxTransform = scrollY
    ? {
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [-height, 0, height],
              outputRange: [-height * 0.3, 0, height * 0.28],
              extrapolateRight: 'clamp' as const,
            }),
          },
          {
            scale: scrollY.interpolate({
              inputRange: [-height, 0],
              outputRange: [1.6, 1],
              extrapolateRight: 'clamp' as const,
            }),
          },
        ],
      }
    : undefined;

  return (
    <View style={[{ height }, styles.container, style]}>
      {/* Image ou fallback couleur brand */}
      <Pressable
        onPress={onImagePress}
        disabled={!onImagePress || !showImage}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            styles.parallaxLayer,
            { top: -height * 0.4, bottom: -height * 0.4 },
            parallaxTransform,
          ]}
        >
          {showImage ? (
            <Image
              source={{ uri: photoUrl as string }}
              style={StyleSheet.absoluteFill as any}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: brandPrimary }]}>
              <View style={styles.fallbackEmojiWrap}>
                <Text style={styles.fallbackEmoji}>🏪</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Dégradé bas — assure la lisibilité des éléments qui suivent sans
          écraser la photo. Approximation linéaire via 3 bandes empilées
          (pas de dépendance externe). */}
      <View pointerEvents="none" style={[styles.gradientBand, styles.gradientBandBottom1]} />
      <View pointerEvents="none" style={[styles.gradientBand, styles.gradientBandBottom2]} />
      <View pointerEvents="none" style={[styles.gradientBand, styles.gradientBandBottom3]} />

      {/* Dégradé haut léger pour lisibilité des actions */}
      <View pointerEvents="none" style={[styles.gradientBand, styles.gradientBandTop]} />

      {/* Barre d'actions flottantes */}
      <View
        style={[
          styles.actionsRow,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <FloatingAction onPress={onBack} iconColor={iconColor} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={iconColor} />
        </FloatingAction>

        <View style={styles.actionsRight}>
          {onFavorite && (
            <FloatingAction onPress={handleFavoritePress} iconColor={iconColor} accessibilityLabel="Favori">
              <Animated.Text style={[styles.heartEmoji, { transform: [{ scale: heartScale }] }]}>
                {isFavorite ? '❤️' : '🤍'}
              </Animated.Text>
            </FloatingAction>
          )}
          <FloatingAction onPress={onSearch} iconColor={iconColor} accessibilityLabel="Rechercher">
            <Ionicons name="search" size={20} color={iconColor} />
          </FloatingAction>
          {onMore && (
            <FloatingAction onPress={onMore} iconColor={iconColor} accessibilityLabel="Plus d'options">
              <Ionicons name="ellipsis-horizontal" size={20} color={iconColor} />
            </FloatingAction>
          )}
        </View>
      </View>
    </View>
  );
};

interface FloatingActionProps {
  onPress: () => void;
  iconColor: string;
  accessibilityLabel: string;
  children: React.ReactNode;
}

const FloatingAction: React.FC<FloatingActionProps> = ({ onPress, accessibilityLabel, children }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.floatingBtn, pressed && styles.floatingBtnPressed]}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={6}
  >
    {children}
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  parallaxLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fallbackEmojiWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 72,
    opacity: 0.6,
  },

  // Bandes de dégradé empilées (haut: light, bas: dégradé vers noir 0.4).
  gradientBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  gradientBandTop: {
    top: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  gradientBandBottom1: {
    bottom: 0,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  gradientBandBottom2: {
    bottom: 30,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  gradientBandBottom3: {
    bottom: 60,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },

  actionsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  floatingBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  heartEmoji: {
    fontSize: 18,
  },
});
