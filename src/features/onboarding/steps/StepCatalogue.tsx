/**
 * StepCatalogue — Étape (obligatoire) : import du catalogue pré-rempli.
 *
 * Charge le seed correspondant au type d'épicerie, l'épicier coche
 * les produits qu'il veut, on POST /import-catalogue à submit().
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { onboardingService } from '../../../services/onboardingService';
import { categoryService, type Category } from '../../../services/categoryService';
import { CategoryPickerModal } from '../../../components/epicier/CategoryPickerModal';
import type { CatalogueItem } from '../types';
import type { StepHandle, StepProps } from './stepProps';
import { useCurrency } from '../../../context/CurrencyContext';
import { formatCurrency } from '../../../utils/formatCurrency';
import { colors } from '../theme';

const PRIMARY = colors.primary;
const GREEN = colors.success;

export const StepCatalogue = forwardRef<StepHandle, StepProps>(
  function StepCatalogue({ epicerie, busy }, ref) {
    const { currency } = useCurrency();
    const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
    const [categoryTree, setCategoryTree] = useState<Category[]>([]);
    const [selectedSeedIds, setSelectedSeedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Filtre catégorie : null = "Toutes". Une seule valeur (racine ou sous-cat).
    // Si une racine est sélectionnée, on garde aussi les produits de ses sous-catégories.
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    useEffect(() => {
      const type = epicerie.epicerieType ?? 'EPICERIE_GENERALE';
      let cancelled = false;
      setLoading(true);

      Promise.all([
        onboardingService.getCatalogue(type),
        categoryService.getCategoriesByType(type).catch(() => [] as Category[]),
      ])
        .then(([items, tree]) => {
          if (cancelled) return;
          setCatalogue(items);
          setCategoryTree(tree);
          setSelectedSeedIds(new Set(items.filter(i => i.preSelected).map(i => i.seedId)));
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }, [epicerie.epicerieType]);

    /**
     * Map categoryId → ensemble des ancêtres (incluant l'id lui-même).
     * Permet de filtrer par catégorie racine ET récupérer les produits
     * rattachés à ses sous-catégories d'un seul coup.
     */
    const ancestorsByCategoryId = useMemo(() => {
      const map = new Map<number, Set<number>>();
      const walk = (nodes: Category[], chain: number[]) => {
        for (const node of nodes) {
          const next = [...chain, node.id];
          map.set(node.id, new Set(next));
          if (node.children?.length) walk(node.children, next);
        }
      };
      walk(categoryTree, []);
      return map;
    }, [categoryTree]);

    /**
     * Liste plate des catégories pour la modal de sélection (racines + sous).
     * Trie par racine puis par level. Inclut un compteur de produits par cat
     * pour aider l'épicier à voir où il y a du contenu.
     */
    const flatCategoriesForPicker = useMemo(() => {
      // Compteur "produits dont l'ancêtre direct ou self == cat.id"
      const counts = new Map<number, number>();
      for (const item of catalogue) {
        if (item.categoryId == null) continue;
        const ancestors = ancestorsByCategoryId.get(item.categoryId);
        if (!ancestors) continue;
        for (const ancestorId of ancestors) {
          counts.set(ancestorId, (counts.get(ancestorId) ?? 0) + 1);
        }
      }
      return categoryService.flattenCategories(categoryTree).map(cat => ({
        ...cat,
        // On enrichit le nom avec le compteur pour l'affichage modal
        name: `${cat.name} · ${counts.get(cat.id) ?? 0}`,
      }));
    }, [catalogue, categoryTree, ancestorsByCategoryId]);

    /** Nom + compteur pour le bouton de sélection (état actuel). */
    const selectedCategoryLabel = useMemo(() => {
      if (selectedCategoryId == null) return null;
      const found = categoryService.findCategoryInTree(categoryTree, selectedCategoryId);
      return found?.name ?? null;
    }, [categoryTree, selectedCategoryId]);

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      return catalogue.filter(item => {
        // Filtre catégorie : item retenu si la cat sélectionnée est dans sa chaîne d'ancêtres
        if (selectedCategoryId != null) {
          const ancestors = item.categoryId != null
            ? ancestorsByCategoryId.get(item.categoryId)
            : undefined;
          if (!ancestors || !ancestors.has(selectedCategoryId)) return false;
        }
        // Filtre recherche texte
        if (q) {
          const match =
            item.nom.toLowerCase().includes(q)
            || item.nomAr?.includes(search)
            || item.categoryName.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
    }, [catalogue, search, selectedCategoryId, ancestorsByCategoryId]);

    const toggle = (seedId: string) => {
      setSelectedSeedIds(prev => {
        const next = new Set(prev);
        if (next.has(seedId)) next.delete(seedId);
        else next.add(seedId);
        return next;
      });
    };

    useImperativeHandle(ref, () => ({
      async submit() {
        if (selectedSeedIds.size === 0) {
          Alert.alert('Sélection vide', 'Cochez au moins un produit.');
          return false;
        }
        try {
          await onboardingService.importCatalogue(epicerie.id, Array.from(selectedSeedIds));
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Import impossible');
          return false;
        }
      },
    }));

    return (
      <View style={{ flex: 1, minHeight: 400 }}>
        {/* ── Barre de stats + actions ── */}
        <View style={styles.header}>
          <Text style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{selectedSeedIds.size}</Text>
            {' / '}
            <Text style={styles.headerStatTotal}>{catalogue.length}</Text>
            {' '}sélectionnés
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setSelectedSeedIds(prev => {
                // Ajoute uniquement les produits actuellement visibles (filtre + recherche).
                const next = new Set(prev);
                for (const item of filtered) next.add(item.seedId);
                return next;
              })}
            >
              <Text style={styles.headerLink}>Tout</Text>
            </TouchableOpacity>
            <Text style={styles.headerSep}>·</Text>
            <TouchableOpacity
              onPress={() => setSelectedSeedIds(prev => {
                // Retire uniquement les produits actuellement visibles.
                const next = new Set(prev);
                for (const item of filtered) next.delete(item.seedId);
                return next;
              })}
            >
              <Text style={styles.headerLink}>Aucun</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recherche ── */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un produit…"
            placeholderTextColor="#9aa3ad"
          />
        </View>

        {/* ── Bouton de filtrage catégorie ── */}
        {categoryTree.length > 0 && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterBtn, selectedCategoryId != null && styles.filterBtnActive]}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterIcon}>🏷️</Text>
              <Text
                style={[
                  styles.filterLabel,
                  selectedCategoryId != null && styles.filterLabelActive,
                ]}
                numberOfLines={1}
              >
                {selectedCategoryLabel ?? 'Toutes les catégories'}
              </Text>
              <Text style={styles.filterChevron}>›</Text>
            </TouchableOpacity>

            {selectedCategoryId != null && (
              <TouchableOpacity
                style={styles.filterClear}
                onPress={() => setSelectedCategoryId(null)}
                hitSlop={8}
              >
                <Text style={styles.filterClearGlyph}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Liste ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={PRIMARY} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun produit ne correspond aux filtres.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.seedId}
            scrollEnabled={false}  // wizard parent scroll géré par ScrollView
            renderItem={({ item }) => {
              const selected = selectedSeedIds.has(item.seedId);
              return (
                <TouchableOpacity
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => toggle(item.seedId)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{item.nom}</Text>
                    {item.nomAr && (
                      <Text style={styles.rowNameAr}>{item.nomAr}</Text>
                    )}
                    <Text style={styles.rowCategory}>{item.categoryName}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowPrice}>
                      {formatCurrency(item.prixSuggere, currency)}
                    </Text>
                    <Text style={styles.rowStock}>Stock {item.stockSuggere}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Modal de sélection de catégorie ── */}
        <CategoryPickerModal
          visible={pickerVisible}
          categories={flatCategoriesForPicker}
          selectedId={selectedCategoryId}
          onSelect={(cat) => setSelectedCategoryId(cat.id)}
          onClose={() => setPickerVisible(false)}
          title="Filtrer par catégorie"
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerStat: { fontSize: 13, color: '#9aa3ad' },
  headerStatValue: { color: PRIMARY, fontWeight: '700', fontSize: 14 },
  headerStatTotal: { color: '#374151', fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLink: { color: PRIMARY, fontSize: 13, fontWeight: '600' },
  headerSep: { color: '#cbd5e0' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.6 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
  },

  // ── Bouton filtre catégorie ──
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  filterBtnActive: {
    borderColor: PRIMARY,
    backgroundColor: '#EFF6FF',
  },
  filterIcon: { fontSize: 16 },
  filterLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  filterLabelActive: { color: PRIMARY },
  filterChevron: {
    fontSize: 20,
    color: '#9aa3ad',
    fontWeight: '600',
    lineHeight: 20,
  },
  filterClear: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  filterClearGlyph: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '700',
  },

  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9aa3ad' },

  center: { padding: 32, alignItems: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  rowSelected: {
    borderColor: GREEN,
    backgroundColor: '#F1F8F2',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowNameAr: { fontSize: 12, color: '#9aa3ad', marginTop: 1 },
  rowCategory: { fontSize: 11, color: '#9aa3ad', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  rowStock: { fontSize: 11, color: '#9aa3ad', marginTop: 2 },
});
