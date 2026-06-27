import { Image as ExpoImage } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { Theme, useTheme } from '../../theme';
import { Epicerie } from '../../type';

interface EpicerieStoriesProps {
  epiceries: Epicerie[];
  onPress: (epicerie: Epicerie) => void;
}

/**
 * Bandeau "stories" d'épiceries — inspiration Instagram / Glovo / Jumia.
 *
 * Chaque épicerie est représentée par un cercle de 64px avec sa photo.
 * Les épiceries marquées "isOpen" reçoivent un anneau brand vert (livraison
 * possible maintenant), les fermées un anneau gris muted.
 *
 * Composant volontairement minimal — pas de fetch interne — la home alimente
 * via la liste déjà chargée pour `popularEpiceries`. Évite un round-trip API
 * supplémentaire au mount.
 */
export function EpicerieStories({ epiceries, onPress }: EpicerieStoriesProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!epiceries || epiceries.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>
        {t('client.home.discover') || 'À découvrir'}
      </Text>
      <FlatList
        horizontal
        data={epiceries}
        keyExtractor={(item) => `story-${item.id}`}
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <Story epicerie={item} onPress={onPress} theme={theme} />}
      />
    </View>
  );
}

interface StoryProps {
  epicerie: Epicerie;
  onPress: (epicerie: Epicerie) => void;
  theme: Theme;
}

function Story({ epicerie, onPress, theme }: StoryProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const styles = storyStyles(theme);
  const imageUrl = epicerie.photoUrl || epicerie.presentationPhotoUrl;
  const showImage = imageUrl && imageUrl.trim() !== '' && !imageFailed;

  const ringColor = epicerie.isOpen ? theme.colors.brand : theme.colors.borderStrong;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(epicerie)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={epicerie.nomEpicerie}
    >
      <View style={[styles.ring, { borderColor: ringColor }]}>
        <View style={styles.imageWrap}>
          {showImage ? (
            <ExpoImage
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Text style={styles.placeholderEmoji}>🏪</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {epicerie.nomEpicerie}
      </Text>
    </TouchableOpacity>
  );
}

const storyStyles = (theme: Theme) => StyleSheet.create({
  item: {
    width: 76,
    alignItems: 'center',
    marginEnd: theme.spacing.md,
  },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  imageWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 26,
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 76,
  },
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrapper: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  heading: {
    ...theme.typography.titleSm,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
  },
});
