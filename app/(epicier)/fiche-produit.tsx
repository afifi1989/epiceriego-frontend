/**
 * Fiche Produit Unifiée — Épicier
 *
 * Remplace : ajouter-produit.tsx + modifier-produit.tsx + ajuster-stock.tsx
 *
 * 4 onglets :
 *  [Infos]       — Création / modification des informations de base
 *  [Variantes]   — Gestion des variantes de vente inline (sans modal)
 *  [Stock]       — Ajustement du stock par variante + historique session
 *  [Codes-barres]— Association de codes-barres par variante
 *
 * Usage :
 *   router.push('/(epicier)/fiche-produit')          → Nouveau produit
 *   router.push(`/(epicier)/fiche-produit?id=${id}`) → Modifier un produit
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productService } from '../../src/services/productService';
import { Product } from '../../src/type';
import { ProductTabs, Tab } from '../../src/features/products/components/ProductTabs';
import { InfoTab } from '../../src/features/products/components/tabs/InfoTab';
import { VariantsTab } from '../../src/features/products/components/tabs/VariantsTab';
import { StockTab } from '../../src/features/products/components/tabs/StockTab';
import { BarcodesTab } from '../../src/features/products/components/tabs/BarcodesTab';

const TABS: Tab[] = [
  { label: 'Infos',        icon: '✏️'  },
  { label: 'Variantes',    icon: '📦'  },
  { label: 'Stock',        icon: '📊'  },
  { label: 'Codes-barres', icon: '🔲'  }
];

export default function FicheProduitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(!!id);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const isNew = !id;

  useEffect(() => {
    if (id) loadProduct(parseInt(id));
  }, [id]);

  const loadProduct = async (productId: number) => {
    setLoading(true);
    try {
      const p = await productService.getProductById(productId);
      setCurrentProduct(p);
    } catch {
      // Si introuvable, fermer la fiche
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const title = currentProduct ? currentProduct.nom : (isNew ? 'Nouveau produit' : 'Chargement...');

  const tabs: Tab[] = TABS.map((t, idx) => ({
    ...t,
    disabled: idx > 0 && !currentProduct
  }));

  /**
   * Appelé par InfoTab quand un produit est créé ou modifié.
   * Si création → activer l'onglet Variantes.
   * Si modification → rester sur l'onglet Infos (produit rechargé).
   */
  const onInfoSaved = (saved: Product) => {
    const wasNew = !currentProduct;
    setCurrentProduct(saved);
    if (wasNew) {
      setActiveTab(1); // Passer aux variantes
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chargement...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── En-tête ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {currentProduct?.categoryName && (
            <Text style={styles.headerSub} numberOfLines={1}>{currentProduct.categoryName}</Text>
          )}
        </View>
        {currentProduct && (
          <View style={[
            styles.availBadge,
            { backgroundColor: currentProduct.isAvailable ? '#e8f5e9' : '#ffebee' }
          ]}>
            <Text style={[
              styles.availBadgeText,
              { color: currentProduct.isAvailable ? '#2e7d32' : '#c62828' }
            ]}>
              {currentProduct.isAvailable ? 'Dispo' : 'Indispo'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Onglets ── */}
      <ProductTabs tabs={tabs} activeIndex={activeTab} onTabChange={setActiveTab} />

      {/* ── Contenu de l'onglet actif ── */}
      <View style={styles.content}>
        {activeTab === 0 && (
          <InfoTab product={currentProduct} onSaved={onInfoSaved} />
        )}
        {activeTab === 1 && currentProduct && (
          <VariantsTab product={currentProduct} onChanged={() => loadProduct(currentProduct.id)} />
        )}
        {activeTab === 2 && currentProduct && (
          <StockTab product={currentProduct} />
        )}
        {activeTab === 3 && currentProduct && (
          <BarcodesTab product={currentProduct} />
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2196F3' },

  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  availBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14
  },
  availBadgeText: { fontSize: 12, fontWeight: '700' },

  content: { flex: 1, backgroundColor: '#f5f7fa' },

  loadingContainer: {
    flex: 1, backgroundColor: '#f5f7fa',
    alignItems: 'center', justifyContent: 'center'
  }
});
