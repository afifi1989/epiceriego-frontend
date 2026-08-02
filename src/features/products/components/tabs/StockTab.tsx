import { Colors } from '../../../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
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
  MANUAL_ADJUSTMENT_REASONS,
  StockMovement,
  StockBatchResponse,
  ReceiveBatchRequest,
  BatchReduceReason,
  BATCH_REDUCE_REASONS,
  getExpiryLevel,
  stockService
} from '../../../../services/stockService';
import { LoginResponse, Product, ProductUnit, UnitType } from '../../../../type';
import { usePermissions } from '../../../../hooks/usePermissions';
import SupplierAutocomplete from '../../../../components/epicier/SupplierAutocomplete';

const HISTORY_PAGE_SIZE = 20;

type Mode = 'ENTREE' | 'SORTIE';

// ── R2 — Quantités décimales (vrac : poids / volume / longueur) ──────────
// La quantité saisie est en unité de base (identique au backend). Le
// caractère entier/décimal dépend du type de la variante : PIECE reste
// entier (2,5 pièces n'a pas de sens), les autres autorisent 3 décimales.

/** true si la variante autorise une quantité décimale (non-PIECE). */
const allowsDecimal = (u: ProductUnit | null | undefined): boolean =>
  !!u && u.unitType !== UnitType.PIECE;

/** Libellé de l'unité de base à afficher (kg / L / m / pcs). */
const baseUnitLabel = (u: ProductUnit | null | undefined): string => {
  if (!u) return '';
  if (u.baseUnit) return u.baseUnit;
  switch (u.unitType) {
    case UnitType.WEIGHT: return 'kg';
    case UnitType.VOLUME: return 'L';
    case UnitType.LENGTH: return 'm';
    default: return 'pcs';
  }
};

/**
 * Parse robuste d'une quantité saisie : normalise la virgule FR en point
 * puis parseFloat (ou parseInt pour les PIECE). NaN → 0.
 */
const parseQty = (raw: string, decimal: boolean): number => {
  const norm = (raw ?? '').replace(',', '.').trim();
  const n = decimal ? parseFloat(norm) : parseInt(norm, 10);
  return isNaN(n) ? 0 : n;
};

/** Formatage d'affichage : 3 décimales max, zéros inutiles supprimés. */
const fmtQty = (n: number): string => {
  if (!isFinite(n)) return '0';
  return String(Math.round(n * 1000) / 1000);
};

interface StockTabProps {
  product: Product;
  /** LoginResponse chargé par le parent (cf. VariantsTab pour le contexte). */
  user: LoginResponse | null;
}

