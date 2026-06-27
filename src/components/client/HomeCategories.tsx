import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { CategorySuggestion, categoryService } from '../../services/categoryService';
import { Theme, useTheme } from '../../theme';
import { Skeleton } from '../feedback';

interface HomeCategoriesProps {
  /** Callback déclenché au tap d'une catégorie. Reçoit la suggestion complète. */
  onPress: (category: CategorySuggestion) => void;
  /** Callback "Voir plus" (dernière card). Optionnel — caché si non fourni. */
  onSeeMore?: () => void;
  /** Nombre max de catégories à demander au backend. */
  limit?: number;
}

/**
 * Section catégories moderne pour la home client.
 *
 * <h3>Source de données</h3>
 * Consomme {@code GET /api/categories/home-suggestions} qui personnalise
 * selon l'historique du client. Le composant gère son propre fetch — pas
 * besoin de l'alimenter depuis la home.
 *
 * <h3>Layout</h3>
 * Liste horizontale scrollable de cards 100×120 avec icône (image distante
 * ou émoji fallback selon le nom), titre, et badge ⭐ "Pour vous" sur les
 * catégories personnalisées. Une card "Voir plus" en fin si onSeeMore fourni.
 *
 * <h3>Ergonomie</h3>
 * - Haptic léger au tap.
 * - Skeleton pendant le 1er load (3 cards placeholder).
 * - Si l'API retourne vide ou plante, le composant ne s'affiche pas du tout
 *   (pas de mauvais empty state qui prend de la place).
 */
export function HomeCategories({ onPress, onSeeMore, limit = 8 }: HomeCategoriesProps) {
  const theme = useTheme();
  const { t, language } = useLanguage();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [data, setData] = useState<CategorySuggestion[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    categoryService.getHomeSuggestions(limit)
      .then(res => {
        if (alive) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setData([]);
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, [limit, language]);

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>{t('client.home.categories')}</Text>
        <FlatList
          horizontal
          data={[0, 1, 2, 3]}
          keyExtractor={(i) => `cat-skeleton-${i}`}
          contentContainerStyle={styles.list}
          showsHorizontalScrollIndicator={false}
          renderItem={() => (
            <View style={styles.skeletonCard}>
              <Skeleton variant="circle" width={48} height={48} style={{ marginBottom: 8 }} />
              <Skeleton variant="text" width={60} height={10} />
            </View>
          )}
        />
      </View>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  const hasPersonalized = data.some(c => c.personalized);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {hasPersonalized
            ? (t('client.home.categoriesForYou') || 'Pour vous')
            : (t('client.home.categories') || 'Catégories')}
        </Text>
        {onSeeMore && (
          <TouchableOpacity onPress={onSeeMore} hitSlop={8}>
            <Text style={styles.seeAll}>{t('client.home.seeAll') || 'Tout voir'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => `cat-${item.id}`}
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <CategoryCard
            category={item}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPress(item);
            }}
            theme={theme}
            colorIndex={index}
          />
        )}
        ListFooterComponent={
          onSeeMore ? (
            <SeeMoreCard onPress={onSeeMore} theme={theme} t={t} />
          ) : null
        }
      />
    </View>
  );
}

interface CategoryCardProps {
  category: CategorySuggestion;
  onPress: () => void;
  theme: Theme;
  /** Index — utilisé pour cycler dans la palette de gradients. */
  colorIndex: number;
}

/**
 * Palette de gradients doux par index. Donne une variété visuelle sans
 * imposer une couleur côté backend (l'API ne fournit pas de hint chromatique).
 */
const PALETTE = [
  { bg: '#FFE5E5', accent: '#FF6B6B' }, // rose
  { bg: '#E5F5E5', accent: '#22A152' }, // vert
  { bg: '#FFF5E5', accent: '#F5A623' }, // orange
  { bg: '#E5F0FF', accent: '#2C7BD0' }, // bleu
  { bg: '#FFE5F5', accent: '#D946EF' }, // rose-violet
  { bg: '#F0E5FF', accent: '#8B5CF6' }, // violet
  { bg: '#E5FFF8', accent: '#0EA5A4' }, // teal
  { bg: '#FFF0E5', accent: '#EA580C' }, // brique
];

