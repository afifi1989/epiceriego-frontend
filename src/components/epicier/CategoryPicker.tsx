/**
 * Enhanced Category Picker with search, hierarchy, and favorites
 */

import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import {
  CATEGORIES,
  searchCategories,
} from '@/src/constants/categories';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const FAVORITES_STORAGE_KEY = '@epiceriego_favorite_categories';
const MAX_FAVORITES = 5;

interface CategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: number, subcategoryId?: string) => void;
  selectedCategoryId?: number;
  selectedSubcategoryId?: string;
}

interface FavoriteCategory {
  categoryId: number;
  subcategoryId?: string;
  count: number;
  lastUsed: number;
}

export function CategoryPicker({
  visible,
  onClose,
  onSelect,
  selectedCategoryId,
  selectedSubcategoryId,
}: CategoryPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<FavoriteCategory[]>([]);

  useEffect(() => {
    if (visible) {
      loadFavorites();
      setSearchQuery('');
    }
  }, [visible]);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FavoriteCategory[];
        setFavorites(parsed.sort((a, b) => b.count - a.count).slice(0, MAX_FAVORITES));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const saveFavorite = async (categoryId: number, subcategoryId?: string) => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      let favs: FavoriteCategory[] = stored ? JSON.parse(stored) : [];

      const existingIndex = favs.findIndex(
        (f) => f.categoryId === categoryId && f.subcategoryId === subcategoryId
      );

      if (existingIndex >= 0) {
        favs[existingIndex].count += 1;
        favs[existingIndex].lastUsed = Date.now();
      } else {
        favs.push({
          categoryId,
          subcategoryId,
          count: 1,
          lastUsed: Date.now(),
        });
      }

      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
      loadFavorites();
    } catch (error) {
      console.error('Error saving favorite:', error);
    }
  };

  const handleSelect = (categoryId: number, subcategoryId?: string) => {
    saveFavorite(categoryId, subcategoryId);
    onSelect(categoryId, subcategoryId);
    onClose();
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderFavorites = () => {
    if (favorites.length === 0 || searchQuery) return null;

    return (
      <View style={styles.favoritesSection}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="star" size={18} color={Colors.warning} />
          <Text style={styles.sectionTitle}>Favoris</Text>
        </View>
        <View style={styles.favoritesList}>
          {favorites.map((fav) => {
            const category = CATEGORIES.find((c) => c.id === fav.categoryId);
            if (!category) return null;

            const subcategory = fav.subcategoryId
              ? category.subcategories?.find((s) => s.id === fav.subcategoryId)
              : undefined;

            const isSelected =
              selectedCategoryId === fav.categoryId &&
              selectedSubcategoryId === fav.subcategoryId;

            return (
              <TouchableOpacity
                key={`fav-${fav.categoryId}-${fav.subcategoryId || 'main'}`}
                style={[styles.favoriteChip, isSelected && styles.selectedChip]}
                onPress={() => handleSelect(fav.categoryId, fav.subcategoryId)}
              >
                <MaterialCommunityIcons
                  name={category.icon as any}
                  size={16}
                  color={isSelected ? Colors.textInverse : Colors.primary}
                />
                <Text
                  style={[
                    styles.favoriteChipText,
                    isSelected && styles.selectedChipText,
                  ]}
                  numberOfLines={1}
                >
                  {subcategory ? subcategory.label : category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSearchResults = () => {
    if (!searchQuery) return null;

    const results = searchCategories(searchQuery);

    if (results.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="magnify" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>Aucun résultat trouvé</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(item, index) =>
          `search-${item.category.id}-${item.subcategory?.id || 'main'}-${index}`
        }
        renderItem={({ item }) => {
          const isSelected =
            selectedCategoryId === item.category.id &&
            selectedSubcategoryId === item.subcategory?.id;

          return (
            <TouchableOpacity
              style={[styles.searchResultItem, isSelected && styles.selectedItem]}
              onPress={() =>
                handleSelect(item.category.id, item.subcategory?.id)
              }
            >
              <MaterialCommunityIcons
                name={item.category.icon as any}
                size={24}
                color={isSelected ? Colors.primary : Colors.textSecondary}
              />
              <View style={styles.searchResultText}>
                <Text
                  style={[
                    styles.searchResultLabel,
                    isSelected && styles.selectedText,
                  ]}
                >
                  {item.subcategory?.label || item.category.label}
                </Text>
                {item.subcategory && (
                  <Text style={styles.searchResultBreadcrumb}>
                    {item.category.label}
                  </Text>
                )}
              </View>
              {isSelected && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={Colors.primary}
                />
              )}
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  const renderCategories = () => {
    if (searchQuery) return null;

    return (
      <ScrollView style={styles.categoriesList} showsVerticalScrollIndicator={false}>
        {CATEGORIES.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const isCategorySelected =
            selectedCategoryId === category.id && !selectedSubcategoryId;

          return (
            <View key={category.id} style={styles.categoryBlock}>
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  isCategorySelected && styles.selectedItem,
                ]}
                onPress={() => {
                  if (category.subcategories && category.subcategories.length > 0) {
                    toggleCategory(category.id);
                  } else {
                    handleSelect(category.id);
                  }
                }}
              >
                <View style={styles.categoryLeft}>
                  <MaterialCommunityIcons
                    name={category.icon as any}
                    size={24}
                    color={isCategorySelected ? Colors.primary : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      isCategorySelected && styles.selectedText,
                    ]}
                  >
                    {category.label}
                  </Text>
                </View>
                <View style={styles.categoryRight}>
                  {isCategorySelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={Colors.primary}
                    />
                  )}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={Colors.textSecondary}
                    />
                  )}
                </View>
              </TouchableOpacity>

              {isExpanded && category.subcategories && (
                <View style={styles.subcategoriesList}>
                  {category.subcategories.map((subcategory) => {
                    const isSubSelected =
                      selectedCategoryId === category.id &&
                      selectedSubcategoryId === subcategory.id;

                    return (
                      <TouchableOpacity
                        key={subcategory.id}
                        style={[
                          styles.subcategoryItem,
                          isSubSelected && styles.selectedSubcategoryItem,
                        ]}
                        onPress={() => handleSelect(category.id, subcategory.id)}
                      >
                        <View style={styles.subcategoryDot} />
                        <Text
                          style={[
                            styles.subcategoryLabel,
                            isSubSelected && styles.selectedText,
                          ]}
                        >
                          {subcategory.label}
                        </Text>
                        {isSubSelected && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={18}
                            color={Colors.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sélectionner une catégorie</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={Colors.textSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher une catégorie..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {renderFavorites()}
            {searchQuery ? renderSearchResults() : renderCategories()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    height: '90%',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.text,
    paddingVertical: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  favoritesSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  favoritesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  favoriteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    maxWidth: '48%',
  },
  selectedChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  favoriteChipText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    flex: 1,
  },
  selectedChipText: {
    color: Colors.textInverse,
    fontWeight: '600',
  },
  categoriesList: {
    flex: 1,
  },
  categoryBlock: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryLabel: {
    fontSize: FontSizes.base,
    color: Colors.text,
    fontWeight: '500',
  },
  selectedItem: {
    backgroundColor: Colors.primaryLight,
  },
  selectedText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  subcategoriesList: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.xs,
  },
  subcategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.xl * 2,
    paddingRight: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  selectedSubcategoryItem: {
    backgroundColor: Colors.primaryLight,
  },
  subcategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  subcategoryLabel: {
    fontSize: FontSizes.base,
    color: Colors.text,
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultLabel: {
    fontSize: FontSizes.base,
    color: Colors.text,
    fontWeight: '500',
  },
  searchResultBreadcrumb: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});
