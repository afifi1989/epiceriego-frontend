import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandChip } from './BrandChip';

/**
 * EpicerieFiltersSheet — bottom-sheet unique qui regroupe TOUS les filtres
 * d'une épicerie : catégories, tags, marque active. Remplace l'ancienne UI
 * éclatée (bouton ⚡ Catégories séparé + barre tags chips au-dessus de la
 * liste) par un seul point d'entrée → ⚙ Filtres dans la toolbar.
 *
 * <p>Pattern Glovo / Uber Eats : tous les filtres au même endroit, geste
 * "Réinitialiser / Appliquer" en bas pour valider en lot. Avantage UX :
 * l'utilisateur compose plusieurs filtres (ex. "Bio" + catégorie "Fruits")
 * sans recharger la liste à chaque tap.</p>
 *
 * <p>Le composant gère son <strong>état brouillon local</strong> et ne propage
 * au parent qu'à l'appui sur "Appliquer". L'annulation (close sans appliquer)
 * jette le brouillon. Si l'utilisateur ré-ouvre, on repart de l'état réel.</p>
 */
export interface FilterableCategory {
  id: number;
  name: string;
  /** Emoji déjà résolu côté parent (via getCategoryIcon). */
  icon?: string;
  /** % de réduction si une promo active vise cette catégorie. */
  promoPct?: number;
}

export interface FilterableTag {
  id: number;
  name: string;
  color?: string;
}

export interface ActiveBrand {
  id: number;
  name: string;
  logoUrl?: string | null;
}

export interface EpicerieFiltersSheetProps {
  visible: boolean;
  onClose: () => void;

  categories: FilterableCategory[];
  tags: FilterableTag[];
  activeBrand?: ActiveBrand | null;

  /** État réel actuel — repris comme valeur initiale à l'ouverture. */
  selectedCategoryId: number | null;
  selectedTagIds: number[];

  /** Callbacks au moment d'appliquer (un seul render produits déclenché). */
  onApply: (next: { categoryId: number | null; tagIds: number[] }) => void;
  onClearBrand?: () => void;

  /** Couleur d'accent — boutons, sélections. */
  accentColor: string;
  /** Couleur du texte sur l'accent (CTA "Appliquer"). */
  accentOnColor: string;
  labels?: {
    title?: string;
    categoriesTitle?: string;
    tagsTitle?: string;
    brandTitle?: string;
    findCategory?: string;
    apply?: string;
    reset?: string;
    allCategories?: string;
    removeBrandFilter?: string;
  };
}

