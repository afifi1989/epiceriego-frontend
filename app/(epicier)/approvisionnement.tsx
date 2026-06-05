/**
 * Écran Approvisionnement — ÉPICIER
 * Permet de scanner un code-barre produit (EAN-13, UPC…) pour identifier
 * le produit ET l'unité de vente correspondante, puis mettre à jour le stock.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BarcodeProductScanner } from '../../src/components/shared/BarcodeProductScanner';
import { productService } from '../../src/services/productService';
import { stockService } from '../../src/services/stockService';
import { STORAGE_KEYS } from '../../src/constants/config';
import { normalize } from '../../src/utils/synonymExpansion';
import { BarcodeProductResult, Product, ProductUnit } from '../../src/type';

const EPICIER_BLUE = '#2196F3';

export default function ApprovisionnementScreen() {
  const router = useRouter();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [searching, setSearching] = useState(false);

  const [result, setResult] = useState<BarcodeProductResult | null>(null);
  const [matchedUnit, setMatchedUnit] = useState<ProductUnit | null>(null);
  const [lastBarcode, setLastBarcode] = useState('');

  const [quantityStr, setQuantityStr] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Recherche par nom ──────────────────────────────────────────────────
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) {
        try { setEpicerieId(JSON.parse(raw)?.epicerieId ?? null); } catch { /* noop */ }
      }
    });
  }, []);

  // ── Scan d'un code-barre ─────────────────────────────────────────────────
  const handleScanned = async (barcode: string) => {
    setScannerVisible(false);
    setSearching(true);
    setResult(null);
    setMatchedUnit(null);
    setQuantityStr('');
    setLastBarcode(barcode);

    try {
      const product = await productService.getProductByBarcode(barcode);
      setResult(product);

      // Identifier l'unité correspondante
      if (product.matchedUnitId && product.units) {
        const unit = product.units.find(u => u.id === product.matchedUnitId) ?? null;
        setMatchedUnit(unit);
      } else if (product.units && product.units.length === 1) {
        // Une seule unité → sélection automatique
        setMatchedUnit(product.units[0]);
      }
    } catch (err: any) {
      Alert.alert(
        'Produit introuvable',
        typeof err === 'string' ? err : `Aucun produit trouvé pour le code-barre : ${barcode}`,
        [
          { text: 'Scanner à nouveau', onPress: () => setScannerVisible(true) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } finally {
      setSearching(false);
    }
  };

  // ── Recherche d'un produit par son nom ───────────────────────────────────
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    if (!epicerieId) {
      Alert.alert('Épicerie introuvable', 'Impossible de déterminer votre boutique.');
      return;
    }

    setSearching(true);
    setResult(null);
    setMatchedUnit(null);
    setQuantityStr('');
    setLastBarcode('');
    setSearchResults([]);

    try {
      // Inclut les produits indisponibles/rupture — ce sont eux qu'on réappro.
      const products = await productService.getManagedProducts(epicerieId);
      const nq = normalize(q);
      const matches = products.filter(p => normalize(p.nom).includes(nq));

      if (matches.length === 0) {
        Alert.alert('Aucun résultat', `Aucun produit trouvé pour « ${q} ».`);
      } else if (matches.length === 1) {
        selectProduct(matches[0]);
      } else {
        setSearchResults(matches);
      }
    } catch (err: any) {
      Alert.alert('Erreur', typeof err === 'string' ? err : 'Impossible de rechercher les produits.');
    } finally {
      setSearching(false);
    }
  };

  // ── Sélection d'un produit issu de la recherche ──────────────────────────
  const selectProduct = (product: Product) => {
    setResult(product);
    setSearchResults([]);
    setQuantityStr('');
    // Auto-sélection si une seule unité de vente.
    setMatchedUnit(product.units && product.units.length === 1 ? product.units[0] : null);
  };

  // ── Sélection manuelle d'une unité ───────────────────────────────────────
  const selectUnit = (unit: ProductUnit) => {
    setMatchedUnit(unit);
    setQuantityStr('');
  };

  // ── Mise à jour du stock ──────────────────────────────────────────────────
  const handleUpdateStock = async () => {
    if (!result) return;
    const qty = parseInt(quantityStr, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Quantité invalide', 'Veuillez saisir une quantité positive.');
      return;
    }
    if (!matchedUnit) {
      Alert.alert('Unité requise', 'Sélectionnez l’unité de vente correspondant au produit reçu.');
      return;
    }

    setSaving(true);
    try {
      // Mouvement de stock atomique côté serveur (entrée « réception »).
      // Le backend calcule stock + qty et trace le mouvement — pas de race.
      const newStock = await stockService.adjustStock(result.id, matchedUnit, qty, 'RECEPTION');

      Alert.alert(
        'Stock mis à jour',
        `+${qty} unité(s) ajoutée(s) pour « ${matchedUnit.label} » — ${result.nom}\nNouveau stock : ${newStock}`,
        [
          { text: 'Scanner un autre', onPress: resetScan },
          { text: 'Terminer', onPress: () => router.back(), style: 'cancel' },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        typeof err === 'string' ? err : (err?.message ?? 'Impossible de mettre à jour le stock.')
      );
    } finally {
      setSaving(false);
    }
  };

  const resetScan = () => {
    setResult(null);
    setMatchedUnit(null);
    setQuantityStr('');
    setLastBarcode('');
    setSearchQuery('');
    setSearchResults([]);
    setScannerVisible(true);
  };

  /** Retour à l'écran d'accueil sans rouvrir la caméra. */
  const clearAll = () => {
    setResult(null);
    setMatchedUnit(null);
    setQuantityStr('');
    setLastBarcode('');
    setSearchResults([]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Approvisionnement</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* — Aucun résultat : écran d'accueil — */}
        {!result && !searching && searchResults.length === 0 && (
          <>
            <View style={styles.illustrationBox}>
              <MaterialCommunityIcons name="barcode-scan" size={96} color={EPICIER_BLUE} />
            </View>
            <Text style={styles.title}>Trouver un produit</Text>
            <Text style={styles.description}>
              Scannez le code-barre d'un produit (EAN-13, UPC, Code128…) ou recherchez-le
              par son nom, puis ajoutez la quantité reçue au stock.
            </Text>

            {/* Bouton scanner */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setScannerVisible(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="camera" size={24} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.scanButtonText}>Scanner un code-barre</Text>
            </TouchableOpacity>

            {/* Séparateur */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>ou</Text>
              <View style={styles.orLine} />
            </View>

            {/* Recherche par nom */}
            <View style={styles.searchRow}>
              <MaterialCommunityIcons name="magnify" size={22} color="#999" style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher un produit par nom…"
                placeholderTextColor="#999"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                style={[styles.searchGo, !searchQuery.trim() && styles.searchGoDisabled]}
                onPress={handleSearch}
                disabled={!searchQuery.trim()}
              >
                <MaterialCommunityIcons name="arrow-right" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.helpBox}>
              <MaterialCommunityIcons name="information-outline" size={18} color="#666" />
              <Text style={styles.helpText}>
                Associez d'abord les codes-barres à chaque unité de vente depuis
                l'interface web (onglet Produits → Unités → icône code-barre).
              </Text>
            </View>
          </>
        )}

        {/* — Résultats de recherche par nom — */}
        {!result && !searching && searchResults.length > 0 && (
          <View style={styles.resultsWrap}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {searchResults.length} produit{searchResults.length > 1 ? 's' : ''} trouvé{searchResults.length > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={clearAll}>
                <Text style={styles.resultsClear}>Effacer</Text>
              </TouchableOpacity>
            </View>

            {searchResults.map((p) => (
              <TouchableOpacity key={p.id} style={styles.resultRow} onPress={() => selectProduct(p)}>
                {p.photoUrl ? (
                  <Image source={{ uri: p.photoUrl }} style={styles.resultImage} contentFit="cover" />
                ) : (
                  <View style={styles.resultImagePlaceholder}>
                    <MaterialCommunityIcons name="package-variant" size={26} color="#ccc" />
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{p.nom}</Text>
                  <Text style={styles.resultMeta}>
                    {(p.units?.length ?? 0)} variante{(p.units?.length ?? 0) > 1 ? 's' : ''} · {(p.totalStock ?? p.stock)} en stock
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#bbb" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* — Chargement — */}
        {searching && (
          <View style={styles.searchingBox}>
            <ActivityIndicator size="large" color={EPICIER_BLUE} />
            <Text style={styles.searchingText}>Recherche du produit…</Text>
            <Text style={styles.searchingBarcode}>{lastBarcode}</Text>
          </View>
        )}

        {/* — Résultat — */}
        {result && !searching && (
          <>
            {/* Carte produit */}
            <View style={styles.productCard}>
              {result.photoUrl ? (
                <Image source={{ uri: result.photoUrl }} style={styles.productImage} contentFit="cover" />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <MaterialCommunityIcons name="package-variant" size={40} color="#ccc" />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{result.nom}</Text>
                {result.description ? (
                  <Text style={styles.productDesc} numberOfLines={2}>{result.description}</Text>
                ) : null}
                <Text style={styles.barcodeLabel}>
                  <MaterialCommunityIcons name="barcode" size={13} /> {lastBarcode}
                </Text>
              </View>
            </View>

            {/* Sélection de l'unité */}
            {result.units && result.units.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Unité de vente</Text>

                {matchedUnit && (
                  <View style={styles.matchedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" />
                    <Text style={styles.matchedText}>
                      Unité identifiée par le code-barre
                    </Text>
                  </View>
                )}

                <View style={styles.unitsGrid}>
                  {result.units.map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[
                        styles.unitChip,
                        matchedUnit?.id === unit.id && styles.unitChipSelected,
                      ]}
                      onPress={() => selectUnit(unit)}
                    >
                      <Text style={[
                        styles.unitChipLabel,
                        matchedUnit?.id === unit.id && styles.unitChipLabelSelected,
                      ]}>
                        {unit.label}
                      </Text>
                      <Text style={[
                        styles.unitChipPrice,
                        matchedUnit?.id === unit.id && styles.unitChipPriceSelected,
                      ]}>
                        {unit.prix.toFixed(2)} DH
                      </Text>
                      <Text style={styles.unitChipStock}>Stock: {unit.stock}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!matchedUnit && (
                  <Text style={styles.selectHint}>
                    Sélectionnez l'unité correspondant au produit reçu
                  </Text>
                )}
              </View>
            )}

            {/* Quantité à ajouter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quantité à ajouter au stock</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => {
                    const v = Math.max(1, (parseInt(quantityStr, 10) || 0) - 1);
                    setQuantityStr(v.toString());
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={22} color="#333" />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={quantityStr}
                  onChangeText={setQuantityStr}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => {
                    const v = (parseInt(quantityStr, 10) || 0) + 1;
                    setQuantityStr(v.toString());
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={22} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Avertissement : produit sans unité de vente configurée */}
            {(!result.units || result.units.length === 0) && (
              <View style={styles.warningBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B26A00" />
                <Text style={styles.warningText}>
                  Ce produit n’a aucune unité de vente. Ajoutez-en une depuis la fiche
                  produit (onglet Variantes) avant de l’approvisionner.
                </Text>
              </View>
            )}

            {/* Boutons d'action */}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!matchedUnit || !quantityStr || parseInt(quantityStr, 10) <= 0 || saving) && styles.confirmButtonDisabled,
              ]}
              onPress={handleUpdateStock}
              disabled={!matchedUnit || !quantityStr || parseInt(quantityStr, 10) <= 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="package-up" size={22} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmButtonText}>
                    Confirmer l'approvisionnement
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.rescanButton} onPress={resetScan}>
              <MaterialCommunityIcons name="barcode-scan" size={18} color={EPICIER_BLUE} />
              <Text style={styles.rescanText}>Scanner un autre produit</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Scanner modal */}
      <BarcodeProductScanner
        visible={scannerVisible}
        onScanned={handleScanned}
        onClose={() => setScannerVisible(false)}
        title="Scanner un produit"
        subtitle="EAN-13 · UPC · Code128 — pointez vers le code-barre"
        isLoading={searching}
        accentColor={EPICIER_BLUE}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: EPICIER_BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  content: { flex: 1 },
  contentInner: { padding: 24, alignItems: 'center', flexGrow: 1 },

  // Accueil
  illustrationBox: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#212121', textAlign: 'center', marginBottom: 10 },
  description: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 8 },
  scanButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: EPICIER_BLUE,
    paddingVertical: 16, paddingHorizontal: 32,
    borderRadius: 14, width: '100%',
    elevation: 4, shadowColor: EPICIER_BLUE,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    marginBottom: 20,
  },
  scanButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  // Séparateur "ou"
  orRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  orText: { marginHorizontal: 12, color: '#999', fontSize: 13, fontWeight: '600' },

  // Recherche par nom
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd',
    height: 52, width: '100%', marginBottom: 20, overflow: 'hidden',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#333', paddingHorizontal: 10 },
  searchGo: {
    width: 52, height: 52, justifyContent: 'center', alignItems: 'center',
    backgroundColor: EPICIER_BLUE,
  },
  searchGoDisabled: { backgroundColor: '#ccc' },

  helpBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fff', borderRadius: 10,
    padding: 14, width: '100%',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  helpText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 19 },

  // Résultats de recherche
  resultsWrap: { width: '100%' },
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultsTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  resultsClear: { fontSize: 14, color: EPICIER_BLUE, fontWeight: '600' },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  resultImage: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  resultImagePlaceholder: {
    width: 48, height: 48, borderRadius: 8, marginRight: 12,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#212121' },
  resultMeta: { fontSize: 12, color: '#888', marginTop: 2 },

  // Chargement
  searchingBox: { alignItems: 'center', marginTop: 60, gap: 14 },
  searchingText: { fontSize: 16, color: '#555', fontWeight: '600' },
  searchingBarcode: { fontSize: 13, color: '#999', fontFamily: 'monospace' },

  // Résultat
  productCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 14, width: '100%', marginBottom: 16,
    borderWidth: 1, borderColor: '#e0e0e0',
    elevation: 2,
  },
  productImage: { width: 72, height: 72, borderRadius: 8, marginRight: 14 },
  productImagePlaceholder: {
    width: 72, height: 72, borderRadius: 8, marginRight: 14,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 17, fontWeight: '700', color: '#212121', marginBottom: 4 },
  productDesc: { fontSize: 13, color: '#666', marginBottom: 6 },
  barcodeLabel: { fontSize: 12, color: '#999', fontFamily: 'monospace' },

  // Section
  section: { width: '100%', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  matchedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F5E9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
  },
  matchedText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  selectHint: { fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF8E1', borderRadius: 10,
    padding: 12, width: '100%', marginBottom: 8,
    borderWidth: 1, borderColor: '#FFE082',
  },
  warningText: { flex: 1, fontSize: 13, color: '#8D6E00', lineHeight: 19 },

  // Unités
  unitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0',
    backgroundColor: '#fafafa', alignItems: 'center', minWidth: 90,
  },
  unitChipSelected: { borderColor: EPICIER_BLUE, backgroundColor: '#E3F2FD' },
  unitChipLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  unitChipLabelSelected: { color: EPICIER_BLUE },
  unitChipPrice: { fontSize: 13, color: '#666', marginTop: 2 },
  unitChipPriceSelected: { color: EPICIER_BLUE },
  unitChipStock: { fontSize: 11, color: '#999', marginTop: 2 },

  // Quantité
  quantityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd', overflow: 'hidden',
    height: 52,
  },
  qtyButton: {
    width: 52, height: 52, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  qtyInput: {
    flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#333',
  },

  // Boutons
  confirmButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16, borderRadius: 14, width: '100%',
    elevation: 4, shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    marginTop: 8, marginBottom: 12,
  },
  confirmButtonDisabled: { backgroundColor: '#ccc', elevation: 0, shadowOpacity: 0 },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rescanButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12,
  },
  rescanText: { color: EPICIER_BLUE, fontSize: 14, fontWeight: '600' },
});
