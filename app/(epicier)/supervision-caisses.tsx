export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Supervision des caisses — propriétaire / manager.
 *
 * Deux sections :
 *  1. Temps réel — toutes les caisses ouvertes avec leur X-report live
 *     (fond, espèces encaissées, attendu, ventes), rafraîchi toutes les 20 s.
 *  2. Historique — sessions clôturées (toutes caisses) avec écart et
 *     téléchargement du rapport Z PDF.
 *
 * Accès restreint aux profils owner et manager (garde locale + entrée de menu
 * masquée pour les autres).
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CashDrawerSessionResponse,
  XReportResponse,
  cashSessionService,
} from '../../src/services/cashSessionService';
import { Caisse, caisseService } from '../../src/services/caisseService';
import { getUserProfile } from '../../src/hooks/usePermissions';
import { LoginResponse } from '../../src/type';
import { STORAGE_KEYS } from '../../src/constants/config';
import { useCurrency } from '../../src/context/CurrencyContext';

interface OpenView {
  session: CashDrawerSessionResponse;
  report: XReportResponse | null;
  caisseName: string;
}

const POLL_MS = 20000;

export default function SupervisionCaissesScreen() {
  const router = useRouter();
  const { format } = useCurrency();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [openViews, setOpenViews] = useState<OpenView[]>([]);
  const [history, setHistory] = useState<CashDrawerSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);

  // ── Garde d'accès : owner + manager ──
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        const user: LoginResponse | null = raw ? JSON.parse(raw) : null;
        const profile = getUserProfile(user);
        setAllowed(profile === 'owner' || profile === 'manager');
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const nameOf = (cs: Caisse[], id?: number | null): string => {
    const c = cs.find(x => x.id === id);
    return c?.nom ?? (id ? `Caisse #${id}` : 'Caisse');
  };

  const loadLive = useCallback(async (cs: Caisse[]) => {
    const page = await cashSessionService.list('OPEN', 0, 100);
    const sessions = page.content;
    const reports = await Promise.all(
      sessions.map(s => cashSessionService.xReport(s.id).catch(() => null)),
    );
    setOpenViews(sessions.map((s, i) => ({
      session: s,
      report: reports[i],
      caisseName: nameOf(cs, s.caisseId),
    })));
    setLastRefresh(new Date());
  }, []);

  const loadAll = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const cs = await caisseService.list(true);
      setCaisses(cs);
      await loadLive(cs);
      const hist = await cashSessionService.list('CLOSED', 0, 50);
      setHistory(hist.content);
    } catch {
      /* garde l'état précédent en cas d'échec réseau */
    } finally {
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  }, [loadLive]);

  // Polling live pendant que l'écran est au premier plan.
  const caissesRef = useRef<Caisse[]>([]);
  useEffect(() => { caissesRef.current = caisses; }, [caisses]);
  useFocusEffect(useCallback(() => {
    if (allowed !== true) return;
    loadAll();
    const t = setInterval(() => { loadLive(caissesRef.current).catch(() => {}); }, POLL_MS);
    return () => clearInterval(t);
  }, [allowed, loadAll, loadLive]));

  const share = async (s: CashDrawerSessionResponse) => {
    if (sharingId) return;
    setSharingId(s.id);
    try {
      const uri = await cashSessionService.downloadZReportPdf(s.id);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Rapport ${s.zNumber ?? '#' + s.id}`,
          UTI: 'com.adobe.pdf',
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

  const money = (v: number | null | undefined) => format(v ?? 0);
  const varianceColor = (v: number | null | undefined) => {
    if (v == null || v === 0) return '#2e7d32';
    if (v < 0) return '#c62828';
    return '#fb8c00';
  };

  // ── Rendu ──
  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={22} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Supervision des caisses</Text>
    </View>
  );

  if (allowed === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {Header}
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (allowed === false) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {Header}
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={36} color="#bbb" />
          <Text style={styles.emptyText}>Accès réservé</Text>
          <Text style={styles.emptyHint}>
            Cette supervision est réservée au propriétaire et aux managers.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {Header}

      {loading
        ? <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} />}
          >
            {/* ── Temps réel ── */}
            <View style={styles.sectionTitleRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionTitle}>Caisses ouvertes ({openViews.length})</Text>
              {lastRefresh && (
                <Text style={styles.refreshHint}>
                  {lastRefresh.toLocaleTimeString('fr-FR')}
                </Text>
              )}
            </View>

            {openViews.length === 0 && (
              <View style={styles.emptyInline}>
                <Ionicons name="cash-outline" size={28} color="#bbb" />
                <Text style={styles.emptyHint}>Aucune caisse ouverte actuellement.</Text>
              </View>
            )}

            {openViews.map(v => (
              <View key={v.session.id} style={styles.liveCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.caisseName}>{v.caisseName}</Text>
                  <View style={styles.openBadge}><Text style={styles.openBadgeText}>Ouverte</Text></View>
                </View>
                <Text style={styles.date}>
                  Ouverte à {v.session.openedAt
                    ? new Date(v.session.openedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </Text>
                <View style={styles.kpiGrid}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Fond</Text>
                    <Text style={styles.kpiValue}>{money(v.report?.openingFloat ?? v.session.openingFloat)}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Espèces</Text>
                    <Text style={styles.kpiValue}>{money(v.report?.totalCash)}</Text>
                  </View>
                  <View style={[styles.kpi, styles.kpiAccent]}>
                    <Text style={styles.kpiLabel}>Attendu</Text>
                    <Text style={[styles.kpiValue, { color: '#047857' }]}>{money(v.report?.expectedCash)}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Ventes</Text>
                    <Text style={styles.kpiValue}>{money(v.report?.totalSales)}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Carte</Text>
                    <Text style={styles.kpiValue}>{money(v.report?.totalCard)}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Nb ventes</Text>
                    <Text style={styles.kpiValue}>{v.report?.orderCount ?? 0}</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* ── Historique ── */}
            <View style={[styles.sectionTitleRow, { marginTop: 22 }]}>
              <Ionicons name="time-outline" size={16} color="#555" />
              <Text style={styles.sectionTitle}>Historique des clôtures</Text>
            </View>

            {history.length === 0 && (
              <View style={styles.emptyInline}>
                <Ionicons name="file-tray-outline" size={28} color="#bbb" />
                <Text style={styles.emptyHint}>Aucune session clôturée.</Text>
              </View>
            )}

            {history.map(s => (
              <View key={s.id} style={styles.histCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.zNumber}>{s.zNumber ?? `Session #${s.id}`}</Text>
                  <Text style={styles.date}>{nameOf(caisses, s.caisseId)}</Text>
                </View>
                <Text style={styles.date}>
                  {s.closedAt
                    ? new Date(s.closedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </Text>
                <View style={[styles.kpiGrid, { marginTop: 8 }]}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Ventes</Text>
                    <Text style={styles.kpiValue}>{money(s.totalSales)}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Attendu</Text>
                    <Text style={styles.kpiValue}>{money(s.expectedCash)}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Écart</Text>
                    <Text style={[styles.kpiValue, { color: varianceColor(s.cashVariance) }]}>{money(s.cashVariance)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.shareBtn, sharingId === s.id && { opacity: 0.5 }]}
                  disabled={sharingId === s.id}
                  onPress={() => share(s)}
                >
                  {sharingId === s.id
                    ? <ActivityIndicator color={Colors.primary} />
                    : (<><Ionicons name="share-outline" size={16} color={Colors.primary} /><Text style={styles.shareBtnText}>Rapport Z (PDF)</Text></>)}
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
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  iconBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', padding: 40, gap: 6 },
  emptyInline: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyText: { fontSize: 15, color: '#666', fontWeight: '700', marginTop: 6 },
  emptyHint: { fontSize: 13, color: '#aaa', textAlign: 'center', maxWidth: 280 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#333' },
  refreshHint: { marginLeft: 'auto', fontSize: 11, color: '#999' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#22c55e' },

  liveCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e6f4ea',
  },
  histCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#ececec',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caisseName: { fontSize: 15, fontWeight: '800', color: '#0d47a1' },
  zNumber: { fontSize: 15, fontWeight: '800', color: '#0d9488' },
  date: { fontSize: 12, color: '#999', marginTop: 2 },

  openBadge: { backgroundColor: '#e6f4ea', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  openBadgeText: { color: '#1b8a4b', fontWeight: '700', fontSize: 11 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  kpi: {
    flexGrow: 1, flexBasis: '30%', backgroundColor: '#f5f7fa', padding: 8, borderRadius: 8,
    alignItems: 'center',
  },
  kpiAccent: { backgroundColor: '#ecfdf5' },
  kpiLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: '700' },
  kpiValue: { fontSize: 13, fontWeight: '800', color: '#333', marginTop: 3 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 9, borderRadius: 8, marginTop: 10,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: '#e3f2fd',
  },
  shareBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
});
