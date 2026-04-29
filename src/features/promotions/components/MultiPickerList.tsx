import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface PickItem {
  id: number;
  label: string;
  subtitle?: string;
}

interface Props {
  items: PickItem[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  emptyLabel?: string;
}

/**
 * Liste générique multi-select — réutilisée pour catégories, produits, unités
 * dans le wizard étape "cible".
 */
export function MultiPickerList({ items, selected, onToggle, emptyLabel = '—' }: Props) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={it => String(it.id)}
      renderItem={({ item }) => {
        const isSelected = selected.has(item.id);
        return (
          <TouchableOpacity
            style={[styles.row, isSelected && styles.rowSelected]}
            onPress={() => onToggle(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.check}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
              {item.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  rowSelected: {
    backgroundColor: '#E3F2FD',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#2196F3',
  },
  check: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  sep: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 48,
  },
  empty: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
  },
});