export const EpicerieFiltersSheet: React.FC<EpicerieFiltersSheetProps> = ({
  visible,
  onClose,
  categories,
  tags,
  activeBrand,
  selectedCategoryId,
  selectedTagIds,
  onApply,
  onClearBrand,
  accentColor,
  accentOnColor,
  labels,
}) => {
  const insets = useSafeAreaInsets();
  // Brouillon local : initialisé depuis les props à chaque ouverture via `key`
  // sur le Modal interne (forcer re-mount). Plus simple et fiable qu'un
  // useEffect qui synchronise.
  const [draftCategoryId, setDraftCategoryId] = useState<number | null>(selectedCategoryId);
  const [draftTagIds, setDraftTagIds] = useState<number[]>(selectedTagIds);
  const [catSearch, setCatSearch] = useState('');

  // Réinitialise le brouillon à chaque (ré-)ouverture pour rester cohérent
  // avec l'état réel — l'utilisateur s'attend à voir ses filtres actifs.
  React.useEffect(() => {
    if (visible) {
      setDraftCategoryId(selectedCategoryId);
      setDraftTagIds(selectedTagIds);
      setCatSearch('');
    }
  }, [visible, selectedCategoryId, selectedTagIds]);

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const toggleTag = (tagId: number) => {
    setDraftTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const apply = () => {
    onApply({ categoryId: draftCategoryId, tagIds: draftTagIds });
    onClose();
  };

  const reset = () => {
    setDraftCategoryId(null);
    setDraftTagIds([]);
    setCatSearch('');
  };

  const totalActive =
    (draftCategoryId !== null ? 1 : 0) + draftTagIds.length + (activeBrand ? 1 : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{labels?.title ?? 'Filtres'}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Section Marque active ────────────────────────────── */}
          {activeBrand && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels?.brandTitle ?? 'Marque'}</Text>
              <View style={styles.brandRow}>
                <BrandChip
                  name={activeBrand.name}
                  logoUrl={activeBrand.logoUrl}
                  size="md"
                  variant="inline"
                />
                {onClearBrand && (
                  <Pressable
                    onPress={onClearBrand}
                    style={styles.removeBrandBtn}
                    hitSlop={6}
                  >
                    <Text style={styles.removeBrandText}>
                      {labels?.removeBrandFilter ?? 'Retirer'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* ── Section Catégories ──────────────────────────────── */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels?.categoriesTitle ?? 'Catégories'}</Text>
              <View style={styles.catSearchWrap}>
                <Text style={styles.catSearchIcon}>🔍</Text>
                <TextInput
                  style={styles.catSearchInput}
                  placeholder={labels?.findCategory ?? 'Rechercher une catégorie'}
                  value={catSearch}
                  onChangeText={setCatSearch}
                  placeholderTextColor="#AAA"
                />
                {catSearch.length > 0 && (
                  <Pressable onPress={() => setCatSearch('')} hitSlop={4}>
                    <Text style={styles.catSearchClear}>✕</Text>
                  </Pressable>
                )}
              </View>

              {/* "Toutes" en première ligne */}
              <Pressable
                onPress={() => setDraftCategoryId(null)}
                style={[
                  styles.catAllRow,
                  draftCategoryId === null && { borderColor: accentColor, backgroundColor: accentColor + '15' },
                ]}
              >
                <Text style={styles.catAllEmoji}>🛍️</Text>
                <Text
                  style={[
                    styles.catAllLabel,
                    draftCategoryId === null && { color: accentColor, fontWeight: '800' },
                  ]}
                >
                  {labels?.allCategories ?? 'Toutes les catégories'}
                </Text>
                {draftCategoryId === null && (
                  <Text style={[styles.catAllCheck, { color: accentColor }]}>✓</Text>
                )}
              </Pressable>

              {/* Grille catégories */}
              <View style={styles.catGrid}>
                {filteredCategories.map((cat) => {
                  const isSelected = draftCategoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setDraftCategoryId(isSelected ? null : cat.id)}
                      style={[
                        styles.catGridItem,
                        isSelected && { borderColor: accentColor, backgroundColor: accentColor + '15' },
                      ]}
                    >
                      <Text style={styles.catGridEmoji}>{cat.icon ?? '📦'}</Text>
                      {cat.promoPct != null && cat.promoPct > 0 && (
                        <View style={styles.catGridPromo}>
                          <Text style={styles.catGridPromoText}>-{Math.round(cat.promoPct)}%</Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.catGridName,
                          isSelected && { color: accentColor, fontWeight: '800' },
                        ]}
                        numberOfLines={2}
                      >
                        {cat.name}
                      </Text>
                      {isSelected && (
                        <View style={[styles.catGridCheck, { backgroundColor: accentColor }]}>
                          <Text style={styles.catGridCheckText}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Section Tags ──────────────────────────────────────── */}
          {tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels?.tagsTitle ?? 'Tags'}</Text>
              <View style={styles.tagsWrap}>
                {tags.map((tag) => {
                  const isSelected = draftTagIds.includes(tag.id);
                  const c = tag.color || '#607D8B';
                  return (
                    <Pressable
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      style={[
                        styles.tagChip,
                        { borderColor: c, backgroundColor: isSelected ? c : c + '15' },
                      ]}
                    >
                      {isSelected && (
                        <Text style={[styles.tagChipCheck, { color: '#FFF' }]}>{'✓ '}</Text>
                      )}
                      <Text
                        style={[
                          styles.tagChipText,
                          { color: isSelected ? '#FFF' : '#333' },
                        ]}
                      >
                        {tag.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer actions */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.resetBtnText}>{labels?.reset ?? 'Réinitialiser'}</Text>
          </Pressable>
          <Pressable
            onPress={apply}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.applyBtnText, { color: accentOnColor }]}>
              {labels?.apply ?? 'Appliquer'}{totalActive > 0 ? ` (${totalActive})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },

  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ── Brand ────────────────────────────────────────────────────
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeBrandBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  removeBrandText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '700',
  },

  // ── Catégories ────────────────────────────────────────────────
  catSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
    gap: 6,
  },
  catSearchIcon: { fontSize: 14 },
  catSearchInput: { flex: 1, fontSize: 13, color: '#1F1F1F', padding: 0 },
  catSearchClear: { fontSize: 12, color: '#999', fontWeight: '700', paddingHorizontal: 4 },

  catAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  },
  catAllEmoji: { fontSize: 20 },
  catAllLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  catAllCheck: { fontSize: 16, fontWeight: '800' },

  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catGridItem: {
    width: '23.5%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    position: 'relative',
  },
  catGridEmoji: { fontSize: 24, marginBottom: 4 },
  catGridName: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
    fontWeight: '500',
  },
  catGridCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  catGridCheckText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  catGridPromo: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#E53935',
  },
  catGridPromoText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // ── Tags ──────────────────────────────────────────────────────
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  tagChipCheck: { fontSize: 12, fontWeight: '800' },
  tagChipText: { fontSize: 12, fontWeight: '600' },

  // ── Footer ────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
    backgroundColor: '#FFFFFF',
  },
  resetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  applyBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
