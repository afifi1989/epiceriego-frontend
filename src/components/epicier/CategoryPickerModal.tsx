/**
 * CategoryPickerModal — Sélecteur de catégorie moderne avec recherche rapide.
 *
 * Remplace le Picker natif (pénible avec beaucoup de catégories) par une
 * modale plein écran (pageSheet sur iOS) qui :
 *  - Affiche la liste hiérarchique avec indentation par niveau
 *  - Filtre instantanément à la frappe (accent-insensible)
 *  - Met en évidence la catégorie sélectionnée
 *  - Ferme sur tap (pas de bouton Confirmer — un tap = sélection)
 *
 * Réutilisable : utilisé par l'InfoTab de la fiche produit, mais peut aussi
 * être branché à n'importe quel écran qui doit choisir une catégorie.
 *
 * Props :
 *  - `visible`     : booléen contrôlé par le parent
 *  - `categories`  : liste FLAT (déjà passée dans flattenCategories) avec `level`
 *  - `selectedId`  : id de la catégorie actuellement choisie (ou null)
 *  - `onSelect`    : callback(category) — appelé au tap, la modale se referme après
 *  - `onClose`     : callback — fermeture sans sélection (bouton Annuler / swipe)
 *  - `title`       : titre de la modale (par défaut "Choisir une catégorie")
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Category } from '../../services/categoryService';

interface CategoryPickerModalProps {
  visible: boolean;
  categories: Category[];
  selectedId: number | null;
  onSelect: (category: Category) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Normalise une chaîne pour la recherche : lowercase + suppression des
 * accents latins courants. Suffisant pour le FR ; pour l'AR le moteur
 * substring fonctionne déjà sans normalisation.
 */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûü]/g, 'u')
    .replace(/[ç]/g, 'c');

export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
  title = 'Choisir une catégorie',
}) => {
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  // Reset + focus à chaque ouverture
  useEffect(() => {
    if (visible) {
      setQuery('');
      // Petit délai pour laisser l'animation de la modale finir avant le focus
      const t = setTimeout(() => searchRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Index parent → nom (pour afficher le breadcrumb des sous-catégories)
  const parentNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Filtrage instantané. Sans query → liste complète (hiérarchie préservée).
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return categories;
    return categories.filter((c) => normalize(c.name).includes(q));
  }, [categories, query]);

  const renderItem = ({ item }: { item: Category }) => {
    const isSelected = item.id === selectedId;
    const level = item.level ?? 0;
    const parentName =
      item.parentId != null ? parentNameById.get(item.parentId) : undefined;

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => {
          onSelect(item);
          onClose();
        }}
        activeOpacity={0.6}
      >
        {/* Indentation visuelle : une barre verticale par niveau */}
        <View style={{ width: level * 14 }}>
          {level > 0 && (
            <View style={[styles.levelBar, { marginLeft: (level - 1) * 14 + 6 }]} />
          )}
        </View>

        <View style={styles.rowContent}>
          <Text
            style={[styles.rowName, isSelected && styles.rowNameSelected]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {parentName && (
            <Text style={styles.rowParent} numberOfLines={1}>
              {parentName}
            </Text>
          )}
        </View>

        {isSelected && <Text style={styles.checkIcon}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      transparent={false}
    >
      <SafeAreaView style={styles.container}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} hitSlop={10}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.cancelBtn} />
        </View>

        {/* ── Barre de recherche ─────────────────────────────── */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher une catégorie..."
              placeholderTextColor="#999"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS !== 'ios' && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Liste ──────────────────────────────────────────── */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyText}>
                {query
                  ? `Aucune catégorie pour "${query}"`
                  : 'Aucune catégorie disponible'}
              </Text>
            </View>
          }
          // Petites optimisations perfs pour les listes longues
          initialNumToRender={20}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── Header ─────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelBtn: {
    minWidth: 70,
  },
  cancelText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },

  // ── Search ─────────────────────────────────────────
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#666',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0, // réinitialise le padding par défaut Android
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
    paddingHorizontal: 4,
  },

  // ── List rows ──────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  rowSelected: {
    backgroundColor: '#e3f2fd',
  },
  levelBar: {
    width: 2,
    height: 20,
    backgroundColor: '#d0d7de',
    borderRadius: 1,
  },
  rowContent: {
    flex: 1,
    marginLeft: 4,
  },
  rowName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  rowNameSelected: {
    color: '#1976d2',
    fontWeight: '700',
  },
  rowParent: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: '700',
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },

  // ── Empty state ────────────────────────────────────
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
});
