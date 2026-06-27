export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Liste des sessions d'inventaire (S5) — écran stack, accessible depuis le dashboard.
 *
 * Crée/ouvre des sessions. Le comptage se fait sur `inventaire-session.tsx`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  CreateInventorySessionRequest,
  INVENTORY_SCOPE_LABELS,
  INVENTORY_STATUS_LABELS,
  InventoryScope,
  InventorySessionResponse,
  stockService
} from '../../src/services/stockService';

export default function InventaireListScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<InventorySessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dialog création
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<InventoryScope>('FULL');
  const [scopeRef, setScopeRef] = useState(''); // categoryId texte
  const [name, setName] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const page = await stockService.listInventorySessions(undefined, 0, 50);
      setSessions(page.content);
    } catch {
      setSessions([]);
    } finally {
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openSession = (s: InventorySessionResponse) => {
    router.push(`/(epicier)/inventaire-session?sessionId=${s.id}` as any);
  };

  const submitCreate = async () => {
    if (scope === 'CATEGORY' && !scopeRef.trim()) {
      Alert.alert('Erreur', 'Saisissez l\'ID de la catégorie');
      return;
    }
    const request: CreateInventorySessionRequest = {
      scope,
      scopeRef: scope === 'CATEGORY' ? parseInt(scopeRef, 10) : null,
      name: name.trim() || null,
      notes: null
    };
    setCreating(true);
    try {
      const session = await stockService.createInventorySession(request);
      setCreateVisible(false);
      setScope('FULL');
      setScopeRef('');
      setName('');
      await load();
      openSession(session);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Impossible de créer la session');
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (status: InventorySessionResponse['status']) =>
    status === 'VALIDATED' ? '#2e7d32'
    : status === 'IN_PROGRESS' ? '#1e88e5'
    : '#9e9e9e';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventaire</Text>
        <TouchableOpacity onPress={() => setCreateVisible(true)} style={styles.headerCta}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.headerCtaText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          >
            {sessions.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="clipboard-outline" size={36} color="#bbb" />
                <Text style={styles.emptyText}>Aucune session pour l'instant.</Text>
                <Text style={styles.emptyHint}>Touchez « Nouveau » pour démarrer un inventaire.</Text>
              </View>
            )}

            {sessions.map(s => (
              <TouchableOpacity key={s.id} style={styles.card} onPress={() => openSession(s)}>
                <View style={styles.cardTop}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(s.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: statusColor(s.status) }]}>
                      {INVENTORY_STATUS_LABELS[s.status]}
                    </Text>
                  </View>
                  <Text style={styles.cardDate}>{new Date(s.startedAt).toLocaleDateString('fr-FR')}</Text>
                </View>
                <Text style={styles.cardTitle}>{s.name || INVENTORY_SCOPE_LABELS[s.scope]}</Text>
                <Text style={styles.cardMeta}>
                  {INVENTORY_SCOPE_LABELS[s.scope]} · {s.countedItems} / {s.totalItems} comptés
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${s.progressPercent}%`,
                    backgroundColor: statusColor(s.status)
                  }]} />
                </View>
                {s.status === 'VALIDATED' && s.totalEcartValue != null && (
                  <Text style={[styles.cardEcart, {
                    color: s.totalEcartValue < 0 ? '#c62828' : '#2e7d32'
                  }]}>
                    Écart : {s.totalEcartValue.toFixed(2)} DH
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            <View style={{ height: 30 }} />
          </ScrollView>
        )
      }

      {/* Modal création */}
      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => !creating && setCreateVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => !creating && setCreateVisible(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Nouvelle session d'inventaire</Text>
              <TouchableOpacity onPress={() => !creating && setCreateVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Portée</Text>
            <View style={styles.pickerBox}>
              <Picker selectedValue={scope} onValueChange={v => setScope(v as InventoryScope)} style={styles.picker}>
                <Picker.Item label={INVENTORY_SCOPE_LABELS.FULL} value="FULL" />
                <Picker.Item label={INVENTORY_SCOPE_LABELS.CATEGORY} value="CATEGORY" />
              </Picker>
            </View>

            {scope === 'CATEGORY' && (
              <>
                <Text style={styles.label}>ID de la catégorie</Text>
                <TextInput style={styles.input}
                  value={scopeRef} onChangeText={setScopeRef}
                  keyboardType="number-pad" placeholder="Ex. 42" placeholderTextColor="#bbb" />
              </>
            )}

            <Text style={styles.label}>Nom (optionnel)</Text>
            <TextInput style={styles.input}
              value={name} onChangeText={setName}
              placeholder="Ex. Inventaire rayon frais" placeholderTextColor="#bbb" />

            <TouchableOpacity
              style={[styles.submitBtn, creating && { opacity: 0.6 }]}
              onPress={submitCreate} disabled={creating}>
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Démarrer l'inventaire</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  iconBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },
  headerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8
  },
  headerCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', padding: 40, gap: 6 },
  emptyText: { fontSize: 15, color: '#666', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#aaa', textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#eee'
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '800' },
  cardDate: { fontSize: 11, color: '#999' },
  cardTitle: { marginTop: 6, fontSize: 15, fontWeight: '700', color: '#333' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  progressBar: {
    height: 6, marginTop: 8, borderRadius: 3,
    backgroundColor: '#f0f0f0', overflow: 'hidden'
  },
  progressFill: { height: '100%' },
  cardEcart: { marginTop: 6, fontSize: 13, fontWeight: '700' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 6 }
    })
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#333' },

  label: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 10, marginBottom: 5 },
  pickerBox: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden' },
  picker: { height: 50 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333'
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 16
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
