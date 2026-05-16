import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  SafeAreaView,
} from 'react-native';
import { unitService } from '../../../../services/unitService';
import api from '../../../../services/api';
import { LoginResponse, Product, ProductBarcode, ProductUnit } from '../../../../type';
import { usePermissions } from '../../../../hooks/usePermissions';

interface BarcodesTabProps {
  product: Product;
  /** LoginResponse chargé par le parent (cf. VariantsTab pour le contexte). */
  user: LoginResponse | null;
}

function detectFormat(barcode: string): string {
  const digits = barcode.replace(/\D/g, '');
  if (digits.length === 13) return 'EAN13';
  if (digits.length === 12) return 'UPC_A';
  if (digits.length === 8)  return 'UPC_E';
  if (digits.startsWith('2') && digits.length === 11) return 'INTERNAL';
  return 'CODE128';
}

export const BarcodesTab: React.FC<BarcodesTabProps> = ({ product, user }) => {
  const { can } = usePermissions(user);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);
  // Liste COMPLÈTE des codes-barres du produit (toutes variantes confondues).
  // On charge une fois et on filtre client-side par variante sélectionnée :
  //   - Permet d'afficher un badge "X codes" par variante
  //   - Évite un aller-retour réseau à chaque changement de variante
  const [allBarcodes, setAllBarcodes] = useState<ProductBarcode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBarcode, setNewBarcode] = useState('');
  const [adding, setAdding] = useState(false);

  // Scanner
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const scanHandled = useRef(false);
  // Scan continu : feedback dans le modal
  const [scanFeedback, setScanFeedback] = useState<{ code: string; status: 'success' | 'error' | 'duplicate'; message: string } | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [unitsData, barcodesResp] = await Promise.all([
        unitService.getUnits(product.id),
        api.get<ProductBarcode[]>(`/produits/${product.id}/barcodes`),
      ]);
      setUnits(unitsData);
      setAllBarcodes(barcodesResp.data ?? []);
      // Pré-sélection : la première variante qui a déjà des codes-barres,
      // sinon la première variante tout court. Plus intuitif pour l'épicier
      // qui arrive sur un produit qu'il a déjà configuré.
      if (unitsData.length > 0) {
        const firstWithBarcodes = unitsData.find(u =>
          (barcodesResp.data ?? []).some(b => b.unitId === u.id)
        );
        setSelectedUnit(firstWithBarcodes ?? unitsData[0]);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les variantes ou les codes-barres');
    } finally {
      setLoading(false);
    }
  };

  // Codes-barres affichés (variante sélectionnée) — dérivé de allBarcodes
  const barcodes = useMemo(
    () => allBarcodes.filter(b => b.unitId === selectedUnit?.id),
    [allBarcodes, selectedUnit],
  );

  // Nombre de codes-barres par variante — utilisé pour les badges des chips
  const countByUnitId = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of allBarcodes) {
      if (b.unitId != null) {
        map.set(b.unitId, (map.get(b.unitId) ?? 0) + 1);
      }
    }
    return map;
  }, [allBarcodes]);

  const addBarcode = async () => {
    const val = newBarcode.trim();
    if (!val || !selectedUnit) return;
    setAdding(true);
    try {
      const resp = await api.post<ProductBarcode>(`/produits/${product.id}/barcodes`, {
        barcode: val,
        format: detectFormat(val),
        unitId: selectedUnit.id
      });
      setAllBarcodes(prev => [...prev, resp.data]);
      setNewBarcode('');
      Alert.alert('✅ Succès', `Code-barre ${val} ajouté.`);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message ?? 'Code-barre invalide ou déjà existant');
    } finally {
      setAdding(false);
    }
  };

  const showScanFeedback = (code: string, status: 'success' | 'error' | 'duplicate', message: string) => {
    setScanFeedback({ code, status, message });
    feedbackOpacity.setValue(1);
    Animated.timing(feedbackOpacity, {
      toValue: 0,
      duration: 2000,
      delay: 1200,
      useNativeDriver: true,
    }).start(() => setScanFeedback(null));
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission refusée', 'L\'accès à la caméra est requis pour scanner des codes-barres.');
        return;
      }
    }
    scanHandled.current = false;
    setScanCount(0);
    setScanFeedback(null);
    setScannerVisible(true);
  };

  const onBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (scanHandled.current) return;
    scanHandled.current = true;

    const val = result.data.trim();
    if (!val || !selectedUnit) {
      scanHandled.current = false;
      return;
    }

    // Vibration feedback
    Vibration.vibrate(100);

    // Vérifier les doublons localement
    const isDuplicate = allBarcodes.some(b => b.barcode === val);
    if (isDuplicate) {
      showScanFeedback(val, 'duplicate', 'Code-barre déjà existant');
      setTimeout(() => { scanHandled.current = false; }, 2000);
      return;
    }

    // Ajouter directement via l'API
    try {
      const resp = await api.post<ProductBarcode>(`/produits/${product.id}/barcodes`, {
        barcode: val,
        format: detectFormat(val),
        unitId: selectedUnit.id,
      });
      setAllBarcodes(prev => [...prev, resp.data]);
      setScanCount(prev => prev + 1);
      showScanFeedback(val, 'success', 'Code-barre ajouté');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de l\'ajout';
      showScanFeedback(val, 'error', msg);
    }

    // Permettre un nouveau scan après un délai
    setTimeout(() => { scanHandled.current = false; }, 2000);
  };

  const confirmDelete = (bc: ProductBarcode) => {
    Alert.alert('Confirmer', `Supprimer le code-barre ${bc.barcode} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/produits/${product.id}/barcodes/${bc.id}`);
            setAllBarcodes(prev => prev.filter(b => b.id !== bc.id));
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2196F3" /></View>;
  }

  if (units.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="information-circle-outline" size={48} color="#90caf9" />
        <Text style={styles.noUnitsText}>Aucune variante définie</Text>
        <Text style={styles.noUnitsHint}>Ajoutez des variantes dans l'onglet Variantes pour associer des codes-barres.</Text>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Sélecteur variante — chips horizontaux ── */}
      <View style={styles.field}>
        <Text style={styles.label}>Variante</Text>
        <Text style={styles.sublabel}>Touchez une variante pour gérer ses codes-barres</Text>

        {units.length === 1 ? (
          // Variante unique : affichage informatif plein largeur
          <View style={[styles.variantChip, styles.variantChipSelected, styles.variantChipFull]}>
            <View style={styles.variantChipHeader}>
              <Ionicons name="pricetag" size={14} color="#fff" />
              <Text style={styles.variantChipLabelSelected}>{units[0].label}</Text>
            </View>
            <Text style={styles.variantChipPriceSelected}>{units[0].prix.toFixed(2)} DH</Text>
            {(countByUnitId.get(units[0].id) ?? 0) > 0 && (
              <View style={styles.variantChipBadgeSelected}>
                <Ionicons name="barcode" size={11} color="#1565c0" />
                <Text style={styles.variantChipBadgeTextSelected}>
                  {countByUnitId.get(units[0].id)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          // Plusieurs variantes : scroll horizontal de chips tappables
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.variantChipRow}
          >
            {units.map(u => {
              const isSelected = u.id === selectedUnit?.id;
              const count = countByUnitId.get(u.id) ?? 0;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[
                    styles.variantChip,
                    isSelected && styles.variantChipSelected,
                  ]}
                  onPress={() => setSelectedUnit(u)}
                  activeOpacity={0.7}
                >
                  <View style={styles.variantChipHeader}>
                    <Ionicons
                      name="pricetag"
                      size={14}
                      color={isSelected ? '#fff' : '#1565c0'}
                    />
                    <Text style={isSelected ? styles.variantChipLabelSelected : styles.variantChipLabel}>
                      {u.label}
                    </Text>
                  </View>
                  <Text style={isSelected ? styles.variantChipPriceSelected : styles.variantChipPrice}>
                    {u.prix.toFixed(2)} DH
                  </Text>
                  {count > 0 && (
                    <View style={isSelected ? styles.variantChipBadgeSelected : styles.variantChipBadge}>
                      <Ionicons
                        name="barcode"
                        size={11}
                        color={isSelected ? '#1565c0' : '#fff'}
                      />
                      <Text
                        style={isSelected ? styles.variantChipBadgeTextSelected : styles.variantChipBadgeText}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {selectedUnit && (
        <>
          {/* En-tête barcodes */}
          <View style={styles.barcodeHeader}>
            <Ionicons name="barcode-outline" size={20} color="#1565c0" />
            <Text style={styles.barcodeHeaderText}>
              Codes-barres — <Text style={{ fontWeight: '700' }}>{selectedUnit.label}</Text>
            </Text>
          </View>
          <Text style={styles.barcodeHint}>
            Ces codes identifient automatiquement la variante lors du scan en caisse.
          </Text>

          {/* Liste barcodes */}
          {barcodes.length === 0 ? (
            <View style={styles.emptyBarcodes}>
              <Ionicons name="scan-outline" size={40} color="#ccc" />
              <Text style={styles.emptyBarcodesText}>Aucun code-barre pour cette variante</Text>
            </View>
          ) : (
            barcodes.map(bc => (
              <View key={bc.id} style={styles.barcodeItem}>
                <Ionicons name="barcode" size={24} color="#1565c0" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.barcodeValue}>{bc.barcode}</Text>
                  <View style={styles.barcodeMetaRow}>
                    <View style={styles.formatBadge}>
                      <Text style={styles.formatBadgeText}>{bc.barcodeFormat}</Text>
                    </View>
                    {bc.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Principal</Text>
                      </View>
                    )}
                    {bc.scanCount > 0 && (
                      <Text style={styles.scanCount}>👁 {bc.scanCount} scans</Text>
                    )}
                  </View>
                </View>
                {can('barcodes:manage') && (
                  <TouchableOpacity onPress={() => confirmDelete(bc)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {/* Formulaire ajout */}
          {can('barcodes:manage') && (
            <View style={styles.addRow}>
              <TextInput
                style={styles.barcodeInput}
                value={newBarcode}
                onChangeText={setNewBarcode}
                placeholder="EAN-13, UPC-A, Code128…"
                placeholderTextColor="#bbb"
                onSubmitEditing={addBarcode}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                <Ionicons name="camera-outline" size={20} color="#2196F3" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, (!newBarcode.trim() || adding) && styles.btnDisabled]}
                onPress={addBarcode}
                disabled={!newBarcode.trim() || adding}
              >
                {adding
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.addBtnText}>Ajouter</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>

    {/* ── Modal Scanner (continu) ── */}
    <Modal
      visible={scannerVisible}
      animationType="slide"
      onRequestClose={() => setScannerVisible(false)}
    >
      <SafeAreaView style={styles.scannerModal}>
        <View style={styles.scannerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scannerTitle}>Scanner codes-barres</Text>
            <Text style={styles.scannerSubtitle}>
              {selectedUnit?.label ?? 'Variante'} — scan continu
            </Text>
          </View>
          {scanCount > 0 && (
            <View style={styles.scanCountBadge}>
              <Text style={styles.scanCountText}>{scanCount} ajouté{scanCount > 1 ? 's' : ''}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.scannerClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'upc_a', 'upc_e', 'codabar', 'qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          {/* Overlay sombre + cadre */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrameRow}><View style={styles.scanDark} /></View>
            <View style={styles.scanMiddleRow}>
              <View style={styles.scanDark} />
              <View style={styles.scanFrame}>
                <View style={[styles.scanCorner, styles.scanTL]} />
                <View style={[styles.scanCorner, styles.scanTR]} />
                <View style={[styles.scanCorner, styles.scanBL]} />
                <View style={[styles.scanCorner, styles.scanBR]} />
              </View>
              <View style={styles.scanDark} />
            </View>
            <View style={styles.scanFrameRow}><View style={styles.scanDark} /></View>
          </View>

          {/* Feedback flottant après chaque scan */}
          {scanFeedback && (
            <Animated.View style={[
              styles.scanFeedback,
              scanFeedback.status === 'success' && styles.scanFeedbackSuccess,
              scanFeedback.status === 'error' && styles.scanFeedbackError,
              scanFeedback.status === 'duplicate' && styles.scanFeedbackDuplicate,
              { opacity: feedbackOpacity },
            ]}>
              <Ionicons
                name={scanFeedback.status === 'success' ? 'checkmark-circle' : scanFeedback.status === 'duplicate' ? 'copy-outline' : 'alert-circle'}
                size={22}
                color="#fff"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.scanFeedbackCode}>{scanFeedback.code}</Text>
                <Text style={styles.scanFeedbackMsg}>{scanFeedback.message}</Text>
              </View>
            </Animated.View>
          )}
        </View>

        <View style={styles.scannerFooter}>
          <Ionicons name="scan-outline" size={20} color="#90caf9" />
          <Text style={styles.scannerHint}>
            Scannez les codes-barres un par un — ajout automatique
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  noUnitsText: { fontSize: 17, fontWeight: '600', color: '#999', marginTop: 12, textAlign: 'center' },
  noUnitsHint: { fontSize: 13, color: '#bbb', textAlign: 'center', marginTop: 6 },

  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2 },
  sublabel: { fontSize: 12, color: '#888', marginBottom: 10 },

  // ── Variant chips (remplace l'ancien Picker) ────────────────
  variantChipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8, // petite marge droite pour ne pas couper le dernier chip
  },
  variantChip: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    minWidth: 110,
    // Ombre douce pour donner un effet "carte tappable"
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  variantChipFull: {
    width: '100%',
  },
  variantChipSelected: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  variantChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  variantChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565c0',
  },
  variantChipLabelSelected: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  variantChipPrice: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  variantChipPriceSelected: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  variantChipBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#1565c0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: '#fff',
  },
  variantChipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  variantChipBadgeSelected: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: '#1565c0',
  },
  variantChipBadgeTextSelected: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565c0',
  },

  barcodeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4
  },
  barcodeHeaderText: { fontSize: 14, color: '#333', flex: 1 },
  barcodeHint: { fontSize: 12, color: '#888', marginBottom: 14 },

  barcodeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0'
  },
  barcodeValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 15, fontWeight: '700', color: '#222'
  },
  barcodeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  formatBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  formatBadgeText: { fontSize: 11, fontWeight: '600', color: '#666' },
  primaryBadge: { backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  primaryBadgeText: { fontSize: 11, fontWeight: '600', color: '#1565c0' },
  scanCount: { fontSize: 11, color: '#888' },
  deleteBtn: { padding: 6 },

  emptyBarcodes: { alignItems: 'center', paddingVertical: 30 },
  emptyBarcodesText: { fontSize: 14, color: '#bbb', marginTop: 8 },

  addRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  barcodeInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'
  },
  scanBtn: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: '#e3f2fd',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#90caf9',
  },
  addBtn: {
    backgroundColor: '#2196F3', borderRadius: 10,
    paddingHorizontal: 16, height: 42,
    alignItems: 'center', justifyContent: 'center'
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  // ── Scanner Modal ──
  scannerModal: { flex: 1, backgroundColor: '#000' },

  scannerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  scannerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scannerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  scannerClose: { padding: 4 },

  scanCountBadge: {
    backgroundColor: '#2e7d32', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  scanCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  scannerContainer: { flex: 1, position: 'relative' },

  scanOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  scanFrameRow: { flex: 1, flexDirection: 'row' },
  scanMiddleRow: { height: 180, flexDirection: 'row' },
  scanDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanFrame: {
    width: 260, height: 180,
    borderWidth: 0,
    position: 'relative',
  },

  // Coins du cadre
  scanCorner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: '#42a5f5', borderStyle: 'solid',
  },
  scanTL: { top: 0, left: 0,  borderTopWidth: 3, borderLeftWidth: 3 },
  scanTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  scanBL: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3 },
  scanBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  // Feedback flottant
  scanFeedback: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12,
  },
  scanFeedbackSuccess: { backgroundColor: 'rgba(46,125,50,0.92)' },
  scanFeedbackError: { backgroundColor: 'rgba(229,57,53,0.92)' },
  scanFeedbackDuplicate: { backgroundColor: 'rgba(251,140,0,0.92)' },
  scanFeedbackCode: {
    color: '#fff', fontSize: 14, fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  scanFeedbackMsg: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },

  scannerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  scannerHint: { color: '#90caf9', fontSize: 14 },
});

