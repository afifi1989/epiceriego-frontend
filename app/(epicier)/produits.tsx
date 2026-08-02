export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { CategoryFilterModal } from '../../src/components/epicier/CategoryFilterModal';
import { categoryService, Category as ApiCategory } from '../../src/services/categoryService';
import { usePermissions } from '../../src/hooks/usePermissions';
import { useSubscription } from '../../src/hooks/useSubscription';
import { useLanguage } from '../../src/context/LanguageContext';
import { STORAGE_KEYS } from '../../src/constants/config';
import { epicerieService } from '../../src/services/epicerieService';
import { productService } from '../../src/services/productService';
import { tagService } from '../../src/services/tagService';
import { Epicerie, LoginResponse, Product, Tag } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';
import { useCurrency } from '../../src/context/CurrencyContext';
import { PromoProductBadge } from '../../src/features/promotions/components';

/** Délai d'inactivité avant d'appliquer la recherche texte (filtrage complet
 *  du catalogue : sensible dès ~200 articles). */
const SEARCH_DEBOUNCE_MS = 250;

export default function ProduitsScreen() {
  const router = useRouter();
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Échec du dernier chargement (réseau/cache vide). Sans lui, l'écran vide
   *  affichait un trompeur "Aucun produit" — l'épicier croyait son catalogue
   *  perdu — et hors-ligne sans cache, AUCUN feedback n'était donné. */
  const [loadError, setLoadError] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const { can } = usePermissions(loginData);
  const { getQuotaMax } = useSubscription();
  const { t } = useLanguage();
  // Filtres
  const [searchText, setSearchText] = useState('');
  /** Recherche débouncée : le filtrage (nom + description sur tout le
   *  catalogue) ne tourne plus à CHAQUE frappe mais 250ms après la dernière.
   *  Les autres filtres (catégorie/tags/promo) restent instantanés — 1 tap
   *  = 1 filtrage voulu. */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  // Catégories — chargées depuis l'API (équivalent web `loadCategories`),
  // pas plus depuis une liste hardcodée locale.
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  // Tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) setLoginData(JSON.parse(raw));
    });
    loadProducts();
    loadTags();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const myEpicerie = await epicerieService.getMyEpicerie();
      if (!myEpicerie) return;
      // Taxonomie plateforme filtrée sur le type de la boutique (imposée par la
      // plateforme, pas dérivée des produits déjà présents). Fallback arbre actif.
      const type = myEpicerie.epicerieType ?? 'EPICERIE_GENERALE';
      const cats = await categoryService.getCategoriesByType(type).catch(() =>
        categoryService.getActiveCategories(),
      );
      setCategories(cats);
    } catch (e) {
      // Silencieux : sans catégories le filtre est juste désactivé, la
      // grille produits reste fonctionnelle.
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadTags = async () => {
    try {
      const data = await tagService.getForProductsFr();
      if (data) setAvailableTags(data);
    } catch (e: any) {
      console.error('[Produits] ERREUR loadTags:', e?.message);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const loadProducts = async () => {
    try {
      const myEpicerie = await epicerieService.getMyEpicerie();
      if (!myEpicerie) throw new Error('Aucune donnée épicerie');
      const data = await productService.getProductsByEpicerie(myEpicerie.id, true, true);
      if (data) {
        setProducts(data);
        setFilteredProducts(data);
        setLoadError(false);
      }
    } catch (error) {
      setLoadError(true);
      Alert.alert('Erreur', 'Impossible de charger les produits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Débounce de la saisie recherche (annulé si l'utilisateur retape avant).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Appliquer les filtres
  useEffect(() => {
    applyFilters();
  }, [debouncedSearch, selectedCategoryId, selectedTagIds, onlyPromo, products]);

  const applyFilters = () => {
    let filtered = [...products];

    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter(product =>
        product.nom.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    }

    if (selectedCategoryId !== null) {
      filtered = filtered.filter(product => product.categoryId === selectedCategoryId);
    }

    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(product =>
        product.tags?.some(t => selectedTagIds.includes(t.id))
      );
    }

    if (onlyPromo) {
      filtered = filtered.filter(product =>
        (product.units ?? []).some(u => u.prixBarre != null && u.prixBarre > u.prix)
      );
    }

    setFilteredProducts(filtered);
  };

  const resetFilters = () => {
    setSearchText('');
    setDebouncedSearch(''); // immédiat — pas d'attente du debounce pour un reset
    setSelectedCategoryId(null);
    setSelectedTagIds([]);
  };

  const getSelectedCategoryLabel = (): string | null => {
    if (selectedCategoryId === null) return null;
    const found = categoryService.findCategoryInTree(categories, selectedCategoryId);
    return found?.name ?? null;
  };

  const hasActiveFilters = searchText || selectedCategoryId !== null || selectedTagIds.length > 0;

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleAddProduct = () => {
    router.push('/(epicier)/fiche-produit');
  };

  const handleEditProduct = (product: Product) => {
    router.push(`/(epicier)/fiche-produit?id=${product.id}`);
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      await productService.toggleAvailability(product.id, !product.isAvailable);
      loadProducts();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier la disponibilité');
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.productImageContainer}>
        {item.photoUrl ? (
          <Image
            source={{ uri: item.photoUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.productImagePlaceholder}>📦</Text>
        )}
      </View>
      
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.nom}</Text>
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        <View style={styles.productPriceContainer}>
          <Text style={styles.productPrice}>{formatPrice(item.prix, currency)}</Text>
          {(() => {
            const u = (item.units ?? []).find(x => x.prixBarre != null && x.prixBarre > x.prix);
            if (!u || !u.prixBarre) return null;
            const pct = Math.round((1 - u.prix / u.prixBarre) * 100);
            return <View style={{ marginTop: 4 }}><PromoProductBadge percentage={pct} compact /></View>;
          })()}
        </View>
      </View>

      {item.categoryName && (
        <View style={styles.categoryContainer}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>🏷️ {item.categoryName}</Text>
          </View>
        </View>
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={styles.productTagsRow}>
          {item.tags.map((t) => (
            <View key={t.id} style={[styles.productTagChip, { borderColor: t.color || '#607D8B', backgroundColor: (t.color || '#607D8B') + '15' }]}>
              <Text style={[styles.productTagText, { color: '#333' }]}>{t.name}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.productMeta}>
        {(() => {
          const stockVal = item.totalStock ?? item.stock ?? 0;
          const stockColor = stockVal <= 0 ? '#e53935' : stockVal <= 5 ? '#f57c00' : '#388e3c';
          const stockBg    = stockVal <= 0 ? '#ffebee' : stockVal <= 5 ? '#fff3e0' : '#e8f5e9';
          return (
            <View style={[styles.metaBadge, { backgroundColor: stockBg }]}>
              <Text style={[styles.metaText, { color: stockColor }]}>
                📦 Stock: {stockVal}
              </Text>
            </View>
          );
        })()}
        {item.units && item.units.length > 0 && (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>🔢 {item.units.length} variante{item.units.length > 1 ? 's' : ''}</Text>
          </View>
        )}
        <View style={[styles.statusBadge, item.isAvailable ? styles.availableBadge : styles.unavailableBadge]}>
          <Text style={styles.statusText}>
            {item.isAvailable ? '✅ Disponible' : '❌ Indisponible'}
          </Text>
        </View>
      </View>

      {can('products:edit') && (
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => handleEditProduct(item)}
          >
            <Text style={styles.actionBtnText}>✏️ Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.toggleBtn]}
            onPress={() => handleToggleAvailability(item)}
          >
            <Text style={styles.actionBtnText}>
              {item.isAvailable ? '🔴 Désactiver' : '🟢 Activer'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Lien rapide vers les Offres / Paniers groupes (feature gated par
          subscription cote backend, mais l'entree reste visible pour faire
          decouvrir la fonctionnalite — le 402 sera affiche au create). */}
      <TouchableOpacity
        style={offresLinkStyles.bar}
        onPress={() => router.push('/(epicier)/offres-paniers')}
        activeOpacity={0.85}
      >
        <Text style={offresLinkStyles.icon}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={offresLinkStyles.title}>Offres & paniers groupés</Text>
          <Text style={offresLinkStyles.subtitle}>
            Créez un panier à prix fixe (ex: Panier Ramadan)
          </Text>
        </View>
        <Text style={offresLinkStyles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Entrée « Ajouter depuis le catalogue » : liste le catalogue seed et
          importe la sélection (produits déjà présents grisés). Gardée par la
          permission de création — au retour, la liste se rafraîchit via
          useFocusEffect. */}
      {can('products:create') && (
        <TouchableOpacity
          style={catalogueLinkStyles.bar}
          onPress={() => router.push('/(epicier)/importer-catalogue')}
          activeOpacity={0.85}
        >
          <Text style={catalogueLinkStyles.icon}>📚</Text>
          <View style={{ flex: 1 }}>
            <Text style={catalogueLinkStyles.title}>{t('catalogueImport.entryTitle')}</Text>
            <Text style={catalogueLinkStyles.subtitle}>{t('catalogueImport.entrySubtitle')}</Text>
          </View>
          <Text style={catalogueLinkStyles.arrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Bannière « à approvisionner » : produits importés/brouillon sans stock.
          Mène à l'écran de saisie de stock en masse. Auto-masquée si count=0. */}
      {(() => {
        const stockOf = (p: Product) =>
          (p.units && p.units.length) ? p.units.reduce((s, u) => s + (u.stock ?? 0), 0) : (p.stock ?? 0);
        const n = products.filter(p => !p.isAvailable && stockOf(p) === 0).length;
        if (n === 0) return null;
        return (
          <TouchableOpacity
            style={stockBannerStyles.bar}
            onPress={() => router.push('/(epicier)/finaliser-catalogue')}
            activeOpacity={0.85}
          >
            <Text style={stockBannerStyles.icon}>📥</Text>
            <View style={{ flex: 1 }}>
              <Text style={stockBannerStyles.title}>
                {n} produit{n > 1 ? 's' : ''} à approvisionner
              </Text>
              <Text style={stockBannerStyles.subtitle}>
                Réglez le stock pour pouvoir les mettre en vente
              </Text>
            </View>
            <Text style={stockBannerStyles.arrow}>›</Text>
          </TouchableOpacity>
        );
      })()}

      <View style={styles.headerStats}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{filteredProducts.length}</Text>
          <Text style={styles.statLabel}>Produits {hasActiveFilters ? 'Filtrés' : 'Total'}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {filteredProducts.filter(p => p.isAvailable).length}
          </Text>
          <Text style={styles.statLabel}>Disponibles</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {filteredProducts.filter(p => p.stock < 10).length}
          </Text>
          <Text style={styles.statLabel}>Stock bas</Text>
        </View>
      </View>

      {/* Quota produits du plan : usage « X / max » + pré-avertissement quand
          on approche (≥ 90%). Masqué si le plan est illimité (max == null). */}
      {(() => {
        const maxProducts = getQuotaMax('maxProducts');
        if (maxProducts == null) return null;
        const used = products.length;
        const nearLimit = maxProducts > 0 && used >= maxProducts * 0.9;
        return (
          <View style={[quotaStyles.bar, nearLimit && quotaStyles.barWarn]}>
            <Text style={[quotaStyles.text, nearLimit && quotaStyles.textWarn]}>
              📦 {t('apiErrors.quotaProducts', { used, max: maxProducts })}
            </Text>
            {nearLimit && (
              <Text style={quotaStyles.warn}>{t('apiErrors.quotaNearLimit')}</Text>
            )}
          </View>
        );
      })()}

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Rechercher un produit..."
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity
          style={[styles.categoryFilterButton, selectedCategoryId !== null && styles.categoryFilterButtonActive]}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={[styles.categoryFilterIcon, selectedCategoryId !== null && styles.categoryFilterIconActive]}>
            🏷️
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.categoryFilterButton,
            onlyPromo && { backgroundColor: '#FFEBEE', borderColor: '#E53935' },
          ]}
          onPress={() => setOnlyPromo(v => !v)}
        >
          <Text style={[styles.categoryFilterIcon, onlyPromo && { color: '#E53935' }]}>
            🔖
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chip catégorie sélectionnée */}
      {selectedCategoryId !== null && (
        <View style={styles.activeCategoryBar}>
          <View style={styles.activeCategoryChip}>
            <Text style={styles.activeCategoryText} numberOfLines={1}>
              {getSelectedCategoryLabel()}
            </Text>
            <TouchableOpacity onPress={() => setSelectedCategoryId(null)}>
              <Text style={styles.activeCategoryClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {searchText ? (
            <TouchableOpacity style={styles.resetAllButton} onPress={resetFilters}>
              <Text style={styles.resetAllText}>Tout effacer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Tags chips */}
      {availableTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsBar} contentContainerStyle={styles.tagsBarContent}>
          {availableTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            const c = tag.color || '#607D8B';
            return (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tagChip,
                  { borderColor: c, backgroundColor: isSelected ? c : c + '15' },
                ]}
                onPress={() => toggleTag(tag.id)}
                activeOpacity={0.7}
              >
                {isSelected && <Text style={[styles.tagChipCheck, { color: '#fff' }]}>{'✓ '}</Text>}
                <Text style={[
                  styles.tagChipText,
                  { color: isSelected ? '#fff' : '#333' },
                ]}>{tag.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Modal Category — alimenté par l'API */}
      <CategoryFilterModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(categoryId) => setSelectedCategoryId(categoryId)}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        loading={categoriesLoading}
      />

      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loadError ? (
            // Échec de chargement ≠ catalogue vide : on le dit clairement,
            // avec la cause (hors-ligne sans cache vs erreur serveur) et un
            // vrai bouton Réessayer.
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={styles.emptyText}>Impossible de charger les produits</Text>
              <Text style={styles.emptySubtext}>
                Vérifiez votre connexion puis réessayez
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { setLoading(true); loadProducts(); }}
                accessibilityRole="button"
                accessibilityLabel="Réessayer le chargement"
              >
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters ? 'Aucun produit trouvé' : 'Aucun produit'}
              </Text>
              <Text style={styles.emptySubtext}>
                {hasActiveFilters ? 'Essayez de modifier vos filtres' : 'Ajoutez votre premier produit'}
              </Text>
            </View>
          )
        }
      />

      {can('products:create') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddProduct}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit"
        >
          <Text style={styles.fabIcon}>➕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tagsBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tagsBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
  },
  tagChipCheck: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  list: {
    padding: 15,
    paddingBottom: 80,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  productImagePlaceholder: {
    fontSize: 48,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  productPriceContainer: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  productTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  productTagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  productTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  categoryText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  subCategoryBadge: {
    backgroundColor: '#f3e5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  subCategoryText: {
    fontSize: 12,
    color: '#7b1fa2',
    fontWeight: '600',
  },
  productMeta: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metaBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  availableBadge: {
    backgroundColor: '#E8F5E9',
  },
  unavailableBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  productActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: Colors.primary,
  },
  toggleBtn: {
    backgroundColor: '#FF9800',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  categoryFilterButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryFilterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryFilterIcon: {
    fontSize: 20,
  },
  categoryFilterIconActive: {
    // emoji stays the same color
  },
  activeCategoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    gap: 10,
  },
  activeCategoryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  activeCategoryText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  activeCategoryClose: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resetAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetAllText: {
    color: '#1976D2',
    fontSize: 13,
    fontWeight: '600',
  },
});

// Style local pour la bar d'acces aux Offres (decoupe pour ne pas polluer
// le 'styles' principal — peut etre extrait en composant plus tard).
const offresLinkStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '700', color: '#212121' },
  subtitle: { fontSize: 12, color: '#757575', marginTop: 2 },
  arrow: { fontSize: 20, color: '#BDBDBD', fontWeight: '600' },
});

// Style local pour l'entree « Ajouter depuis le catalogue » (accent bleu marque).
const catalogueLinkStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '700', color: '#212121' },
  subtitle: { fontSize: 12, color: '#757575', marginTop: 2 },
  arrow: { fontSize: 20, color: '#BDBDBD', fontWeight: '600' },
});

const stockBannerStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '800', color: '#78350F' },
  subtitle: { fontSize: 12, color: '#92400E', marginTop: 2 },
  arrow: { fontSize: 20, color: '#B45309', fontWeight: '700' },
});

// Bandeau quota produits (usage plan). Neutre par défaut, ambré près de la limite.
const quotaStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#F1F5F9',
    marginHorizontal: 15,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  barWarn: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  text: { fontSize: 13, fontWeight: '700', color: '#475569' },
  textWarn: { color: '#92400E' },
  warn: { fontSize: 12, color: '#92400E', marginTop: 2 },
});
