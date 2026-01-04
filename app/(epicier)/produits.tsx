import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Category, categoryService, SubCategory } from '../../src/services/categoryService';
import { productService } from '../../src/services/productService';
import { Product } from '../../src/type';
import { formatPrice } from '../../src/utils/helpers';

export default function ProduitsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  
  // Filtres
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
    try {
      const data = await productService.getAllProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les produits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await categoryService.getActiveCategories();
      setCategories(data);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const loadSubCategories = async (categoryId: number) => {
    try {
      const data = await categoryService.getActiveSubCategories(categoryId);
      setSubCategories(data);
    } catch (error) {
      console.error('Erreur chargement sous-catégories:', error);
      setSubCategories([]);
    }
  };

  // Appliquer les filtres
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedCategoryId, selectedSubCategoryId, products]);

  // Charger les sous-catégories quand la catégorie change
  useEffect(() => {
    if (selectedCategoryId) {
      loadSubCategories(parseInt(selectedCategoryId));
    } else {
      setSubCategories([]);
      setSelectedSubCategoryId('');
    }
  }, [selectedCategoryId]);

  const applyFilters = () => {
    let filtered = [...products];

    // Filtre par recherche texte
    if (searchText.trim()) {2
      const search = searchText.toLowerCase();
      filtered = filtered.filter(product =>
        product.nom.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    }

    // Filtre par catégorie
    if (selectedCategoryId) {
      filtered = filtered.filter(product =>
        product.categoryId?.toString() === selectedCategoryId
      );
    }

    // Filtre par sous-catégorie
    if (selectedSubCategoryId) {
      filtered = filtered.filter(product =>
        product.categoryId?.toString() === selectedSubCategoryId
      );
    }

    setFilteredProducts(filtered);
  };

  const resetFilters = () => {
    setSearchText('');
    setSelectedCategoryId('');
    setSelectedSubCategoryId('');
    setSubCategories([]);
  };

  const hasActiveFilters = searchText || selectedCategoryId || selectedSubCategoryId;

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleAddProduct = () => {
    router.push('/(epicier)/ajouter-produit');
  };

  const handleEditProduct = (product: Product) => {
    router.push(`/(epicier)/modifier-produit?id=${product.id}`);
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      // TODO: Appeler l'API pour changer la disponibilité
      Alert.alert(
        'Succès',
        `${product.nom} est maintenant ${product.isAvailable ? 'indisponible' : 'disponible'}`
      );
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
        <View style={styles.metaBadge}>
          <Text style={styles.metaText}>📦 Stock: {item.stock}</Text>
        </View>
        <View style={[styles.statusBadge, item.isAvailable ? styles.availableBadge : styles.unavailableBadge]}>
          <Text style={styles.statusText}>
            {item.isAvailable ? '✅ Disponible' : '❌ Indisponible'}
          </Text>
        </View>
      </View>

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
          style={styles.filterToggleButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterToggleIcon}>
            {showFilters ? '▲' : '▼'} Filtres
          </Text>
        </TouchableOpacity>
      </View>

      {/* Panneau de filtres */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Catégorie:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedCategoryId}
                onValueChange={(value) => setSelectedCategoryId(value)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="Toutes les catégories" value="" />
                {categories.map((cat) => (
                  <Picker.Item key={cat.id} label={cat.name} value={cat.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>

          {selectedCategoryId && subCategories.length > 0 && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Sous-catégorie:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedSubCategoryId}
                  onValueChange={(value) => setSelectedSubCategoryId(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Toutes les sous-catégories" value="" />
                  {subCategories.map((subCat) => (
                    <Picker.Item key={subCat.id} label={subCat.name} value={subCat.id.toString()} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          {hasActiveFilters && (
            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
              <Text style={styles.resetButtonText}>🔄 Réinitialiser les filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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

      <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
        <Text style={styles.fabIcon}>➕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  filterToggleButton: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  filtersPanel: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterRow: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
  },
  resetButton: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
