import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

/**
 * EpicerieCategoryChips — barre horizontale de "rayons" (catégories) façon
 * Glovo / Deliveroo. Permet un accès rapide à chaque catégorie sans ouvrir la
 * bottom-sheet Filtres. Le chip actif est surligné à la couleur de marque de
 * l'épicerie pour un repère visuel immédiat.
 *
 * <p>Volontairement passif : le parent fournit la liste (avec icône emoji déjà
 * résolue via getCategoryIcon), l'id actif, et réagit au tap — typiquement en
 * scrollant vers la section correspondante (mode rayons) ou en filtrant la
 * liste. Un chip « Tous » en tête réinitialise la sélection.</p>
 */
export interface CategoryChip {
  id: number;
  name: string;
  /** Icône emoji résolue par le parent (getCategoryIcon). */
  icon?: string;
}

export interface EpicerieCategoryChipsProps {
  categories: CategoryChip[];
  /** Catégorie active (surlignée). null = « Tous ». */
  activeId: number | null;
  /** Tap sur un chip. null = chip « Tous ». */
  onSelect: (id: number | null) => void;
  /** Couleur de marque pour le chip actif. */
  accentColor: string;
  /** Couleur du texte/emoji sur le chip actif (contraste). */
  accentOnColor: string;
  /** Libellé du chip « Tous » (localisé). */
  allLabel: string;
  style?: ViewStyle;
  /** Rendu compact (mini-header sticky). */
  compact?: boolean;
}

export const EpicerieCategoryChips: React.FC<EpicerieCategoryChipsProps> = ({
  categories,
  activeId,
  onSelect,
  accentColor,
  accentOnColor,
  allLabel,
  style,
  compact = false,
}) => {
  if (categories.length === 0) return null;

  const renderChip = (
    key: string,
    label: string,
    icon: string | undefined,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        active
          ? { backgroundColor: accentColor, borderColor: accentColor }
          : styles.chipInactive,
      ]}
    >
      {icon ? (
        <Text style={[styles.chipIcon, compact && styles.chipIconCompact]}>{icon}</Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.chipText,
          compact && styles.chipTextCompact,
          active ? { color: accentOnColor } : styles.chipTextInactive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {renderChip('cat-all', allLabel, '🧺', activeId === null, () => onSelect(null))}
        {categories.map((c) =>
          renderChip(`cat-${c.id}`, c.name, c.icon, activeId === c.id, () => onSelect(c.id)),
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  wrapperCompact: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    paddingVertical: 0,
  },
  content: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipInactive: {
    backgroundColor: '#F4F4F5',
    borderColor: '#E5E7EB',
  },
  chipIcon: { fontSize: 14 },
  chipIconCompact: { fontSize: 12 },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
    maxWidth: 150,
  },
  chipTextCompact: { fontSize: 12 },
  chipTextInactive: { color: '#374151' },
});
