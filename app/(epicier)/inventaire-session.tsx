export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Écran de comptage d'une session d'inventaire (S5).
 *
 * Flux :
 *   1. Charge session + lignes
 *   2. Épicier saisit stock_counted par ligne (tap inc/dec ou clavier direct)
 *   3. À chaque saisie → PATCH ligne → maj optimiste
 *   4. Bouton "Valider" → applique écarts comme mouvements INVENTAIRE
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  INVENTORY_STATUS_LABELS,
  InventoryLineResponse,
  InventorySessionResponse,
  stockService
} from '../../src/services/stockService';

type Filter = 'uncounted' | 'counted' | 'all';

export default function InventorySessionScreen() {
  const router = useRouter();
  const { sessionId: sessionIdParam } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = sessionIdParam ? parseInt(sessionIdParam, 10) : NaN;

  const [session, setSession] = useState<InventorySessionResponse | null>(null);
  const [lines, setLines] = useState<InventoryLineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('uncounted');
  const [savingLineId, setSavingLineId] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'csv' | null>(null);

  const filterParam = filter === 'counted' ? true : filter === 'uncounted' ? false : undefined;

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        stockService.getInventorySession(sessionId),
        stockService.listInventoryLines(sessionId, filterParam, 0, 300)
      ]);
      setSession(s);
      setLines(p.content);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sessionId, filterParam]);

  useEffect(() => { load(); }, [load]);

  // ── Comptage inline ─────────────────────────────────────────────────────
  const updateLocalLine = (line: InventoryLineResponse, patch: Partial<InventoryLineResponse>) =>
    setLines(prev => prev.map(l => l.id === line.id ? { ...l, ...patch } : l));

  const saveCount = async (line: InventoryLineResponse, value: string) => {
    if (!session || session.status !== 'IN_PROGRESS') return;
    const parsed = value.trim() === '' ? null : parseInt(value, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }
    setSavingLineId(line.id);
    try {
      const updated = await stockService.countInventoryLine(sessionId, line.id, {
        stockCounted: parsed, note: line.note ?? null
      });
      setLines(prev => prev.map(l => l.id === line.id ? updated : l));
      // Update session progress optimistiquement
      const countedCount = lines.filter(l => l.id !== line.id ? l.counted : updated.counted).length;
      setSession(prev => prev ? {
        ...prev,
        countedItems: countedCount,
        progressPercent: prev.totalItems > 0 ? Math.round(100 * countedCount / prev.totalItems) : 0
      } : null);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer le comptage');
    } finally {
      setSavingLineId(null);
    }
  };

  const adjustLineQty = (line: InventoryLineResponse, delta: number) => {
    const current = line.stockCounted ?? line.stockTheoretical;
    const next = Math.max(0, current + delta);
    updateLocalLine(line, { stockCounted: next });
    saveCount(line, String(next));
  };

  // ── Validation / annulation ────────────────────────────────────────────
  const doValidate = () => {
    Alert.alert(
      'Valider l\'inventaire ?',
      'Les écarts seront appliqués comme mouvements INVENTAIRE sur le stock.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Valider', style: 'default', onPress: async () => {
          setValidating(true);
          try {
            const updated = await stockService.validateInventorySession(sessionId);
            setSession(updated);
            Alert.alert('✅ Inventaire validé',
              `Écart total : ${(updated.totalEcartValue ?? 0).toFixed(2)} DH`);
            load();
          } catch {
            Alert.alert('Erreur', 'Impossible de valider la session');
          } finally {
            setValidating(false);
          }
        }}
      ]
    );
  };

  const shareExport = async (format: 'pdf' | 'csv') => {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const uri = await stockService.downloadInventoryExport(sessionId, format);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
          dialogTitle: `Partager l'inventaire #${sessionId}`,
          UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Fichier téléchargé', uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le document');
    } finally {
      setExportingFormat(null);
    }
  };

  const doCancel = () => {
    Alert.alert(
      'Annuler la session ?',
      'Aucune modification de stock ne sera appliquée.',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
          try {
            const updated = await stockService.cancelInventorySession(sessionId);
            setSession(updated);
            router.back();
          } catch {
            Alert.alert('Erreur', 'Impossible d\'annuler');
          }
        }}
      ]
    );
  };

  if (loading || !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session…</Text>
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const inProgress = session.status === 'IN_PROGRESS';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {session.name || `Session #${session.id}`}
          </Text>
          <Text style={styles.headerSub}>
            {INVENTORY_STATUS_LABELS[session.status]} · {session.countedItems} / {session.totalItems}
          </Text>
        </View>
        <TouchableOpacity onPress={() => shareExport('pdf')} style={styles.iconBtn} disabled={exportingFormat !== null}>
          {exportingFormat === 'pdf'
            ? <ActivityIndicator size="small" color="#333" />
            : <Ionicons name="document-text-outline" size={22} color="#333" />
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shareExport('csv')} style={styles.iconBtn} disabled={exportingFormat !== null}>
          {exportingFormat === 'csv'
            ? <ActivityIndicator size="small" color="#333" />
            : <Ionicons name="grid-outline" size={22} color="#333" />
          }
        </TouchableOpacity>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${session.progressPercent}%` }]} />
      </View>

      {/* Filtres */}
      {inProgress && (
        <View style={styles.filtersRow}>
          {(['uncounted', 'counted', 'all'] as Filter[]).map(f => (
            <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'uncounted' ? 'À compter' : f === 'counted' ? 'Comptés' : 'Tous'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={lines}
        keyExtractor={l => String(l.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle" size={36} color="#2e7d32" />
            <Text style={styles.emptyText}>Aucune ligne pour ce filtre.</Text>
          </View>
        }
        renderItem={({ item: line }) => {
          const ecart = line.ecart;
          return (
            <View style={[styles.lineCard, line.counted && styles.lineCardCounted]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineTitle} numberOfLines={2}>{line.productNom}</Text>
                <Text style={styles.lineSub}>
                  {line.unitLabel} · théorique : <Text style={{ fontWeight: '700' }}>{line.stockTheoretical}</Text>
                </Text>
                {ecart != null && ecart !== 0 && (
                  <Text style={[styles.lineEcart, { color: ecart > 0 ? '#2e7d32' : '#c62828' }]}>
                    Écart : {ecart > 0 ? '+' : ''}{ecart}
                  </Text>
                )}
              </View>
              {inProgress ? (
                <View style={styles.countRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustLineQty(line, -1)}>
                    <Ionicons name="remove" size={18} color="#333" />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.qtyInput, line.counted && { borderColor: '#2e7d32' }]}
                    keyboardType="number-pad"
                    value={line.stockCounted != null ? String(line.stockCounted) : ''}
                    onChangeText={v => updateLocalLine(line, { stockCounted: v === '' ? null : parseInt(v, 10) })}
                    onBlur={() => saveCount(line, line.stockCounted != null ? String(line.stockCounted) : '')}
                    placeholder="—"
                    placeholderTextColor="#ccc"
                    editable={savingLineId !== line.id}
                  />
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustLineQty(line, 1)}>
                    <Ionicons name="add" size={18} color="#333" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.countDisplay}>
                  <Text style={styles.countDisplayLabel}>Compté</Text>
                  <Text style={styles.countDisplayValue}>
                    {line.stockCounted != null ? line.stockCounted : '—'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Footer actions */}
      {inProgress && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.footerBtn, styles.cancelBtn]} onPress={doCancel}>
            <Text style={[styles.footerBtnText, { color: '#c62828' }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerBtn, styles.validateBtn, (validating || session.countedItems === 0) && { opacity: 0.5 }]}
            disabled={validating || session.countedItems === 0}
            onPress={doValidate}>
            {validating
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.footerBtnText, { color: '#fff' }]}>Valider l'inventaire</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#333' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  progressBar: { height: 4, backgroundColor: '#eee' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },

  filtersRow: {
    flexDirection: 'row', gap: 8, padding: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  filterBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#fff'
  },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: '#e3f2fd' },
  filterText: { fontSize: 13, color: '#666', fontWeight: '600' },
  filterTextActive: { color: Colors.primary, fontWeight: '800' },

  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#777' },

  lineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#ececec'
  },
  lineCardCounted: { backgroundColor: '#f1f8f2', borderColor: '#c8e6c9' },
  lineTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  lineSub: { fontSize: 12, color: '#888', marginTop: 3 },
  lineEcart: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  countRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f5f5f5'
  },
  qtyInput: {
    width: 56, height: 38, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#e0e0e0',
    textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#333',
    backgroundColor: '#fff'
  },

  countDisplay: { alignItems: 'center', minWidth: 56 },
  countDisplayLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
  countDisplayValue: { fontSize: 18, fontWeight: '800', color: '#333' },

  footer: {
    flexDirection: 'row', gap: 10,
    padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee'
  },
  footerBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center'
  },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ef9a9a' },
  validateBtn: { backgroundColor: '#2e7d32' },
  footerBtnText: { fontSize: 14, fontWeight: '800' }
});