export const StockTab: React.FC<StockTabProps> = ({ product, user }) => {
  const { can } = usePermissions(user);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulaire
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);
  const [mode, setMode] = useState<Mode>('ENTREE');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<StockAdjustmentReason>('RECEPTION');
  const [notes, setNotes] = useState('');

  // Historique paginé depuis l'API
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLast, setHistoryLast] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Sprint 3 : Lots (DLC) ─────────────────────────────────────────────
  const [batches, setBatches] = useState<StockBatchResponse[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // Modal réception
  const [receptionVisible, setReceptionVisible] = useState(false);
  const [receptionSaving, setReceptionSaving] = useState(false);
  const [rcpUnitId, setRcpUnitId] = useState<number | null>(null);
  const [rcpQty, setRcpQty] = useState('1');
  const [rcpExpiry, setRcpExpiry] = useState('');          // YYYY-MM-DD
  const [rcpUnitCost, setRcpUnitCost] = useState('');
  /** V96 — Fournisseur applique via l'autocomplete. Si null → mode texte
   *  libre (rcpSupplier conserve pour saisie manuelle / clients legacy). */
  const [rcpSupplierSelected, setRcpSupplierSelected] = useState<{ id: number; name: string } | null>(null);
  const [rcpSupplier, setRcpSupplier] = useState('');
  const [rcpInvoice, setRcpInvoice] = useState('');
  const [rcpNotes, setRcpNotes] = useState('');

  // Modal réduction lot
  const [reduceTarget, setReduceTarget] = useState<StockBatchResponse | null>(null);
  const [reduceSaving, setReduceSaving] = useState(false);
  const [reduceQty, setReduceQty] = useState('1');
  const [reduceReason, setReduceReason] = useState<BatchReduceReason>('CASSE');
  const [reduceNotes, setReduceNotes] = useState('');

  useEffect(() => { loadUnits(); }, []);

  // Recharge l'historique après chargement des units (pour résoudre les labels)
  useEffect(() => {
    if (units.length > 0) {
      reloadHistory();
      loadBatches();
    }
  }, [units.length]);

  const reloadHistory = async () => {
    setHistoryPage(0);
    setHistoryLast(false);
    await fetchHistoryPage(0, true);
  };

  const loadMoreHistory = async () => {
    if (historyLast || historyLoading) return;
    const next = historyPage + 1;
    setHistoryPage(next);
    await fetchHistoryPage(next, false);
  };

  // ── Chargement des lots ────────────────────────────────────────────────
  const loadBatches = async () => {
    setBatchesLoading(true);
    try {
      const resp = await stockService.getProductBatches(product.id, true, 0, 50);
      setBatches(resp.content);
    } catch {
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  };

  const getUnitLabel = (unitId: number): string =>
    units.find(u => u.id === unitId)?.label ?? `#${unitId}`;

  // ── Réception ──────────────────────────────────────────────────────────
  const openReception = () => {
    setRcpUnitId(selectedUnit?.id ?? units[0]?.id ?? null);
    setRcpQty('1');
    setRcpExpiry('');
    setRcpUnitCost('');
    setRcpSupplier('');
    setRcpSupplierSelected(null);
    setRcpInvoice('');
    setRcpNotes('');
    setReceptionVisible(true);
  };

  /**
   * Fermeture protégée du modal réception (X, backdrop, bouton back Android) :
   * si des champs ont été saisis, on confirme avant de jeter — un tap hors du
   * modal pendant la saisie d'une réception (qté, DLC, coût, fournisseur)
   * perdait tout silencieusement. La fermeture programmatique après
   * sauvegarde appelle directement setReceptionVisible(false).
   */
  const closeReception = () => {
    if (receptionSaving) return;
    const hasInput = rcpQty !== '1' || !!rcpExpiry || !!rcpUnitCost
      || !!rcpSupplier || !!rcpSupplierSelected || !!rcpInvoice || !!rcpNotes;
    if (!hasInput) {
      setReceptionVisible(false);
      return;
    }
    Alert.alert(
      'Réception non enregistrée',
      'Les informations saisies seront perdues. Fermer quand même ?',
      [
        { text: 'Continuer la saisie', style: 'cancel' },
        { text: 'Fermer', style: 'destructive', onPress: () => setReceptionVisible(false) },
      ],
    );
  };

  const saveReception = async () => {
    const rcpUnit = units.find(u => u.id === rcpUnitId) ?? null;
    const qty = parseQty(rcpQty, allowsDecimal(rcpUnit));
    if (!rcpUnitId || !qty || qty <= 0) {
      Alert.alert('Erreur', 'Variante et quantité requises');
      return;
    }
    if (rcpExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(rcpExpiry)) {
      Alert.alert('Erreur', 'Format DLC attendu : AAAA-MM-JJ');
      return;
    }
    setReceptionSaving(true);
    const payload: ReceiveBatchRequest = {
      productUnitId: rcpUnitId,
      quantity: qty,
      expiryDate: rcpExpiry || null,
      receivedAt: null,
      unitCost: rcpUnitCost ? parseFloat(rcpUnitCost) : null,
      // V96 — Si un fournisseur a ete selectionne via l'autocomplete, on
      // envoie son id (le serveur snapshot le name autoritatif). Sinon
      // fallback en mode texte libre (rcpSupplier).
      supplierId: rcpSupplierSelected?.id ?? null,
      supplierName: rcpSupplierSelected?.name ?? (rcpSupplier || null),
      supplierInvoice: rcpInvoice || null,
      notes: rcpNotes || null
    };
    try {
      await stockService.receiveBatch(payload);
      // Sync unit.stock local (+qty)
      setUnits(prev => prev.map(u =>
        u.id === rcpUnitId ? { ...u, stock: u.stock + qty } : u
      ));
      if (selectedUnit?.id === rcpUnitId) {
        setSelectedUnit(prev => prev ? { ...prev, stock: prev.stock + qty } : null);
      }
      setReceptionVisible(false);
      Alert.alert('✅ Réception enregistrée', `+${fmtQty(qty)} ${getUnitLabel(rcpUnitId)}`);
      loadBatches();
      reloadHistory();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la réception');
    } finally {
      setReceptionSaving(false);
    }
  };

  // ── Réduction lot ──────────────────────────────────────────────────────
  const openReduce = (batch: StockBatchResponse) => {
    setReduceTarget(batch);
    setReduceQty('1');
    setReduceReason(
      batch.daysUntilExpiry != null && batch.daysUntilExpiry < 0 ? 'EXPIRATION' : 'CASSE'
    );
    setReduceNotes('');
  };

  const confirmReduce = async () => {
    if (!reduceTarget) return;
    const reduceUnit = units.find(u => u.id === reduceTarget.productUnitId) ?? null;
    const qty = parseQty(reduceQty, allowsDecimal(reduceUnit));
    if (!qty || qty <= 0 || qty > reduceTarget.quantityRemaining) {
      Alert.alert('Erreur', `Quantité invalide (max ${reduceTarget.quantityRemaining})`);
      return;
    }
    setReduceSaving(true);
    try {
      const updated = await stockService.reduceBatch(reduceTarget.id, {
        quantity: qty, reason: reduceReason, notes: reduceNotes || null
      });
      // Sync unit.stock local (-qty)
      setUnits(prev => prev.map(u =>
        u.id === updated.productUnitId ? { ...u, stock: Math.max(0, u.stock - qty) } : u
      ));
      if (selectedUnit?.id === updated.productUnitId) {
        setSelectedUnit(prev => prev ? { ...prev, stock: Math.max(0, prev.stock - qty) } : null);
      }
      // Replace ou retirer
      if (updated.quantityRemaining > 0) {
        setBatches(prev => prev.map(b => b.id === updated.id ? updated : b));
      } else {
        setBatches(prev => prev.filter(b => b.id !== updated.id));
      }
      setReduceTarget(null);
      Alert.alert('✅ Lot ajusté', `-${fmtQty(qty)} (${STOCK_REASON_LABELS[reduceReason]})`);
      reloadHistory();
    } catch {
      Alert.alert('Erreur', 'Impossible de réduire le lot');
    } finally {
      setReduceSaving(false);
    }
  };

  const fetchHistoryPage = async (page: number, reset: boolean) => {
    setHistoryLoading(true);
    try {
      const resp = await stockService.getProductHistory(product.id, page, HISTORY_PAGE_SIZE);
      // Enrichir avec le label de variante
      const enriched = resp.content.map(mv => ({
        ...mv,
        unitLabel: units.find(u => u.id === mv.unitId)?.label ?? `#${mv.unitId}`
      }));
      setHistory(prev => reset ? enriched : [...prev, ...enriched]);
      setHistoryLast(resp.last);
      setHistoryTotal(resp.totalElements);
    } catch {
      if (reset) setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

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

  const decimalQty = allowsDecimal(selectedUnit);
  const qty = parseQty(quantity, decimalQty);
  const previewStock = selectedUnit
    ? Math.max(0, Math.round((selectedUnit.stock + (mode === 'ENTREE' ? qty : -qty)) * 1000) / 1000)
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
      Alert.alert('✅ Stock mis à jour', `${selectedUnit.label} : ${fmtQty(selectedUnit.stock)} → ${fmtQty(newStock)}`);
      // Recharge l'historique depuis le serveur (mouvement persisté)
      reloadHistory();
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
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

      {/* ── Lots actifs (DLC) ── */}
      <View style={styles.divider} />
      <View style={styles.batchHeader}>
        <Text style={styles.sectionTitle}>📦 Lots actifs{batches.length > 0 ? ` (${batches.length})` : ''}</Text>
        {can('stock:adjust') && (
          <TouchableOpacity style={styles.receptionBtn} onPress={openReception}>
            <Ionicons name="cube-outline" size={16} color="#fff" />
            <Text style={styles.receptionBtnText}>Réceptionner</Text>
          </TouchableOpacity>
        )}
      </View>

      {batchesLoading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 10 }} />}

      {!batchesLoading && batches.length === 0 && (
        <View style={styles.noBatches}>
          <Ionicons name="file-tray-outline" size={24} color="#bbb" />
          <Text style={styles.noBatchesText}>Aucun lot actif</Text>
        </View>
      )}

      {batches.map(b => {
        const level = getExpiryLevel(b.daysUntilExpiry);
        const levelColor = level === 'expired' ? '#b71c1c'
          : level === 'urgent' ? '#e53935'
          : level === 'soon' ? '#fb8c00'
          : level === 'ok' ? '#2e7d32' : '#888';
        return (
          <View key={b.id} style={[styles.batchCard, { borderLeftColor: levelColor }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.batchTopRow}>
                <Text style={styles.batchQty}>
                  {b.quantityRemaining}
                  <Text style={styles.batchQtyInitial}> / {b.quantityInitial}</Text>
                </Text>
                <Text style={styles.batchUnit}>{getUnitLabel(b.productUnitId)}</Text>
              </View>
              <View style={styles.batchMeta}>
                {b.expiryDate
                  ? <Text style={[styles.batchBadge, { backgroundColor: levelColor + '22', color: levelColor }]}>
                      {level === 'expired'
                        ? `Périmé ${-(b.daysUntilExpiry ?? 0)}j`
                        : `DLC ${b.expiryDate}${b.daysUntilExpiry != null ? ` (J-${b.daysUntilExpiry})` : ''}`}
                    </Text>
                  : <Text style={styles.batchBadgeNeutral}>Sans DLC</Text>
                }
                {b.supplierName ? <Text style={styles.batchMetaTxt}>• {b.supplierName}</Text> : null}
                {b.unitCost != null ? <Text style={styles.batchMetaTxt}>• {b.unitCost} DH/u</Text> : null}
              </View>
            </View>
            {can('stock:adjust') && (
              <TouchableOpacity onPress={() => openReduce(b)} style={styles.batchReduceBtn}>
                <Ionicons name="remove-circle-outline" size={22} color="#e53935" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

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
              <Text style={styles.label}>
                Quantité{selectedUnit ? ` (${baseUnitLabel(selectedUnit)})` : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType={decimalQty ? 'decimal-pad' : 'number-pad'}
                placeholder={decimalQty ? '0.001' : '1'}
                placeholderTextColor="#bbb"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Raison</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={reason} onValueChange={v => setReason(v as StockAdjustmentReason)} style={styles.pickerSmall}>
                  {MANUAL_ADJUSTMENT_REASONS.map(val => (
                    <Picker.Item key={val} label={STOCK_REASON_LABELS[val]} value={val} />
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
                <Text style={styles.previewValue}>{fmtQty(selectedUnit.stock)} {baseUnitLabel(selectedUnit)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{mode === 'ENTREE' ? 'Entrée' : 'Sortie'}</Text>
                <Text style={[styles.previewValue, { color: mode === 'ENTREE' ? '#2e7d32' : '#c62828' }]}>
                  {mode === 'ENTREE' ? '+' : '-'}{fmtQty(qty)} {baseUnitLabel(selectedUnit)}
                </Text>
              </View>
              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={[styles.previewLabel, { fontWeight: '700' }]}>Nouveau stock</Text>
                <Text style={[styles.previewValue, { color: getStockColor(previewStock), fontSize: 20 }]}>
                  {fmtQty(previewStock)} {baseUnitLabel(selectedUnit)}
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

      {/* ── Historique persisté ── */}
      {can('stock:history') && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>
            📋 Historique des mouvements{historyTotal > 0 ? ` (${historyTotal})` : ''}
          </Text>

          {history.length === 0 && !historyLoading && (
            <View style={styles.noHistory}>
              <Ionicons name="file-tray-outline" size={28} color="#bbb" />
              <Text style={styles.noHistoryText}>Aucun mouvement enregistré</Text>
            </View>
          )}

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
                <Text style={styles.historyDate}>
                  {mv.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  {' '}
                  {mv.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {mv.notes ? <Text style={styles.historyNotes} numberOfLines={2}>{mv.notes}</Text> : null}
              </View>
              <Text style={[styles.historyDelta, { color: mv.delta >= 0 ? '#2e7d32' : '#c62828' }]}>
                {mv.delta >= 0 ? '+' : ''}{mv.delta}
              </Text>
            </View>
          ))}

          {!historyLast && history.length > 0 && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMoreHistory}
              disabled={historyLoading}
            >
              {historyLoading
                ? <ActivityIndicator color={Colors.primary} />
                : <Text style={styles.loadMoreText}>Charger plus</Text>
              }
            </TouchableOpacity>
          )}

          {historyLoading && history.length === 0 && (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          )}
        </>
      )}

      {/* ── Modal Réception ── */}
      <Modal visible={receptionVisible} animationType="slide" transparent onRequestClose={closeReception}>
        <Pressable style={styles.modalOverlay} onPress={closeReception}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réceptionner une marchandise</Text>
              <TouchableOpacity onPress={closeReception}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {units.length > 1 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Variante</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      selectedValue={rcpUnitId?.toString() ?? ''}
                      onValueChange={val => setRcpUnitId(val ? parseInt(val, 10) : null)}
                      style={styles.picker}>
                      <Picker.Item label="— Sélectionner —" value="" />
                      {units.map(u => (
                        <Picker.Item key={u.id} label={u.label} value={u.id.toString()} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  {(() => {
                    const rcpUnit = units.find(u => u.id === rcpUnitId) ?? null;
                    const rcpDecimal = allowsDecimal(rcpUnit);
                    return (
                      <>
                        <Text style={styles.label}>
                          Quantité{rcpUnit ? ` (${baseUnitLabel(rcpUnit)})` : ''}
                        </Text>
                        <TextInput style={styles.input} value={rcpQty} onChangeText={setRcpQty}
                          keyboardType={rcpDecimal ? 'decimal-pad' : 'number-pad'}
                          placeholder={rcpDecimal ? '0.001' : '1'} placeholderTextColor="#bbb" />
                      </>
                    );
                  })()}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Prix d'achat (DH)</Text>
                  <TextInput style={styles.input} value={rcpUnitCost} onChangeText={setRcpUnitCost}
                    keyboardType="decimal-pad" placeholder="optionnel" placeholderTextColor="#bbb" />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>DLC (AAAA-MM-JJ)</Text>
                <TextInput style={styles.input} value={rcpExpiry} onChangeText={setRcpExpiry}
                  placeholder="2026-12-31" placeholderTextColor="#bbb" autoCapitalize="none" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Fournisseur</Text>
                {/* V96 — Autocomplete vers l'entite Supplier. Si l'utilisateur
                    tape un nom inconnu, le composant propose "+ Creer" en
                    quick-create. Fallback texte libre toujours possible : si
                    aucun supplier n'est selectionne, le champ rcpSupplier
                    (texte libre, plus bas) reste utilise. */}
                <SupplierAutocomplete
                  value={rcpSupplierSelected as any}
                  onChange={(s) => {
                    setRcpSupplierSelected(s ? { id: s.id, name: s.name } : null);
                    // Si on lie a une vraie entite, on vide le texte libre
                    // pour eviter la confusion (le serveur prend le snapshot
                    // depuis le lookup de toute facon).
                    if (s) setRcpSupplier('');
                  }}
                  placeholder="Rechercher un fournisseur"
                />
              </View>
              {!rcpSupplierSelected && (
                <View style={styles.field}>
                  <Text style={styles.label}>Ou nom libre</Text>
                  <TextInput style={styles.input} value={rcpSupplier} onChangeText={setRcpSupplier}
                    placeholder="Saisie libre (sans fiche fournisseur)" placeholderTextColor="#bbb" />
                </View>
              )}
              <View style={styles.field}>
                <Text style={styles.label}>N° Facture</Text>
                <TextInput style={styles.input} value={rcpInvoice} onChangeText={setRcpInvoice}
                  placeholder="optionnel" placeholderTextColor="#bbb" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Notes</Text>
                <TextInput style={[styles.input, styles.textarea]} value={rcpNotes} onChangeText={setRcpNotes}
                  placeholder="Remarque…" placeholderTextColor="#bbb" multiline numberOfLines={2} />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.applyBtn, receptionSaving && styles.btnDisabled]}
              onPress={saveReception}
              disabled={receptionSaving}>
              {receptionSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.applyBtnText}>✅ Enregistrer la réception</Text>
              }
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal Réduction lot ── */}
      <Modal visible={reduceTarget !== null} animationType="fade" transparent onRequestClose={() => setReduceTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => !reduceSaving && setReduceTarget(null)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            {reduceTarget && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Retirer du lot — {getUnitLabel(reduceTarget.productUnitId)}
                  </Text>
                  <TouchableOpacity onPress={() => !reduceSaving && setReduceTarget(null)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>
                  Restant : {reduceTarget.quantityRemaining}
                  {reduceTarget.expiryDate ? ` • DLC ${reduceTarget.expiryDate}` : ''}
                </Text>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    {(() => {
                      const reduceUnit = units.find(u => u.id === reduceTarget.productUnitId) ?? null;
                      const reduceDecimal = allowsDecimal(reduceUnit);
                      return (
                        <>
                          <Text style={styles.label}>
                            Quantité{reduceUnit ? ` (${baseUnitLabel(reduceUnit)})` : ''}
                          </Text>
                          <TextInput style={styles.input} value={reduceQty} onChangeText={setReduceQty}
                            keyboardType={reduceDecimal ? 'decimal-pad' : 'number-pad'}
                            placeholder={reduceDecimal ? '0.001' : '1'} placeholderTextColor="#bbb" />
                        </>
                      );
                    })()}
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>Raison</Text>
                    <View style={styles.pickerBox}>
                      <Picker selectedValue={reduceReason}
                        onValueChange={v => setReduceReason(v as BatchReduceReason)}
                        style={styles.pickerSmall}>
                        {BATCH_REDUCE_REASONS.map(r => (
                          <Picker.Item key={r} label={STOCK_REASON_LABELS[r]} value={r} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={reduceNotes} onChangeText={setReduceNotes}
                    placeholder="Remarque…" placeholderTextColor="#bbb" multiline numberOfLines={2} />
                </View>
                <TouchableOpacity
                  style={[styles.applyBtn, reduceSaving && styles.btnDisabled]}
                  onPress={confirmReduce}
                  disabled={reduceSaving}>
                  {reduceSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.applyBtnText}>Confirmer la sortie</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  unitCardSelected: { borderColor: Colors.primary, backgroundColor: '#e3f2fd' },
  unitCardName: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4, textAlign: 'center' },
  unitCardStock: { fontSize: 28, fontWeight: '900' },
  unitCardStockLabel: { fontSize: 11, color: '#999', marginBottom: 6 },
  stockLevelDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  unitCardPrice: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

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
    backgroundColor: Colors.primary, borderRadius: 12,
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
  historyDate: { fontSize: 11, color: '#aaa', marginTop: 2 },
  historyNotes: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 3 },
  historyDelta: { fontSize: 16, fontWeight: '900' },

  // ── Load more / empty ──
  loadMoreBtn: {
    marginTop: 8, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.primary, alignItems: 'center'
  },
  loadMoreText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  noHistory: {
    alignItems: 'center', paddingVertical: 24, gap: 6
  },
  noHistoryText: { fontSize: 13, color: '#999' },

  // ── Sprint 3 : Lots (DLC) ──
  batchHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10
  },
  receptionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 8
  },
  receptionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  noBatches: {
    alignItems: 'center', paddingVertical: 16, gap: 4,
    backgroundColor: '#f5f5f5', borderRadius: 8
  },
  noBatchesText: { fontSize: 13, color: '#999' },

  batchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0',
    borderLeftWidth: 4
  },
  batchTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  batchQty: { fontSize: 17, fontWeight: '800', color: '#333' },
  batchQtyInitial: { fontSize: 12, fontWeight: '500', color: '#999' },
  batchUnit: { fontSize: 13, color: '#666' },
  batchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  batchBadge: {
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    overflow: 'hidden'
  },
  batchBadgeNeutral: {
    fontSize: 11, color: '#888',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    backgroundColor: '#f0f0f0', overflow: 'hidden'
  },
  batchMetaTxt: { fontSize: 11, color: '#888' },
  batchReduceBtn: { padding: 6 },

  // ── Modal générique ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalSheet: {
    width: '100%', maxWidth: 500,
    backgroundColor: '#fff', borderRadius: 14, padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 6 }
    })
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#333', flex: 1, marginRight: 8 },
  modalSubtitle: { fontSize: 13, color: '#777', marginBottom: 14 }
});