function CategoryCard({ category, onPress, theme, colorIndex }: CategoryCardProps) {
  const styles = cardStyles(theme);
  const palette = PALETTE[colorIndex % PALETTE.length];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={category.name}
    >
      <View style={[styles.iconBox, { backgroundColor: palette.bg }]}>
        {category.iconUrl ? (
          <ExpoImage
            source={{ uri: category.iconUrl }}
            style={styles.iconImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={[styles.iconEmoji, { color: palette.accent }]}>
            {emojiForCategory(category.name)}
          </Text>
        )}
        {category.personalized && (
          <View style={[styles.personalBadge, { backgroundColor: palette.accent }]}>
            <Ionicons name="sparkles" size={9} color="#fff" />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

interface SeeMoreCardProps {
  onPress: () => void;
  theme: Theme;
  t: (key: string) => string;
}

function SeeMoreCard({ onPress, theme, t }: SeeMoreCardProps) {
  const styles = cardStyles(theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.card}
      accessibilityRole="button"
    >
      <View style={[styles.iconBox, styles.seeMoreIconBox]}>
        <Ionicons name="grid-outline" size={22} color={theme.colors.textSecondary} />
      </View>
      <Text style={[styles.name, { color: theme.colors.textSecondary }]} numberOfLines={2}>
        {t('client.home.seeMore') || 'Voir plus'}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Heuristique simple pour deviner un émoji selon le nom de la catégorie.
 * L'API peut renvoyer des `iconUrl` mais beaucoup de catégories n'en ont
 * pas — on évite une grille tristement texte-only.
 */
function emojiForCategory(name: string): string {
  const n = (name || '').toLowerCase();
  // Recherche par mots-clés FR/AR/EN — ordre = priorité
  const map: { keys: string[]; emoji: string }[] = [
    { keys: ['fruit', 'فواكه'], emoji: '🍎' },
    { keys: ['légume', 'legume', 'vegetable', 'خضر'], emoji: '🥬' },
    { keys: ['lait', 'laitier', 'dairy', 'ألبان'], emoji: '🥛' },
    { keys: ['boulang', 'pain', 'bread', 'مخبوز'], emoji: '🍞' },
    { keys: ['boucher', 'viande', 'meat', 'لحم'], emoji: '🥩' },
    { keys: ['poisson', 'fish', 'سمك'], emoji: '🐟' },
    { keys: ['boisson', 'drink', 'مشروب'], emoji: '🥤' },
    { keys: ['épice', 'epice', 'spice', 'توابل'], emoji: '🌶️' },
    { keys: ['bio', 'nature', 'organic'], emoji: '🌿' },
    { keys: ['hygiène', 'hygiene', 'soin'], emoji: '🧴' },
    { keys: ['bébé', 'bebe', 'baby'], emoji: '🍼' },
    { keys: ['ménage', 'menage', 'cleaning'], emoji: '🧽' },
    { keys: ['snack', 'biscuit', 'chocolat'], emoji: '🍫' },
    { keys: ['conserve', 'canned'], emoji: '🥫' },
    { keys: ['surgelé', 'frozen'], emoji: '❄️' },
    { keys: ['pâte', 'pasta', 'riz', 'rice'], emoji: '🍝' },
    { keys: ['café', 'thé', 'tea', 'coffee'], emoji: '☕' },
  ];
  for (const entry of map) {
    if (entry.keys.some(k => n.includes(k))) return entry.emoji;
  }
  return '🛒';
}

const cardStyles = (theme: Theme) => StyleSheet.create({
  card: {
    width: 84,
    alignItems: 'center',
    marginEnd: theme.spacing.md,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  seeMoreIconBox: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  iconEmoji: {
    fontSize: 30,
  },
  personalBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  name: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    maxWidth: 84,
  },
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  section: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.titleMd,
    color: theme.colors.textPrimary,
  },
  seeAll: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
  },
  skeletonCard: {
    width: 84,
    alignItems: 'center',
    marginEnd: theme.spacing.md,
  },
});
