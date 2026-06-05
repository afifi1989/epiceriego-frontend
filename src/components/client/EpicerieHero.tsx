import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
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
  style,
}) => {
  const insets = useSafeAreaInsets();
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = !!photoUrl && !imgFailed;

  return (
    <View style={[{ height }, styles.container, style]}>
      {/* Image ou fallback couleur brand */}
      <Pressable
        onPress={onImagePress}
        disabled={!onImagePress || !showImage}
        style={StyleSheet.absoluteFill}
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
            <FloatingAction onPress={onFavorite} iconColor={iconColor} accessibilityLabel="Favori">
              <Text style={styles.heartEmoji}>{isFavorite ? '❤️' : '🤍'}</Text>
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
