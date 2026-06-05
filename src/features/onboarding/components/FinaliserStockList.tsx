/**
 * FinaliserStockList — Saisie de stock en masse des produits « brouillon ».
 *
 * Après l'import du catalogue, les produits sont indisponibles avec un stock
 * à 0. Cet écran permet de saisir rapidement le stock initial, regroupé par
 * rayon (accordéon repliable → pas de jank même avec ~100 produits). Il ne
 * gère PAS l'activation à la vente : celle-ci exige une photo et se fait plus
 * tard depuis la fiche produit.
 *
 * Composant « sans scroll » (rend des Views, pas de FlatList) pour pouvoir
 * vivre aussi bien dans le ScrollView du wizard d'onboarding que dans l'écran
 * autonome. Le parent fournit le scroll et le bouton d'action ; la sauvegarde
 * est exposée via ref (save()).
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
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { productService } from '../../../services/productService';
import { stockService } from '../../../services/stockService';
import { categoryService, type Category } from '../../../services/categoryService';
import type { Epicerie, Product } from '../../../type';
import { colors } from '../theme';

const PRIMARY = colors.primary;
const GREEN = colors.success;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface FinaliserStockHandle {
  /** Persiste les stocks modifiés (mouvements RECEPTION). */
  save: () => Promise<{ saved: number; failed: number }>;
  dirtyCount: number;
}

interface FinaliserStockListProps {
  epicerie: Epicerie;
  /** Nombre de lignes modifiées (pour piloter le bouton du parent). */
  onDirtyChange?: (count: number) => void;
  /** Nombre de produits brouillon chargés (pour l'état vide côté parent). */
  onLoaded?: (draftCount: number) => void;
}

interface Rayon {
  id: number;
  name: string;
  products: Product[];
}

/** Stock total d'un produit : somme des variantes, sinon champ legacy. */
function totalStockOf(p: Product): number {
  if (p.units && p.units.length > 0) return p.units.reduce((s, u) => s + (u.stock ?? 0), 0);
  return p.stock ?? 0;
}

