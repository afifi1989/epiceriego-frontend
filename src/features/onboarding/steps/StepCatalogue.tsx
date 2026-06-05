/**
 * StepCatalogue — Étape (obligatoire) : import du catalogue pré-rempli.
 *
 * Le catalogue seed est groupé par RAYON (catégorie racine curatée) dans des
 * sections repliables, avec sous-en-têtes par sous-catégorie feuille. L'épicier
 * coche les produits (ou un rayon entier), puis on POST /import-catalogue à
 * submit(). Les sections repliées ne montent aucune ligne → pas de jank même
 * sur EPICERIE_GENERALE (300 produits).
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
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { onboardingService } from '../../../services/onboardingService';
import { categoryService, type Category } from '../../../services/categoryService';
import { normalize } from '../../../utils/synonymExpansion';
import type { CatalogueItem } from '../types';
import type { StepHandle, StepProps } from './stepProps';
import { useCurrency } from '../../../context/CurrencyContext';
import { formatCurrency } from '../../../utils/formatCurrency';
import { colors } from '../theme';

const PRIMARY = colors.primary;
const GREEN = colors.success;

// Active LayoutAnimation sur Android (déplier/replier fluide).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Un rayon (catégorie racine) avec ses produits regroupés par feuille. */
interface Rayon {
  id: number;
  name: string;
  /** Produits du rayon, regroupés par sous-catégorie feuille (ordre du tree). */
  leaves: { id: number; name: string; items: CatalogueItem[] }[];
  /** Liste plate de tous les produits du rayon (compteurs + sélection groupée). */
  items: CatalogueItem[];
}

