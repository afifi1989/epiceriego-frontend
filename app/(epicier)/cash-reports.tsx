export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Historique des rapports Z — Axe POS / S4.
 *
 * Liste des sessions clôturées de la caisse avec téléchargement / partage
 * du PDF Z individuel.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  CashDrawerSessionResponse,
  cashSessionService
} from '../../src/services/cashSessionService';

export default function CashReportsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<CashDrawerSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharingId, setSharingId] = useState<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const page = await cashSessionService.list('CLOSED', 0, 50);
      setSessions(page.content);
    } catch {
      setSessions([]);
    } finally {
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const share = async (session: CashDrawerSessionResponse) => {
    if (sharingId) return;
    setSharingId(session.id);
    try {
      const uri = await cashSessionService.downloadZReportPdf(session.id);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Rapport ${session.zNumber ?? '#' + session.id}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('PDF téléchargé', uri);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de télécharger le Z');
    } finally {
      setSharingId(null);
    }
  };

  const varianceColor = (v: number | null | undefined) => {
    if (v == null || v === 0) return '#2e7d32';
    if (v < 0) return '#c62828';
    return '#fb8c00';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des Z</Text>
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
                <Ionicons name="file-tray-outline" size={36} color="#bbb" />
                <Text style={styles.emptyText}>Aucune clôture enregistrée.</Text>
                <Text style={styles.emptyHint}>
                  Les rapports Z apparaîtront ici après chaque fermeture de caisse.
                </Text>
              </View>
            )}

            {sessions.map(s => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.zNumber}>{s.zNumber ?? `Session #${s.id}`}</Text>
                  <Text style={styles.date}>
                    {s.closedAt
                      ? new Date(s.closedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })
                      : '—'}
                  </Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Ventes</Text>
                    <Text style={styles.kpiValue}>
                      {(s.totalSales ?? 0).toFixed(2)} DH
                    </Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Commandes</Text>
                    <Text style={styles.kpiValue}>{s.orderCount ?? 0}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Écart</Text>
                    <Text style={[styles.kpiValue, { color: varianceColor(s.cashVariance) }]}>
                      {(s.cashVariance ?? 0).toFixed(2)} DH
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.shareBtn, sharingId === s.id && { opacity: 0.5 }]}
                  disabled={sharingId === s.id}
                  onPress={() => share(s)}
                >
                  {sharingId === s.id
                    ? <ActivityIndicator color={Colors.primary} />
                    : (
                      <>
                        <Ionicons name="share-outline" size={18} color={Colors.primary} />
                        <Text style={styles.shareBtnText}>Télécharger / Partager PDF</Text>
                      </>
                    )}
                </TouchableOpacity>
              </View>
            ))}

            <View style={{ height: 30 }} />
          </ScrollView>
        )
      }
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', padding: 40, gap: 6 },
  emptyText: { fontSize: 15, color: '#666', fontWeight: '700', marginTop: 6 },
  emptyHint: { fontSize: 13, color: '#aaa', textAlign: 'center', maxWidth: 260 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#ececec'
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10
  },
  zNumber: { fontSize: 15, fontWeight: '800', color: '#0d47a1' },
  date: { fontSize: 12, color: '#999' },

  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  kpi: {
    flex: 1, backgroundColor: '#f5f7fa', padding: 10, borderRadius: 8,
    alignItems: 'center'
  },
  kpiLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: '700' },
  kpiValue: { fontSize: 14, fontWeight: '800', color: '#333', marginTop: 3 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: '#e3f2fd'
  },
  shareBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 }
});
