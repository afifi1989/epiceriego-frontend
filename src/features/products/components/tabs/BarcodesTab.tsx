import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import { unitService } from '../../../../services/unitService';
import api from '../../../../services/api';
import { Product, ProductBarcode, ProductUnit } from '../../../../type';
import { usePermissions } from '../../../../hooks/usePermissions';

interface BarcodesTabProps {
  product: Product;
}

function detectFormat(barcode: string): string {
  const digits = barcode.replace(/\D/g, '');
  if (digits.length === 13) return 'EAN13';
  if (digits.length === 12) return 'UPC_A';
  if (digits.length === 8)  return 'UPC_E';
  if (digits.startsWith('2') && digits.length === 11) return 'INTERNAL';
  return 'CODE128';
}

export const BarcodesTab: React.FC<BarcodesTabProps> = ({ product }) => {
  const { can } = usePermissions();
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingBarcodes, setLoadingBarcodes] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [adding, setAdding] = useState(false);

  // Scanner
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const scanHandled = useRef(false);

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    setLoadingUnits(true);
    try {
      const data = await unitService.getUnits(product.id);
      setUnits(data);
      if (data.length === 1) {
        setSelectedUnit(data[0]);
        loadBarcodes(data[0].id);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les variantes');
    } finally {
      setLoadingUnits(false);
    }
  };

  const loadBarcodes = async (unitId: number) => {
    setLoadingBarcodes(true);
    try {
      const resp = await api.get(`/produits/${product.id}/barcodes`);
      const all: ProductBarcode[] = resp.data;
      setBarcodes(all.filter(b => b.unitId === unitId));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les codes-barres');
    } finally {
      setLoadingBarcodes(false);
    }
  };

  const onUnitChange = (unitId: string) => {
    const unit = units.find(u => u.id.toString() === unitId) ?? null;
    setSelectedUnit(unit);
    setBarcodes([]);
    if (unit) loadBarcodes(unit.id);
  };

  const addBarcode = async () => {
    const val = newBarcode.trim();
    if (!val || !selectedUnit) return;
    setAdding(true);
    try {
      const resp = await api.post(`/produits/${product.id}/barcodes`, {
        barcode: val,
        format: detectFormat(val),
        unitId: selectedUnit.id
      });
      setBarcodes(prev => [...prev, resp.data]);
      setNewBarcode('');
      Alert.alert('✅ Succès', `Code-barre ${val} ajouté.`);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message ?? 'Code-barre invalide ou déjà existant');
    } finally {
      setAdding(false);
    }
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
    setScannerVisible(true);
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanHandled.current) return;
    scanHandled.current = true;
    setScannerVisible(false);
    setNewBarcode(result.data);
  };

  const confirmDelete = (bc: ProductBarcode) => {
    Alert.alert('Confirmer', `Supprimer le code-barre ${bc.barcode} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/produits/${product.id}/barcodes/${bc.id}`);
            setBarcodes(prev => prev.filter(b => b.id !== bc.id));
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        }
      }
    ]);
  };

  if (loadingUnits) {
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

      {/* Sélecteur variante */}
      <View style={styles.field}>
        <Text style={styles.label}>Sélectionner une variante</Text>
        {units.length > 1 ? (
          <View style={styles.pickerBox}>
            <Picker
              selectedValue={selectedUnit?.id?.toString() ?? ''}
              onValueChange={onUnitChange}
              style={styles.picker}
            >
              <Picker.Item label="— Choisir une variante —" value="" />
              {units.map(u => (
                <Picker.Item key={u.id} label={`${u.label} — ${u.prix.toFixed(2)} DH`} value={u.id.toString()} />
              ))}
            </Picker>
          </View>
        ) : (
          <View style={styles.unitChip}>
            <Ionicons name="pricetag" size={16} color="#1565c0" />
            <Text style={styles.unitChipText}>{units[0].label} — {units[0].prix.toFixed(2)} DH</Text>
          </View>
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
            <View style={styles.priceTag}>
              <Text style={styles.priceTagText}>{selectedUnit.prix.toFixed(2)} DH</Text>
            </View>
          </View>
          <Text style={styles.barcodeHint}>
            Ces codes identifient automatiquement la variante lors du scan en caisse.
          </Text>

          {/* Loader barcodes */}
          {loadingBarcodes ? (
            <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: 20 }} />
          ) : (
            <>
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
        </>
      )}
    </ScrollView>

    {/* ── Modal Scanner ── */}
    <Modal
      visible={scannerVisible}
      animationType="slide"
      onRequestClose={() => setScannerVisible(false)}
    >
      <SafeAreaView style={styles.scannerModal}>
        <View style={styles.scannerHeader}>
          <Text style={styles.scannerTitle}>Scanner un code-barre</Text>
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
        </View>

        <View style={styles.scannerFooter}>
          <Ionicons name="scan-outline" size={20} color="#90caf9" />
          <Text style={styles.scannerHint}>Centrez le code-barre dans le cadre</Text>
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

  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  pickerBox: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden' },
  picker: { height: 50 },

  unitChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e3f2fd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12
  },
  unitChipText: { fontSize: 14, fontWeight: '600', color: '#1565c0' },

  barcodeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4
  },
  barcodeHeaderText: { fontSize: 14, color: '#333', flex: 1 },
  priceTag: {
    backgroundColor: '#e3f2fd', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 14
  },
  priceTagText: { fontSize: 12, fontWeight: '700', color: '#1565c0' },
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  scannerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scannerClose: { padding: 4 },

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

  scannerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  scannerHint: { color: '#90caf9', fontSize: 14 },
});

