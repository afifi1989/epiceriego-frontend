import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { unitService } from '../../../../services/unitService';
import {
  StockAdjustmentReason,
  STOCK_REASON_LABELS,
  stockService
} from '../../../../services/stockService';
import { Product, ProductUnit } from '../../../../type';
import { usePermissions } from '../../../../hooks/usePermissions';

type Mode = 'ENTREE' | 'SORTIE';

interface StockTabProps {
  product: Product;
}

export const StockTab: React.FC<StockTabProps> = ({ product }) => {
  const { can } = usePermissions();
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulaire
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);
  const [mode, setMode] = useState<Mode>('ENTREE');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<StockAdjustmentReason>('RECEPTION');
  const [notes, setNotes] = useState('');

  const history = selectedUnit
    ? stockService.getHistory(selectedUnit.id)
    : stockService.getProductHistory(product.id);

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await unitService.getUnits(product.id);
      setUnits(data);
      if (data.length === 1) setSelectedUnit(data[0]);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les variantes');
    } finally {
      setLoading(false);
    }
  };

  const qty = parseInt(quantity) || 0;
  const previewStock = selectedUnit
    ? Math.max(0, selectedUnit.stock + (mode === 'ENTREE' ? qty : -qty))
    : 0;

  const getStockColor = (s: number) => s <= 0 ? '#e53935' : s <= 5 ? '#f57c00' : '#388e3c';
  const getStockLabel = (s: number) => s <= 0 ? 'Rupture' : s <= 5 ? 'Stock faible' : 'En stock';

  const apply = async () => {
    if (!selectedUnit) { Alert.alert('Erreur', 'Sélectionnez une variante'); return; }
    if (qty <= 0) { Alert.alert('Erreur', 'La quantité doit être > 0'); return; }

    setSaving(true);
    const delta = mode === 'ENTREE' ? qty : -qty;
    try {
      const newStock = await stockService.adjustStock(product.id, selectedUnit, delta, reason, notes || undefined);
      // Mettre à jour l'unité localement
      setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, stock: newStock } : u));
      setSelectedUnit(prev => prev ? { ...prev, stock: newStock } : null);
      setQuantity('1');
      setNotes('');
      Alert.alert('✅ Stock mis à jour', `${selectedUnit.label} : ${selectedUnit.stock} → ${newStock}`);
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2196F3" /></View>;
  }

  if (units.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="information-circle-outline" size={48} color="#90caf9" />
        <Text style={styles.noUnitsText}>Aucune variante définie</Text>
        <Text style={styles.noUnitsHint}>Ajoutez des variantes dans l'onglet Variantes pour gérer le stock.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Vue d'ensemble des stocks ── */}
      <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
      <View style={styles.overviewGrid}>
        {units.map(unit => (
          <TouchableOpacity
            key={unit.id}
            style={[styles.unitCard, selectedUnit?.id === unit.id && styles.unitCardSelected]}
            onPress={() => setSelectedUnit(unit)}
          >
            <Text style={styles.unitCardName} numberOfLines={1}>{unit.label}</Text>
            <Text style={[styles.unitCardStock, { color: getStockColor(unit.stock) }]}>
              {unit.stock}
            </Text>
            <Text style={styles.unitCardStockLabel}>unités</Text>
            <View style={[styles.stockLevelDot, { backgroundColor: getStockColor(unit.stock) }]} />
            <Text style={styles.unitCardPrice}>{unit.prix.toFixed(2)} DH</Text>
          </TouchableOpacity>
        ))}
      </View>

      {can('stock:adjust') && (
        <>
          <View style={styles.divider} />

          {/* ── Formulaire d'ajustement ── */}
          <Text style={styles.sectionTitle}>Ajuster le stock</Text>

          {/* Sélection variante (si plusieurs) */}
          {units.length > 1 && (
            <View style={styles.field}>
              <Text style={styles.label}>Variante concernée</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={selectedUnit?.id?.toString() ?? ''}
                  onValueChange={val => setSelectedUnit(units.find(u => u.id.toString() === val) ?? null)}
                  style={styles.picker}
                >
                  <Picker.Item label="— Sélectionner —" value="" />
                  {units.map(u => (
                    <Picker.Item key={u.id} label={`${u.label} (stock: ${u.stock})`} value={u.id.toString()} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          {/* Mode entrée / sortie */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'ENTREE' && styles.modeBtnEntree]}
              onPress={() => setMode('ENTREE')}
            >
              <Ionicons name="arrow-down-circle" size={22} color={mode === 'ENTREE' ? '#fff' : '#388e3c'} />
              <Text style={[styles.modeBtnText, mode === 'ENTREE' && styles.modeBtnTextActive]}>Entrée stock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'SORTIE' && styles.modeBtnSortie]}
              onPress={() => setMode('SORTIE')}
            >
              <Ionicons name="arrow-up-circle" size={22} color={mode === 'SORTIE' ? '#fff' : '#e53935'} />
              <Text style={[styles.modeBtnText, mode === 'SORTIE' && styles.modeBtnTextActive]}>Sortie stock</Text>
            </TouchableOpacity>
          </View>

          {/* Quantité + Raison */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantité</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#bbb"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Raison</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={reason} onValueChange={v => setReason(v as StockAdjustmentReason)} style={styles.pickerSmall}>
                  {Object.entries(STOCK_REASON_LABELS).map(([val, lbl]) => (
                    <Picker.Item key={val} label={lbl} value={val} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes <Text style={styles.optional}>(optionnel)</Text></Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Remarque..."
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Aperçu */}
          {selectedUnit && (
            <View style={[styles.preview, mode === 'ENTREE' ? styles.previewEntree : styles.previewSortie]}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Stock actuel</Text>
                <Text style={styles.previewValue}>{selectedUnit.stock}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{mode === 'ENTREE' ? 'Entrée' : 'Sortie'}</Text>
                <Text style={[styles.previewValue, { color: mode === 'ENTREE' ? '#2e7d32' : '#c62828' }]}>
                  {mode === 'ENTREE' ? '+' : '-'}{qty}
                </Text>
              </View>
              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={[styles.previewLabel, { fontWeight: '700' }]}>Nouveau stock</Text>
                <Text style={[styles.previewValue, { color: getStockColor(previewStock), fontSize: 20 }]}>
                  {previewStock}
                </Text>
              </View>
              <Text style={[styles.previewLevel, { color: getStockColor(previewStock) }]}>
                {getStockLabel(previewStock)}
              </Text>
            </View>
          )}

          {/* Bouton */}
          <TouchableOpacity
            style={[styles.applyBtn, (!selectedUnit || qty <= 0 || saving) && styles.btnDisabled]}
            onPress={apply}
            disabled={!selectedUnit || qty <= 0 || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.applyBtnText}>✅ Appliquer le mouvement</Text>
            }
          </TouchableOpacity>
        </>
      )}

      {/* ── Historique session ── */}
      {can('stock:history') && history.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>📋 Mouvements de cette session</Text>
          {history.map(mv => (
            <View key={mv.id} style={styles.historyItem}>
              <View style={[styles.historyBadge, { backgroundColor: mv.type === 'ENTREE' ? '#e8f5e9' : '#ffebee' }]}>
                <Text style={{ fontSize: 16 }}>{mv.type === 'ENTREE' ? '↓' : '↑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyLabel}>{mv.unitLabel}</Text>
                <Text style={styles.historySub}>
                  {mv.previousStock} → {mv.newStock} · {STOCK_REASON_LABELS[mv.reason]}
                </Text>
              </View>
              <Text style={[styles.historyDelta, { color: mv.delta >= 0 ? '#2e7d32' : '#c62828' }]}>
                {mv.delta >= 0 ? '+' : ''}{mv.delta}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 16 },

  noUnitsText: { fontSize: 17, fontWeight: '600', color: '#999', marginTop: 12, textAlign: 'center' },
  noUnitsHint: { fontSize: 13, color: '#bbb', textAlign: 'center', marginTop: 6 },

  // ── Overview ──
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  unitCard: {
    flex: 1, minWidth: '44%', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#e0e0e0',
    alignItems: 'center'
  },
  unitCardSelected: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  unitCardName: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4, textAlign: 'center' },
  unitCardStock: { fontSize: 28, fontWeight: '900' },
  unitCardStockLabel: { fontSize: 11, color: '#999', marginBottom: 6 },
  stockLevelDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  unitCardPrice: { fontSize: 12, color: '#2196F3', fontWeight: '600' },

  // ── Formulaire ──
  field: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 5 },
  optional: { fontSize: 11, fontWeight: '400', color: '#999' },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333'
  },
  textarea: { height: 64, paddingTop: 10 },
  pickerBox: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden' },
  picker: { height: 50 },
  pickerSmall: { height: 50, fontSize: 13 },

  // ── Mode ──
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fff'
  },
  modeBtnEntree: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  modeBtnSortie: { backgroundColor: '#e53935', borderColor: '#e53935' },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  modeBtnTextActive: { color: '#fff' },

  // ── Aperçu ──
  preview: {
    borderRadius: 12, padding: 14, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: '#ccc'
  },
  previewEntree: { backgroundColor: '#f1f8f2', borderLeftColor: '#43a047' },
  previewSortie: { backgroundColor: '#fff5f5', borderLeftColor: '#ef5350' },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e0e0e0'
  },
  previewTotal: { borderBottomWidth: 0, paddingTop: 8 },
  previewLabel: { fontSize: 14, color: '#555' },
  previewValue: { fontSize: 16, fontWeight: '700', color: '#333' },
  previewLevel: { fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 4 },

  applyBtn: {
    backgroundColor: '#2196F3', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4
  },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  // ── Historique ──
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0'
  },
  historyBadge: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center'
  },
  historyLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  historySub: { fontSize: 12, color: '#888', marginTop: 2 },
  historyDelta: { fontSize: 16, fontWeight: '900' }
});