export const FinaliserStockList = forwardRef<FinaliserStockHandle, FinaliserStockListProps>(
  function FinaliserStockList({ epicerie, onDirtyChange, onLoaded }, ref) {
    const router = useRouter();
    const [drafts, setDrafts] = useState<Product[]>([]);
    const [categoryTree, setCategoryTree] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);

    // baseline = stock serveur connu ; targets = valeur saisie. dirty = écart.
    const [baseline, setBaseline] = useState<Record<number, number>>({});
    const [targets, setTargets] = useState<Record<number, number>>({});

    useEffect(() => {
      const type = epicerie.epicerieType ?? 'EPICERIE_GENERALE';
      let cancelled = false;
      setLoading(true);
      Promise.all([
        productService.getProductsByEpicerie(epicerie.id, true, true),
        categoryService.getCategoriesByType(type).catch(() => [] as Category[]),
      ])
        .then(([products, tree]) => {
          if (cancelled) return;
          // Brouillons = produits pas encore en vente (importés / non configurés).
          const draftList = products.filter(p => !p.isAvailable);
          setDrafts(draftList);
          setCategoryTree(tree);
          const base: Record<number, number> = {};
          for (const p of draftList) base[p.id] = totalStockOf(p);
          setBaseline(base);
          setTargets({ ...base });
          if (tree.length > 0) setExpanded(new Set([tree[0].id]));
          onLoaded?.(draftList.length);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [epicerie.id, epicerie.epicerieType]);

    // feuille → racine + libellés, depuis l'arbre curaté.
    const { leafToRoot, nameById, rootOrder } = useMemo(() => {
      const leafToRoot = new Map<number, number>();
      const nameById = new Map<number, string>();
      const rootOrder: number[] = [];
      for (const root of categoryTree) {
        rootOrder.push(root.id);
        nameById.set(root.id, root.name);
        leafToRoot.set(root.id, root.id);
        const walk = (nodes: Category[]) => {
          for (const n of nodes) {
            nameById.set(n.id, n.name);
            leafToRoot.set(n.id, root.id);
            if (n.children?.length) walk(n.children);
          }
        };
        walk(root.children ?? []);
      }
      return { leafToRoot, nameById, rootOrder };
    }, [categoryTree]);

    const rayons: Rayon[] = useMemo(() => {
      const byRoot = new Map<number, Product[]>();
      for (const p of drafts) {
        const rootId = (p.categoryId != null ? leafToRoot.get(p.categoryId) : undefined) ?? -1;
        if (!byRoot.has(rootId)) byRoot.set(rootId, []);
        byRoot.get(rootId)!.push(p);
      }
      const order = [...rootOrder];
      if (byRoot.has(-1)) order.push(-1);
      const out: Rayon[] = [];
      for (const rootId of order) {
        const products = byRoot.get(rootId);
        if (!products) continue;
        out.push({ id: rootId, name: nameById.get(rootId) ?? 'Autres', products });
      }
      return out;
    }, [drafts, leafToRoot, rootOrder, nameById]);

    const dirtyIds = useMemo(
      () => drafts.filter(p => (targets[p.id] ?? 0) !== (baseline[p.id] ?? 0)).map(p => p.id),
      [drafts, targets, baseline],
    );

    useEffect(() => { onDirtyChange?.(dirtyIds.length); }, [dirtyIds.length, onDirtyChange]);

    const setTarget = (productId: number, value: number) => {
      setTargets(prev => ({ ...prev, [productId]: Math.max(0, value) }));
    };

    const toggleRayon = (id: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    useImperativeHandle(ref, () => ({
      dirtyCount: dirtyIds.length,
      async save() {
        const ids = [...dirtyIds];
        if (ids.length === 0) return { saved: 0, failed: 0 };
        let saved = 0, failed = 0;
        setSaving({ done: 0, total: ids.length });
        const byId = new Map(drafts.map(p => [p.id, p]));
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const product = byId.get(id);
          const unit = product?.units?.[0];
          const target = targets[id] ?? 0;
          const base = baseline[id] ?? 0;
          try {
            if (!unit) throw new Error('no unit');
            await stockService.adjustStock(id, unit, target - base, 'RECEPTION', 'Stock initial (finalisation catalogue)');
            setBaseline(prev => ({ ...prev, [id]: target }));
            saved++;
          } catch {
            failed++;
          }
          setSaving({ done: i + 1, total: ids.length });
        }
        // Le cache produits est désormais périmé (stocks modifiés).
        productService.invalidateProductsCache(epicerie.id);
        setSaving(null);
        return { saved, failed };
      },
    }), [dirtyIds, drafts, targets, baseline, epicerie.id]);

    if (loading) {
      return (
        <View style={styles.center}><ActivityIndicator color={PRIMARY} size="large" /></View>
      );
    }
    if (drafts.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyText}>Tous vos produits sont déjà configurés.</Text>
        </View>
      );
    }

    return (
      <View style={{ position: 'relative' }}>
        {rayons.map(rayon => {
          const open = rayons.length === 1 || expanded.has(rayon.id);
          const withStock = rayon.products.filter(p => (targets[p.id] ?? 0) > 0).length;
          return (
            <View key={rayon.id} style={styles.section}>
              <TouchableOpacity
                style={[styles.sectionHeader, open && styles.sectionHeaderOpen]}
                onPress={() => toggleRayon(rayon.id)}
                activeOpacity={0.6}
              >
                <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
                <Text style={styles.sectionName} numberOfLines={1}>{rayon.name}</Text>
                <View style={[styles.sectionCount, withStock > 0 && styles.sectionCountActive]}>
                  <Text style={[styles.sectionCountText, withStock > 0 && styles.sectionCountTextActive]}>
                    {withStock}/{rayon.products.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {open && rayon.products.map(product => {
                const unit = product.units?.length === 1 ? product.units[0] : null;
                const multi = (product.units?.length ?? 0) > 1;
                const value = targets[product.id] ?? 0;
                return (
                  <View key={product.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{product.nom}</Text>
                      {!!product.categoryName && (
                        <Text style={styles.rowCat} numberOfLines={1}>{product.categoryName}</Text>
                      )}
                    </View>

                    {multi || !unit ? (
                      <TouchableOpacity
                        style={styles.variantLink}
                        onPress={() => router.push(`/(epicier)/fiche-produit?id=${product.id}`)}
                        hitSlop={6}
                      >
                        <Text style={styles.variantLinkText}>
                          {multi ? 'Plusieurs variantes ›' : 'Configurer ›'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setTarget(product.id, value - 1)}
                          disabled={value <= 0}
                          hitSlop={6}
                        >
                          <Text style={[styles.stepGlyph, value <= 0 && styles.stepGlyphOff]}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.stepInput, value > 0 && styles.stepInputActive]}
                          value={String(value)}
                          onChangeText={t => {
                            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                            setTarget(product.id, isNaN(n) ? 0 : n);
                          }}
                          keyboardType="number-pad"
                          maxLength={5}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setTarget(product.id, value + 1)}
                          hitSlop={6}
                        >
                          <Text style={styles.stepGlyph}>+</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Overlay de progression pendant la sauvegarde séquentielle. */}
        {saving && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={styles.overlayText}>
                Enregistrement… {saving.done}/{saving.total}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  center: { padding: 40, alignItems: 'center' },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 52, gap: 8 },
  sectionHeaderOpen: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#fbfcfe' },
  chevron: { fontSize: 22, color: '#9aa3ad', fontWeight: '700', width: 14, lineHeight: 22 },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: PRIMARY },
  sectionName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  sectionCount: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  sectionCountActive: { backgroundColor: colors.successSoft },
  sectionCountText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  sectionCountTextActive: { color: GREEN },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowCat: { fontSize: 11, color: '#9aa3ad', marginTop: 1 },

  variantLink: { paddingVertical: 6, paddingHorizontal: 8 },
  variantLinkText: { fontSize: 13, fontWeight: '600', color: PRIMARY },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  stepGlyph: { fontSize: 18, fontWeight: '700', color: PRIMARY, lineHeight: 20 },
  stepGlyphOff: { color: '#cbd5e0' },
  stepInput: {
    width: 52,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  stepInputActive: { borderColor: GREEN, color: GREEN, backgroundColor: colors.successSoft },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  overlayText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
