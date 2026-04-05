/**
 * Écran Approvisionnement — ÉPICIER
 * Permet de scanner un code-barre produit (EAN-13, UPC…) pour identifier
 * le produit ET l'unité de vente correspondante, puis mettre à jour le stock.
 */

import React, { useState } from 'react';
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
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BarcodeProductScanner } from '../../src/components/shared/BarcodeProductScanner';
import { productService } from '../../src/services/productService';
import api from '../../src/services/api';
import { BarcodeProductResult, ProductUnit } from '../../src/type';

const EPICIER_BLUE = '#2196F3';

interface StockUpdatePayload {
  unitId?: number;
  quantity: number;
}

export default function ApprovisionnementScreen() {
  const router = useRouter();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [searching, setSearching] = useState(false);

  const [result, setResult] = useState<BarcodeProductResult | null>(null);
  const [matchedUnit, setMatchedUnit] = useState<ProductUnit | null>(null);
  const [lastBarcode, setLastBarcode] = useState('');

  const [quantityStr, setQuantityStr] = useState('');
  const [saving, setSaving] = useState(false);

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

    setSaving(true);
    try {
      if (matchedUnit) {
        // Mise à jour du stock de l'unité
        await api.put(`/products/${result.id}/units/${matchedUnit.id}`, {
          stock: matchedUnit.stock + qty,
        });
      } else {
        // Produit legacy (sans unités)
        await api.put(`/produits/${result.id}/stock`, { quantity: qty });
      }

      Alert.alert(
        'Stock mis à jour',
        `+${qty} unité(s) ajoutée(s)${matchedUnit ? ` pour "${matchedUnit.label}"` : ''} — ${result.nom}`,
        [
          { text: 'Scanner un autre', onPress: resetScan },
          { text: 'Terminer', onPress: () => router.back(), style: 'cancel' },
        ]
      );
    } catch (err: any) {
      Alert.alert('Erreur', typeof err === 'string' ? err : 'Impossible de mettre à jour le stock.');
    } finally {
      setSaving(false);
    }
  };

  const resetScan = () => {
    setResult(null);
    setMatchedUnit(null);
    setQuantityStr('');
    setLastBarcode('');
    setScannerVisible(true);
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
        {!result && !searching && (
          <>
            <View style={styles.illustrationBox}>
              <MaterialCommunityIcons name="barcode-scan" size={96} color={EPICIER_BLUE} />
            </View>
            <Text style={styles.title}>Scanner un produit</Text>
            <Text style={styles.description}>
              Scannez le code-barre d'un produit (EAN-13, UPC, Code128…) pour identifier
              le produit et son unité de vente, puis ajoutez la quantité reçue au stock.
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

            <View style={styles.helpBox}>
              <MaterialCommunityIcons name="information-outline" size={18} color="#666" />
              <Text style={styles.helpText}>
                Associez d'abord les codes-barres à chaque unité de vente depuis
                l'interface web (onglet Produits → Unités → icône code-barre).
              </Text>
            </View>
          </>
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

            {/* Boutons d'action */}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!quantityStr || parseInt(quantityStr, 10) <= 0 || saving) && styles.confirmButtonDisabled,
              ]}
              onPress={handleUpdateStock}
              disabled={!quantityStr || parseInt(quantityStr, 10) <= 0 || saving}
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
  helpBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fff', borderRadius: 10,
    padding: 14, width: '100%',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  helpText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 19 },

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
