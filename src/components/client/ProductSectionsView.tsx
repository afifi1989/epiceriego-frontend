import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Product } from '../../type';

/**
 * ProductSectionsView — affichage des produits groupés par catégorie avec
 * scroll horizontal des items par section. Style Instacart / Picnic /
 * Carrefour Drive : on parcourt les "rayons" comme dans un vrai magasin.
 *
 * <p>Le composant est volontairement passif : il reçoit la liste plate de
 * produits, les groupe par categoryName et délègue le rendu d'une card au
 * `renderCard` du parent (pour réutiliser la même card que les autres
 * modes liste/grille). Le parent garde la responsabilité du cart, du
 * branding et de la navigation.</p>
 *
 * <p>Catégories sans nom sont regroupées sous "Autres" en fallback.</p>
 */
export interface ProductSectionsViewProps {
  products: Product[];
  /** Rendu d'une card produit — réutilise le même renderer que les autres modes. */
  renderCard: (product: Product) => React.ReactElement;
  /** Tap sur le header "Voir tout ›" d'une section. */
  onSeeAllCategory?: (categoryName: string, categoryId?: number) => void;
  /** Couleur d'accent pour les "›" et indicateurs (typiquement brand.primary). */
  accentColor: string;
  /** Largeur d'une card horizontale (par défaut 160px — compact mais lisible). */
  cardWidth?: number;
  /**
   * Enregistre le nœud natif d'une section (indexé par categoryId) pour
   * permettre au parent de scroller vers un rayon (measureLayout). Appelé avec
   * `null` au démontage de la section.
   */
  registerSection?: (categoryId: number | undefined, node: View | null) => void;
  /** Labels traduits. */
  labels: {
    seeAll: string;
    emptyState: string;
    /** Fallback pour les produits sans catégorie. */
    uncategorized: string;
  };
}

interface Section {
  categoryName: string;
  categoryId?: number;
  products: Product[];
}

export const ProductSectionsView: React.FC<ProductSectionsViewProps> = ({
  products,
  renderCard,
  onSeeAllCategory,
  accentColor,
  cardWidth = 160,
  labels,
  registerSection,
}) => {
  // Group products by category. Preserve insertion order (donc l'ordre de
  // pagination backend) — pas de tri alphabétique pour éviter des sauts
  // visuels au load des pages suivantes.
  const sections = useMemo<Section[]>(() => {
    const byName = new Map<string, Section>();
    for (const p of products) {
      const name = p.categoryName?.trim() || labels.uncategorized;
      const existing = byName.get(name);
      if (existing) {
        existing.products.push(p);
      } else {
        byName.set(name, {
          categoryName: name,
          categoryId: p.categoryId,
          products: [p],
        });
      }
    }
    return Array.from(byName.values());
  }, [products, labels.uncategorized]);

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🧺</Text>
        <Text style={styles.emptyText}>{labels.emptyState}</Text>
      </View>
    );
  }

  return (
    <View>
      {sections.map((section) => (
        <View
          key={section.categoryName}
          style={styles.section}
          ref={registerSection ? (node) => registerSection(section.categoryId, node) : undefined}
        >
          {/* Header de section — nom + lien "Voir tout" si callback fourni */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={1}>
              {section.categoryName}
            </Text>
            {onSeeAllCategory && section.products.length >= 4 && (
              <Pressable
                onPress={() => onSeeAllCategory(section.categoryName, section.categoryId)}
                style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.6 }]}
                hitSlop={6}
              >
                <Text style={[styles.seeAllLabel, { color: accentColor }]}>
                  {labels.seeAll}
                </Text>
                <Text style={[styles.seeAllChev, { color: accentColor }]}>›</Text>
              </Pressable>
            )}
          </View>

          {/* Scroll horizontal des cards de cette catégorie */}
          <FlatList
            data={section.products}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => `sec-${section.categoryName}-${item.id}`}
            contentContainerStyle={styles.sectionListContent}
            renderItem={({ item }) => (
              <View style={{ width: cardWidth, marginEnd: 10 }}>
                {renderCard(item)}
              </View>
            )}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingStart: 10,
  },
  seeAllLabel: { fontSize: 13, fontWeight: '700' },
  seeAllChev: { fontSize: 20, fontWeight: '700', lineHeight: 20 },
  sectionListContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  empty: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#666', textAlign: 'center', lineHeight: 21 },
});