export const StepCatalogue = forwardRef<StepHandle, StepProps>(
  function StepCatalogue({ epicerie, busy }, ref) {
    const { currency } = useCurrency();
    const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
    const [categoryTree, setCategoryTree] = useState<Category[]>([]);
    const [selectedSeedIds, setSelectedSeedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    // Ids des rayons dépliés (état ignoré pendant une recherche : tout est ouvert).
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

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
          // Déplie le premier rayon pour que l'écran ne paraisse pas vide.
          if (tree.length > 0) setExpanded(new Set([tree[0].id]));
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }, [epicerie.epicerieType]);

    /**
     * Index dérivés de l'arbre curaté : feuille → rayon racine, id → nom,
     * ordre des rayons et ordre des feuilles par rayon (pour un rendu stable
     * cohérent avec la taxonomie). Une racine se mappe sur elle-même pour les
     * produits rattachés à une racine (fallbacks du seed).
     */
    const { leafToRoot, nameById, rootOrder, leavesByRoot } = useMemo(() => {
      const leafToRoot = new Map<number, number>();
      const nameById = new Map<number, string>();
      const rootOrder: number[] = [];
      const leavesByRoot = new Map<number, number[]>();
      for (const root of categoryTree) {
        rootOrder.push(root.id);
        nameById.set(root.id, root.name);
        leafToRoot.set(root.id, root.id);
        const leaves: number[] = [];
        const walk = (nodes: Category[]) => {
          for (const n of nodes) {
            nameById.set(n.id, n.name);
            leafToRoot.set(n.id, root.id);
            if (n.children?.length) walk(n.children);
            else leaves.push(n.id);
          }
        };
        walk(root.children ?? []);
        leavesByRoot.set(root.id, leaves);
      }
      return { leafToRoot, nameById, rootOrder, leavesByRoot };
    }, [categoryTree]);

    const q = useMemo(() => normalize(search), [search]);

    const filteredItems = useMemo(() => {
      if (!q) return catalogue;
      return catalogue.filter(it =>
        normalize(it.nom).includes(q)
        || normalize(it.nomAr).includes(q)
        || normalize(it.categoryName).includes(q)
        // Les formats sont des variantes depuis V112 : "5l" doit matcher
        // "Huile de table Lesieur" via sa variante "5L".
        || (it.variants?.some(v => normalize(v).includes(q)) ?? false));
    }, [catalogue, q]);

    /** Regroupe les produits filtrés par rayon puis par feuille, dans l'ordre du tree. */
    const rayons: Rayon[] = useMemo(() => {
      const byRoot = new Map<number, Map<number, CatalogueItem[]>>();
      const flatByRoot = new Map<number, CatalogueItem[]>();
      for (const it of filteredItems) {
        const leafId = it.categoryId ?? -1;
        const rootId = leafToRoot.get(leafId) ?? -1;
        if (!byRoot.has(rootId)) { byRoot.set(rootId, new Map()); flatByRoot.set(rootId, []); }
        const leafMap = byRoot.get(rootId)!;
        if (!leafMap.has(leafId)) leafMap.set(leafId, []);
        leafMap.get(leafId)!.push(it);
        flatByRoot.get(rootId)!.push(it);
      }

      const order = [...rootOrder];
      if (byRoot.has(-1)) order.push(-1); // bucket "Autres" si tree absent/incomplet

      const result: Rayon[] = [];
      for (const rootId of order) {
        const leafMap = byRoot.get(rootId);
        if (!leafMap) continue;
        const leaves: Rayon['leaves'] = [];
        const seen = new Set<number>();
        const pushLeaf = (leafId: number) => {
          const items = leafMap.get(leafId);
          if (!items || seen.has(leafId)) return;
          seen.add(leafId);
          leaves.push({ id: leafId, name: nameById.get(leafId) ?? '', items });
        };
        for (const leafId of (leavesByRoot.get(rootId) ?? [])) pushLeaf(leafId);
        for (const leafId of leafMap.keys()) pushLeaf(leafId); // restes (racine-feuille, inconnus)
        result.push({
          id: rootId,
          name: nameById.get(rootId) ?? 'Autres',
          leaves,
          items: flatByRoot.get(rootId)!,
        });
      }
      return result;
    }, [filteredItems, leafToRoot, rootOrder, leavesByRoot, nameById]);

    // ── Sélection ──────────────────────────────────────────────────────
    const toggle = (seedId: string) => {
      setSelectedSeedIds(prev => {
        const next = new Set(prev);
        if (next.has(seedId)) next.delete(seedId);
        else next.add(seedId);
        return next;
      });
    };
    const setMany = (items: CatalogueItem[], on: boolean) => {
      setSelectedSeedIds(prev => {
        const next = new Set(prev);
        for (const it of items) { if (on) next.add(it.seedId); else next.delete(it.seedId); }
        return next;
      });
    };
    const countSelected = (items: CatalogueItem[]) =>
      items.reduce((c, it) => c + (selectedSeedIds.has(it.seedId) ? 1 : 0), 0);

    // ── Pliage ─────────────────────────────────────────────────────────
    const toggleRayon = (id: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };
    // Pendant une recherche, ou s'il n'y a qu'un rayon, tout est déplié.
    const isExpanded = (id: number) => !!q || rayons.length === 1 || expanded.has(id);

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
        {/* ── Bandeau d'info ── */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Choisissez les produits que vous vendez — touchez un rayon pour le
            déplier, ou cochez-le en entier d’un geste.
            {'\n\n'}
            <Text style={styles.infoBold}>Les produits importés seront indisponibles à la vente avec un stock à 0.</Text>
            {' '}Vous réglerez ensuite stock, photo et prix avant de les activer.
          </Text>
        </View>

        {/* ── Barre de stats + actions globales ── */}
        <View style={styles.header}>
          <Text style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{selectedSeedIds.size}</Text>
            {' / '}
            <Text style={styles.headerStatTotal}>{catalogue.length}</Text>
            {' '}sélectionnés
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setMany(filteredItems, true)}>
              <Text style={styles.headerLink}>{q ? 'Tout cocher (résultats)' : 'Tout cocher'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerSep}>·</Text>
            <TouchableOpacity onPress={() => setMany(filteredItems, false)}>
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
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sections par rayon ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={PRIMARY} size="large" />
          </View>
        ) : rayons.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun produit ne correspond à « {search} ».</Text>
          </View>
        ) : (
          rayons.map(rayon => {
            const open = isExpanded(rayon.id);
            const sel = countSelected(rayon.items);
            const all = sel === rayon.items.length && rayon.items.length > 0;
            return (
              <View key={rayon.id} style={styles.section}>
                {/* En-tête de rayon */}
                <View style={[styles.sectionHeader, open && styles.sectionHeaderOpen]}>
                  <TouchableOpacity
                    style={styles.sectionHeaderMain}
                    onPress={() => toggleRayon(rayon.id)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
                    <Text style={styles.sectionName} numberOfLines={1}>{rayon.name}</Text>
                    <View style={[styles.sectionCount, sel > 0 && styles.sectionCountActive]}>
                      <Text style={[styles.sectionCountText, sel > 0 && styles.sectionCountTextActive]}>
                        {sel}/{rayon.items.length}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sectionToggle}
                    onPress={() => setMany(rayon.items, !all)}
                    disabled={busy}
                    hitSlop={6}
                  >
                    <View style={[
                      styles.checkbox,
                      all && styles.checkboxChecked,
                      !all && sel > 0 && styles.checkboxPartial,
                    ]}>
                      {all && <Text style={styles.checkmark}>✓</Text>}
                      {!all && sel > 0 && <View style={styles.partialDash} />}
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Contenu (uniquement si déplié → pas de montage inutile) */}
                {open && rayon.leaves.map(leaf => (
                  <View key={leaf.id}>
                    {leaf.id !== rayon.id && (
                      <Text style={styles.leafHeader}>{leaf.name} · {leaf.items.length}</Text>
                    )}
                    {leaf.items.map(item => {
                      const selected = selectedSeedIds.has(item.seedId);
                      return (
                        <TouchableOpacity
                          key={item.seedId}
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
                            {!!item.nomAr && <Text style={styles.rowNameAr}>{item.nomAr}</Text>}
                            {!!item.brand && (
                              <View style={styles.brandPill}>
                                <Text style={styles.brandPillText}>{item.brand}</Text>
                              </View>
                            )}
                            {!!item.variants?.length && (
                              <Text style={styles.variantsLine} numberOfLines={1}>
                                {item.variants.join(' · ')}
                              </Text>
                            )}
                          </View>
                          <View style={styles.rowRight}>
                            <Text style={styles.rowPrice}>{formatCurrency(item.prixSuggere, currency)}</Text>
                            <Text style={styles.rowStock}>Stock 0 (à régler)</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  // ── Bandeau info ──
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 10,
    marginBottom: 14,
  },
  infoIcon: { fontSize: 18, lineHeight: 22 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#92400E' },
  infoBold: { fontWeight: '700', color: '#78350F' },

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
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  searchClear: { fontSize: 14, color: '#9aa3ad', fontWeight: '700', paddingHorizontal: 4 },

  // ── Section rayon ──
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 52,
  },
  sectionHeaderOpen: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#fbfcfe' },
  sectionHeaderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 8 },
  chevron: { fontSize: 22, color: '#9aa3ad', fontWeight: '700', width: 14, lineHeight: 22 },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: PRIMARY },
  sectionName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  sectionCount: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sectionCountActive: { backgroundColor: colors.successSoft },
  sectionCountText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  sectionCountTextActive: { color: GREEN },
  sectionToggle: { padding: 8 },

  // ── Sous-en-tête feuille ──
  leafHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#fbfcfe',
  },

  // ── Ligne produit ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rowSelected: { backgroundColor: '#F1F8F2' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkboxPartial: { borderColor: GREEN },
  partialDash: { width: 10, height: 2, borderRadius: 1, backgroundColor: GREEN },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowNameAr: { fontSize: 12, color: '#9aa3ad', marginTop: 1 },
  brandPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 3,
  },
  brandPillText: { fontSize: 10, fontWeight: '600', color: '#1D4ED8', letterSpacing: 0.2 },
  // Formats de vente du produit (V112) — ex: "500ml · 1L · 5L"
  variantsLine: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  rowStock: { fontSize: 11, color: '#9aa3ad', marginTop: 2 },

  center: { padding: 32, alignItems: 'center' },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9aa3ad' },
});
