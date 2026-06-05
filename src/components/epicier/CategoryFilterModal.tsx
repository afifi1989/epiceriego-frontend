/**
 * CategoryFilterModal — Sélecteur de catégorie pour filtrer une liste
 * de produits (POS, gestion produits).
 *
 * Aligné sur le comportement web (`vente-directe.component.ts`) :
 * - Les catégories sont fournies par le parent via API (categoryService).
 * - Affichage en liste plate (flatten + indentation si hiérarchie).
 * - Recherche par nom, case-insensitive.
 * - Une seule sélection à la fois ; "Toutes les catégories" pour clear.
 *
 * Le filtrage des produits se fait ensuite par `product.categoryId === selectedId`
 * (les IDs proviennent de la DB, donc le match fonctionne).
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category } from '../../services/categoryService';
import { categoryService } from '../../services/categoryService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: number | null) => void;
  categories: Category[];
  selectedCategoryId: number | null;
  /** Affiché en haut du loader si vide en attendant l'API. */
  loading?: boolean;
}

const PRIMARY = '#2196F3';

export function CategoryFilterModal({
  visible,
  onClose,
  onSelect,
  categories,
  selectedCategoryId,
  loading,
}: Props) {
  const [search, setSearch] = useState('');

  // Aplatit l'arbre pour un affichage liste avec indentation.
  // Si la liste API est déjà plate (pas de children), flattenCategories
  // retourne simplement la même liste avec level=0.
  const flat = useMemo(() => categoryService.flattenCategories(categories), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter(c => c.name.toLowerCase().includes(q));
  }, [flat, search]);

  const handleSelect = (id: number | null) => {
    onSelect(id);
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Filtrer par catégorie</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Recherche */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une catégorie…"
            placeholderTextColor="#bbb"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* Liste */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => `cat-${item.id}`}
          ListHeaderComponent={
            // Option "Toutes" en tête, masquée pendant une recherche pour
            // éviter le bruit visuel (le user cherche une catégorie précise).
            !search ? (
              <TouchableOpacity
                style={[styles.row, selectedCategoryId === null && styles.rowSelected]}
                onPress={() => handleSelect(null)}
              >
                <MaterialCommunityIcons
                  name="view-grid-outline"
                  size={20}
                  color={selectedCategoryId === null ? PRIMARY : '#666'}
                />
                <Text style={[styles.rowText, selectedCategoryId === null && styles.rowTextSelected]}>
                  Toutes les catégories
                </Text>
                {selectedCategoryId === null && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={PRIMARY} />
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="folder-search-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>
                {loading ? 'Chargement…' : (search ? 'Aucune catégorie' : 'Aucune catégorie disponible')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedCategoryId === item.id;
            const indent = (item.level ?? 0) * 16;
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected, { paddingLeft: 16 + indent }]}
                onPress={() => handleSelect(item.id)}
              >
                <MaterialCommunityIcons
                  name={(item.level ?? 0) > 0 ? 'subdirectory-arrow-right' : 'tag-outline'}
                  size={18}
                  color={isSelected ? PRIMARY : '#666'}
                />
                <Text
                  style={[styles.rowText, isSelected && styles.rowTextSelected]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {isSelected && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={PRIMARY} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#222' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#222', paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowSelected: { backgroundColor: '#E3F2FD' },
  rowText: { flex: 1, fontSize: 15, color: '#333' },
  rowTextSelected: { color: PRIMARY, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: '#999', fontSize: 14 },
});
