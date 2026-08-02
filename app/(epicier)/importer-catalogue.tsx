export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Écran « Ajouter depuis le catalogue » — import du catalogue seed dans le
 * catalogue de l'épicerie, HORS onboarding (accessible depuis l'écran Produits).
 *
 * Source de données : le NOUVEL endpoint GET /products/catalogue (épicerie
 * dérivée du token) — PAS le contrat onboarding. Chaque item porte
 * `alreadyImported` : les produits déjà présents sont grisés et non
 * sélectionnables. Le style visuel (rayons repliables, sélection multiple,
 * prix suggéré, pas d'image) est repris de StepCatalogue.
 *
 * Les rayons repliés ne montent aucune ligne → pas de jank même sur ~300 items.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { productService } from '../../src/services/productService';
import { categoryService, type Category } from '../../src/services/categoryService';
import { epicerieService } from '../../src/services/epicerieService';
import { normalize } from '../../src/utils/synonymExpansion';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { useCurrency } from '../../src/context/CurrencyContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { colors } from '../../src/features/onboarding/theme';
import type { CatalogueItem, Epicerie } from '../../src/type';

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
  leaves: { id: number; name: string; items: CatalogueItem[] }[];
  items: CatalogueItem[];
}

export default function ImporterCatalogueScreen() {
  const router = useRouter();
  const { currency } = useCurrency();
  const { t } = useLanguage();

  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [selectedSeedIds, setSelectedSeedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [importing, setImporting] = useState(false);
  // Ids des rayons dépliés (ignoré pendant une recherche : tout est ouvert).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const ep = await epicerieService.getMyEpicerie();
        if (cancelled) return;
        setEpicerie(ep ?? null);
        const type = ep?.epicerieType ?? 'EPICERIE_GENERALE';
        const [items, tree] = await Promise.all([
          productService.getCatalogue(),
          categoryService.getCategoriesByType(type).catch(() => [] as Category[]),
        ]);
        if (cancelled) return;
        setCatalogue(items);
        setCategoryTree(tree);
        // Pré-sélection : uniquement les items suggérés ET pas déjà importés.
        setSelectedSeedIds(
          new Set(items.filter(i => i.preSelected && !i.alreadyImported).map(i => i.seedId)),
        );
        if (tree.length > 0) setExpanded(new Set([tree[0].id]));
      } catch (e) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  /** Index dérivés de l'arbre curaté (feuille → rayon, ordre, noms). */
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
      || (it.variants?.some(v => normalize(v).includes(q)) ?? false));
  }, [catalogue, q]);

  /** Regroupe les produits filtrés par rayon puis par feuille (ordre du tree). */
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
      for (const leafId of leafMap.keys()) pushLeaf(leafId);
      result.push({
        id: rootId,
        name: nameById.get(rootId) ?? 'Autres',
        leaves,
        items: flatByRoot.get(rootId)!,
      });
    }
    return result;
  }, [filteredItems, leafToRoot, rootOrder, leavesByRoot, nameById]);

  // Total sélectionnable (hors produits déjà importés).
  const selectableTotal = useMemo(
    () => catalogue.reduce((c, it) => c + (it.alreadyImported ? 0 : 1), 0),
    [catalogue],
  );

  // ── Sélection (les items alreadyImported ne sont jamais touchés) ──────
  const toggle = (item: CatalogueItem) => {
    if (item.alreadyImported) return;
    setSelectedSeedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.seedId)) next.delete(item.seedId);
      else next.add(item.seedId);
      return next;
    });
  };
  const setMany = (items: CatalogueItem[], on: boolean) => {
    setSelectedSeedIds(prev => {
      const next = new Set(prev);
      for (const it of items) {
        if (it.alreadyImported) continue;
        if (on) next.add(it.seedId); else next.delete(it.seedId);
      }
      return next;
    });
  };
  const selectableOf = (items: CatalogueItem[]) => items.filter(it => !it.alreadyImported);
  const countSelected = (items: CatalogueItem[]) =>
    items.reduce((c, it) => c + (selectedSeedIds.has(it.seedId) ? 1 : 0), 0);

  // ── Pliage ───────────────────────────────────────────────────────────
  const toggleRayon = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const isExpanded = (id: number) => !!q || rayons.length === 1 || expanded.has(id);

  // ── Import ───────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (selectedSeedIds.size === 0) {
      Alert.alert(
        t('catalogueImport.emptySelectionTitle'),
        t('catalogueImport.emptySelectionMessage'),
      );
      return;
    }
    setImporting(true);
    try {
      const result = await productService.importFromCatalogue(Array.from(selectedSeedIds));
      // Purge le cache produits AVANT de revenir : l'écran Produits recharge
      // via useFocusEffect et doit voir les nouveaux brouillons.
      if (epicerie) productService.invalidateProductsCache(epicerie.id);
      Alert.alert(
        t('catalogueImport.importedTitle'),
        t('catalogueImport.importedMessage', { count: result.importedCount }),
        [
          { text: t('catalogueImport.laterCta'), style: 'cancel', onPress: () => router.back() },
          {
            text: t('catalogueImport.finalizeCta'),
            onPress: () => router.replace('/(epicier)/finaliser-catalogue'),
          },
        ],
      );
    } catch (e: any) {
      // 402/403 sont déjà gérés par l'intercepteur api.ts (upsell / accès refusé).
      // On n'affiche un message générique que pour le reste.
      if (!e?.__subscriptionGateHandled && e?.response?.status !== 403) {
        Alert.alert(
          t('catalogueImport.importErrorTitle'),
          t('catalogueImport.importErrorMessage'),
        );
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header maison (back + titre) */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('catalogueImport.screenTitle')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.centerText}>{t('catalogueImport.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>📡</Text>
          <Text style={styles.errorTitle}>{t('catalogueImport.loadErrorTitle')}</Text>
          <Text style={styles.errorMessage}>{t('catalogueImport.loadErrorMessage')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>{t('catalogueImport.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Bandeau info */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>{t('catalogueImport.infoBanner')}</Text>
            </View>

            {/* Stats + actions globales */}
            <View style={styles.statsRow}>
              <Text style={styles.statText}>
                {t('catalogueImport.selectedCount', {
                  count: selectedSeedIds.size,
                  total: selectableTotal,
                })}
              </Text>
              <View style={styles.statsActions}>
                <TouchableOpacity onPress={() => setMany(filteredItems, true)}>
                  <Text style={styles.headerLink}>
                    {q ? t('catalogueImport.selectAllResults') : t('catalogueImport.selectAll')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.headerSep}>·</Text>
                <TouchableOpacity onPress={() => setMany(filteredItems, false)}>
                  <Text style={styles.headerLink}>{t('catalogueImport.selectNone')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recherche */}
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('catalogueImport.searchPlaceholder')}
                placeholderTextColor="#9aa3ad"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Sections par rayon */}
            {catalogue.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📦</Text>
                <Text style={styles.emptyTitle}>{t('catalogueImport.emptyTitle')}</Text>
                <Text style={styles.emptyText}>{t('catalogueImport.emptyMessage')}</Text>
              </View>
            ) : rayons.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{t('catalogueImport.emptySearch')}</Text>
              </View>
            ) : (
              rayons.map(rayon => {
                const open = isExpanded(rayon.id);
                const selectable = selectableOf(rayon.items);
                const sel = countSelected(rayon.items);
                const all = selectable.length > 0 && sel === selectable.length;
                return (
                  <View key={rayon.id} style={styles.section}>
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
                            {sel}/{selectable.length}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.sectionToggle}
                        onPress={() => setMany(rayon.items, !all)}
                        disabled={importing || selectable.length === 0}
                        hitSlop={6}
                      >
                        <View style={[
                          styles.checkbox,
                          all && styles.checkboxChecked,
                          !all && sel > 0 && styles.checkboxPartial,
                          selectable.length === 0 && styles.checkboxDisabled,
                        ]}>
                          {all && <Text style={styles.checkmark}>✓</Text>}
                          {!all && sel > 0 && <View style={styles.partialDash} />}
                        </View>
                      </TouchableOpacity>
                    </View>

                    {open && rayon.leaves.map(leaf => (
                      <View key={leaf.id}>
                        {leaf.id !== rayon.id && (
                          <Text style={styles.leafHeader}>{leaf.name} · {leaf.items.length}</Text>
                        )}
                        {leaf.items.map(item => {
                          const done = item.alreadyImported;
                          const selected = selectedSeedIds.has(item.seedId);
                          return (
                            <TouchableOpacity
                              key={item.seedId}
                              style={[styles.row, selected && styles.rowSelected, done && styles.rowDisabled]}
                              onPress={() => toggle(item)}
                              disabled={importing || done}
                              activeOpacity={done ? 1 : 0.7}
                            >
                              <View style={[
                                styles.checkbox,
                                selected && styles.checkboxChecked,
                                done && styles.checkboxDisabled,
                              ]}>
                                {selected && <Text style={styles.checkmark}>✓</Text>}
                                {done && <Text style={styles.checkmarkDone}>✓</Text>}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.rowName, done && styles.textMuted]}>{item.nom}</Text>
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
                                {done ? (
                                  <Text style={styles.alreadyBadge}>{t('catalogueImport.alreadyAdded')}</Text>
                                ) : (
                                  <>
                                    <Text style={styles.rowPrice}>{formatCurrency(item.prixSuggere, currency)}</Text>
                                    <Text style={styles.rowStock}>{t('catalogueImport.stockToSet')}</Text>
                                  </>
                                )}
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
          </ScrollView>

          {/* Footer « Ajouter (N) » */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleImport}
              disabled={selectedSeedIds.size === 0 || importing}
              style={({ pressed }) => [
                styles.addBtn,
                (selectedSeedIds.size === 0 || importing) && styles.addBtnDisabled,
                pressed && selectedSeedIds.size > 0 && !importing && styles.addBtnPressed,
              ]}
            >
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addBtnText}>
                  {t('catalogueImport.addButton', { count: selectedSeedIds.size })}
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 24, color: colors.text },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { marginTop: 12, fontSize: 13, color: '#9aa3ad' },
  errorEmoji: { fontSize: 44, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4, textAlign: 'center' },
  errorMessage: { fontSize: 13, color: '#9aa3ad', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: PRIMARY, fontWeight: '600', fontSize: 14 },

  body: { padding: 16, paddingBottom: 32 },

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

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statText: { fontSize: 13, color: '#9aa3ad' },
  statsActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  rowDisabled: { backgroundColor: '#F8FAFC', opacity: 0.7 },
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
  checkboxDisabled: { backgroundColor: '#E2E8F0', borderColor: '#CBD5E0' },
  partialDash: { width: 10, height: 2, borderRadius: 1, backgroundColor: GREEN },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkmarkDone: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  textMuted: { color: '#94a3b8' },
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
  variantsLine: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  rowStock: { fontSize: 11, color: '#9aa3ad', marginTop: 2 },
  alreadyBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },

  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9aa3ad', textAlign: 'center' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  addBtn: {
    backgroundColor: colors.primary,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: colors.borderStrong },
  addBtnPressed: { backgroundColor: colors.primaryDark },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
