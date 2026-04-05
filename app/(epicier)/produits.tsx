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
import { CategoryPicker } from '../../src/components/epicier/CategoryPicker';
import { CATEGORIES } from '../../src/constants/categories';
import { usePermissions } from '../../src/hooks/usePermissions';
import { STORAGE_KEYS } from '../../src/constants/config';
import { epicerieService } from '../../src/services/epicerieService';
import { productService } from '../../src/services/productService';
import { tagService } from '../../src/services/tagService';
import { LoginResponse, Product, Tag } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';

export default function ProduitsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const { can } = usePermissions(loginData);
  // Filtres
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | undefined>(undefined);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  // Tags
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) setLoginData(JSON.parse(raw));
    });
    loadProducts();
    loadTags();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadTags = async () => {
    try {
      const data = await tagService.getForProductsFr();
      setAvailableTags(data);
    } catch {}
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const loadProducts = async () => {
    try {
      const myEpicerie = await epicerieService.getMyEpicerie();
      const data = await productService.getProductsByEpicerie(myEpicerie.id, true, true);
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les produits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Appliquer les filtres
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedCategoryId, selectedTagIds, products]);

  const applyFilters = () => {
    let filtered = [...products];

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(product =>
        product.nom.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    }

    if (selectedCategoryId !== undefined) {
      filtered = filtered.filter(product => product.categoryId === selectedCategoryId);
    }

    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(product =>
        product.tags?.some(t => selectedTagIds.includes(t.id))
      );
    }

    setFilteredProducts(filtered);
  };

  const resetFilters = () => {
    setSearchText('');
    setSelectedCategoryId(undefined);
    setSelectedSubCategoryId(undefined);
    setSelectedTagIds([]);
  };

  const getSelectedCategoryLabel = () => {
    if (selectedCategoryId === undefined) return null;
    const cat = CATEGORIES.find(c => c.id === selectedCategoryId);
    if (!cat) return null;
    if (selectedSubCategoryId) {
      const sub = cat.subcategories?.find(s => s.id === selectedSubCategoryId);
      if (sub) return `${cat.label} › ${sub.label}`;
    }
    return cat.label;
  };

  const hasActiveFilters = searchText || selectedCategoryId !== undefined || selectedTagIds.length > 0;

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
          <Text style={styles.productPrice}>{formatPrice(item.prix)}</Text>
        </View>
      </View>

      {item.categoryName && (
        <View style={styles.categoryContainer}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>🏷️ {item.categoryName}</Text>
          </View>
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
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          style={[styles.categoryFilterButton, selectedCategoryId !== undefined && styles.categoryFilterButtonActive]}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={[styles.categoryFilterIcon, selectedCategoryId !== undefined && styles.categoryFilterIconActive]}>
            🏷️
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chip catégorie sélectionnée */}
      {selectedCategoryId !== undefined && (
        <View style={styles.activeCategoryBar}>
          <View style={styles.activeCategoryChip}>
            <Text style={styles.activeCategoryText} numberOfLines={1}>
              {getSelectedCategoryLabel()}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedCategoryId(undefined); setSelectedSubCategoryId(undefined); }}>
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
            return (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tagChip,
                  { borderColor: tag.color || '#607D8B' },
                  isSelected && { backgroundColor: tag.color || '#607D8B' },
                ]}
                onPress={() => toggleTag(tag.id)}
                activeOpacity={0.7}
              >
                {isSelected && <Text style={styles.tagChipCheck}>{'✓ '}</Text>}
                <Text style={[
                  styles.tagChipText,
                  { color: isSelected ? '#fff' : (tag.color || '#607D8B') },
                ]}>{tag.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Modal CategoryPicker */}
      <CategoryPicker
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(categoryId, subcategoryId) => {
          setSelectedCategoryId(categoryId);
          setSelectedSubCategoryId(subcategoryId);
        }}
        selectedCategoryId={selectedCategoryId}
        selectedSubcategoryId={selectedSubCategoryId}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>
              {hasActiveFilters ? 'Aucun produit trouvé' : 'Aucun produit'}
            </Text>
            <Text style={styles.emptySubtext}>
              {hasActiveFilters ? 'Essayez de modifier vos filtres' : 'Ajoutez votre premier produit'}
            </Text>
          </View>
        }
      />

      {can('products:create') && (
        <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
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
    maxHeight: 44,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tagsBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tagChipCheck: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
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
    color: '#2196F3',
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
    color: '#2196F3',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
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
    backgroundColor: '#2196F3',
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
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
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
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
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
    backgroundColor: '#2196F3',
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
