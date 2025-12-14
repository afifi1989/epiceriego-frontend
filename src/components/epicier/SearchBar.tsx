/**
 * SearchBar component - reusable search and filter bar
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (text: string) => void;
  onClear?: () => void;
  onFilterPress?: () => void;
  isLoading?: boolean;
  showFilter?: boolean;
  value?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Rechercher...',
  onSearch,
  onClear,
  onFilterPress,
  isLoading = false,
  showFilter = true,
  value = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
      ]}
    >
      {/* Search Icon */}
      <MaterialCommunityIcons
        name="magnify"
        size={20}
        color={Colors.textSecondary}
        style={styles.searchIcon}
      />

      {/* Input */}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        onChangeText={onSearch}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        value={value}
      />

      {/* Loading indicator or Clear button */}
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={styles.rightIcon}
        />
      ) : value && onClear ? (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={18}
            color={Colors.textSecondary}
            style={styles.rightIcon}
          />
        </TouchableOpacity>
      ) : null}

      {/* Filter Button */}
      {showFilter && (
        <TouchableOpacity
          onPress={onFilterPress}
          style={styles.filterButton}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={20}
            color={Colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  containerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  filterButton: {
    marginLeft: Spacing.md,
    padding: Spacing.sm,
  },
});
