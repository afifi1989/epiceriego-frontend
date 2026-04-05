import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { unitService } from '../../../../services/unitService';
import { Product, ProductUnit, ProductUnitRequest, UnitType } from '../../../../type';
import { usePermissions } from '../../../../hooks/usePermissions';

const UNIT_TYPES: { value: UnitType; label: string; hint: string }[] = [
  { value: UnitType.PIECE,  label: 'À la pièce', hint: '1 = 1 pièce' },
  { value: UnitType.WEIGHT, label: 'Au poids',   hint: '0.5 = 500g' },
  { value: UnitType.VOLUME, label: 'Au litre',   hint: '1.5 = 1.5L' },
  { value: UnitType.LENGTH, label: 'Au mètre',   hint: '2 = 2m' }
];

const emptyForm = (): ProductUnitRequest => ({
  unitType: UnitType.PIECE, quantity: 1, label: '',
  prix: 0, prixBarre: undefined, stock: 0, isAvailable: true, displayOrder: 0
});

interface VariantsTabProps {
  product: Product;
  onChanged?: () => void;
}

export const VariantsTab: React.FC<VariantsTabProps> = ({ product, onChanged }) => {
  const { can } = usePermissions();
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ProductUnit | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductUnitRequest>(emptyForm());
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await unitService.getUnits(product.id);
      setUnits(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les variantes');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingUnit(null);
    setForm({ ...emptyForm(), displayOrder: units.length });
    setShowForm(true);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  const openEditForm = (unit: ProductUnit) => {
    setEditingUnit(unit);
    setForm({
      unitType: unit.unitType, quantity: unit.quantity, label: unit.label,
      prix: unit.prix, prixBarre: unit.prixBarre, stock: unit.stock,
      isAvailable: unit.isAvailable, displayOrder: unit.displayOrder
    });
    setShowForm(true);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  const cancelForm = () => { setShowForm(false); setEditingUnit(null); };

  const saveUnit = async () => {
    if (!form.label.trim()) { Alert.alert('Erreur', 'Le libellé est requis'); return; }
    if (form.quantity <= 0) { Alert.alert('Erreur', 'La quantité doit être > 0'); return; }
    setSaving(true);
    try {
      if (editingUnit) {
        await unitService.updateUnit(product.id, editingUnit.id, form);
      } else {
        await unitService.createUnit(product.id, form);
      }
      setShowForm(false);
      setEditingUnit(null);
      loadUnits();
      onChanged?.();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (unit: ProductUnit) => {
    Alert.alert('Confirmer', `Supprimer la variante "${unit.label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await unitService.deleteUnit(product.id, unit.id);
            loadUnits();
            onChanged?.();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        }
      }
    ]);
  };

  const getStockColor = (s: number) => s <= 0 ? '#e53935' : s <= 5 ? '#f57c00' : '#388e3c';

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2196F3" /></View>;
  }

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Formulaire inline ── */}
      {showForm && (
        <View style={styles.formPanel}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingUnit ? '✏️ Modifier la variante' : '➕ Nouvelle variante de vente'}
            </Text>
            <TouchableOpacity onPress={cancelForm}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Type */}
          <Text style={styles.label}>Type de vente <Text style={styles.required}>*</Text></Text>
          <View style={styles.typeButtons}>
            {UNIT_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeBtn, form.unitType === t.value && styles.typeBtnActive]}
                onPress={() => setForm(f => ({ ...f, unitType: t.value }))}
              >
                <Text style={[styles.typeBtnText, form.unitType === t.value && styles.typeBtnTextActive]}>
                  {t.label}
                </Text>
                <Text style={[styles.typeBtnHint, form.unitType === t.value && styles.typeBtnHintActive]}>
                  {t.hint}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Libellé */}
          <Text style={styles.label}>Libellé affiché <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={form.label}
            onChangeText={v => setForm(f => ({ ...f, label: v }))}
            placeholder="Ex : 500g, 1 kg, Bouteille 1L, 6-pack..."
            placeholderTextColor="#bbb"
          />

          {/* Quantité + Prix */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantité <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={form.quantity.toString()}
                onChangeText={v => setForm(f => ({ ...f, quantity: parseFloat(v) || 0 }))}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor="#bbb"
              />
              <Text style={styles.hint}>{UNIT_TYPES.find(t => t.value === form.unitType)?.hint}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prix (DH) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={form.prix.toString()}
                onChangeText={v => setForm(f => ({ ...f, prix: parseFloat(v) || 0 }))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#bbb"
              />
            </View>
          </View>

          {/* Prix barré (promo) */}
          <View style={styles.promoBanner}>
            <Text style={styles.promoTitle}>🏷️ Prix barré (promotion)</Text>
            <Text style={styles.promoHint}>Laissez vide si aucune promo. Doit être supérieur au prix actuel.</Text>
          </View>
          <TextInput
            style={styles.input}
            value={form.prixBarre != null ? form.prixBarre.toString() : ''}
            onChangeText={v => setForm(f => ({ ...f, prixBarre: v === '' ? undefined : parseFloat(v) || undefined }))}
            keyboardType="decimal-pad"
            placeholder="Ex : 12.00 DH (ancien prix)"
            placeholderTextColor="#bbb"
          />

          {/* Stock + Ordre */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Stock initial</Text>
              <TextInput
                style={styles.input}
                value={form.stock.toString()}
                onChangeText={v => setForm(f => ({ ...f, stock: parseInt(v) || 0 }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#bbb"
              />
              <Text style={styles.hint}>Ajustez via l'onglet Stock</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ordre d'affichage</Text>
              <TextInput
                style={styles.input}
                value={(form.displayOrder ?? 0).toString()}
                onChangeText={v => setForm(f => ({ ...f, displayOrder: parseInt(v) || 0 }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#bbb"
              />
            </View>
          </View>

          {/* Disponibilité */}
          <View style={styles.switchRow}>
            <Text style={styles.label}>Disponible à la vente</Text>
            <Switch
              value={form.isAvailable ?? true}
              onValueChange={v => setForm(f => ({ ...f, isAvailable: v }))}
              trackColor={{ false: '#ccc', true: '#bbdefb' }}
              thumbColor={form.isAvailable ? '#2196F3' : '#f4f3f4'}
            />
          </View>

          {/* Boutons form */}
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm} disabled={saving}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={saveUnit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{editingUnit ? '💾 Modifier' : '✅ Ajouter'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarCount}>{units.length} variante{units.length !== 1 ? 's' : ''}</Text>
        {can('variants:create') && !showForm && (
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Ajouter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Liste ── */}
      {units.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={56} color="#ccc" />
          <Text style={styles.emptyText}>Aucune variante</Text>
          <Text style={styles.emptyHint}>Ce produit sera vendu au prix de base en pièce unique.</Text>
        </View>
      ) : (
        units.map(unit => (
          <View key={unit.id} style={[styles.unitCard, editingUnit?.id === unit.id && styles.unitCardEditing]}>
            <View style={styles.unitTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unitLabel}>{unit.label}</Text>
                <Text style={styles.unitSub}>{unit.formattedQuantity ?? unit.quantity} · {unit.unitType}</Text>
              </View>
              <View style={styles.unitActions}>
                {can('variants:edit') && (
                  <TouchableOpacity onPress={() => openEditForm(unit)} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={18} color="#2196F3" />
                  </TouchableOpacity>
                )}
                {can('variants:delete') && (
                  <TouchableOpacity onPress={() => confirmDelete(unit)} style={styles.iconBtn}>
                    <Ionicons name="trash" size={18} color="#e53935" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.unitBottom}>
              {unit.prixBarre != null && unit.prixBarre > unit.prix && (
                <Text style={styles.unitPrixBarre}>{unit.prixBarre.toFixed(2)} DH</Text>
              )}
              <Text style={[styles.unitPrice, unit.prixBarre != null && unit.prixBarre > unit.prix && styles.unitPricePromo]}>
                {unit.prix.toFixed(2)} DH
              </Text>
              <View style={[styles.stockBadge, { backgroundColor: getStockColor(unit.stock) }]}>
                <Text style={styles.stockBadgeText}>Stock: {unit.stock}</Text>
              </View>
              <View style={[styles.availBadge, { backgroundColor: unit.isAvailable ? '#e8f5e9' : '#ffebee' }]}>
                <Text style={[styles.availBadgeText, { color: unit.isAvailable ? '#2e7d32' : '#c62828' }]}>
                  {unit.isAvailable ? 'Dispo' : 'Indispo'}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  // ── Formulaire
  formPanel: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#90caf9',
    shadowColor: '#2196F3', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#1565c0' },

  typeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeBtn: {
    flex: 1, minWidth: '45%', paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9', alignItems: 'center'
  },
  typeBtnActive: { backgroundColor: '#e3f2fd', borderColor: '#2196F3' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  typeBtnTextActive: { color: '#1565c0' },
  typeBtnHint: { fontSize: 10, color: '#999', marginTop: 2 },
  typeBtnHintActive: { color: '#1976d2' },

  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 5, marginTop: 2 },
  required: { color: '#e53935' },
  hint: { fontSize: 11, color: '#999', marginTop: 3 },
  input: {
    backgroundColor: '#f8f8f8', borderRadius: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#333'
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center'
  },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#2196F3', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },

  // ── Toolbar
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10
  },
  toolbarCount: { fontSize: 13, color: '#777', fontWeight: '500' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2196F3', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Liste
  unitCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#e0e0e0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  unitCardEditing: { borderColor: '#2196F3', borderWidth: 1.5 },
  unitTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  unitLabel: { fontSize: 16, fontWeight: '700', color: '#222' },
  unitSub: { fontSize: 12, color: '#888', marginTop: 2 },
  unitActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
  unitBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  unitPrice: { fontSize: 16, fontWeight: '700', color: '#2196F3' },
  unitPricePromo: { color: '#e53935' },
  unitPrixBarre: { fontSize: 13, color: '#999', textDecorationLine: 'line-through', marginRight: 4 },
  promoBanner: {
    backgroundColor: '#fff8e1', borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#FFA000', marginBottom: 8
  },
  promoTitle: { fontSize: 13, fontWeight: '700', color: '#E65100', marginBottom: 2 },
  promoHint: { fontSize: 11, color: '#8D6E63' },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  stockBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  availBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  availBadgeText: { fontSize: 12, fontWeight: '600' },

  // ── Empty
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#999', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#bbb', textAlign: 'center', marginTop: 6 }
});
