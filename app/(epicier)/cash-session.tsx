export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Écran Caisse — Axe POS / S2.
 *
 * Trois modes selon l'état courant :
 *  1. Aucune session ouverte → formulaire d'ouverture (saisie fond de caisse)
 *  2. Session ouverte → dashboard live (rapport X temps réel + bouton clôture)
 *  3. Clôture → saisie cash compté + justification écart → figeage Z
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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  CashDrawerSessionResponse,
  XReportResponse,
  cashSessionService
} from '../../src/services/cashSessionService';
import { useActiveCaisse } from '../../src/services/activeCaisse';
import { CaisseSelector } from '../../src/components/epicier/CaisseSelector';

type Mode = 'loading' | 'open-form' | 'live' | 'close-form';

export default function CashSessionScreen() {
  const router = useRouter();
  const activeCaisseId = useActiveCaisse();
  const [mode, setMode] = useState<Mode>('loading');
  const [session, setSession] = useState<CashDrawerSessionResponse | null>(null);
  const [xReport, setXReport] = useState<XReportResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Open form
  const [openingFloat, setOpeningFloat] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [opening, setOpening] = useState(false);

  // Close form
  const [countedCash, setCountedCash] = useState('');
  const [varianceNote, setVarianceNote] = useState('');
  const [closing, setClosing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let current = await cashSessionService.getCurrent(activeCaisseId);

      // Fallback : si /current ne retourne rien, chercher via la liste
      // (cas où la session a été ouverte par un autre collaborateur/appareil)
      if (!current) {
        try {
          const page = await cashSessionService.list('OPEN', 0, 1, activeCaisseId);
          if (page.content && page.content.length > 0) {
            current = page.content[0];
          }
        } catch {
          // ignore — on reste sur open-form
        }
      }

      if (!current) {
        setSession(null);
        setXReport(null);
        setMode('open-form');
      } else {
        setSession(current);
        try {
          const x = await cashSessionService.xReport(current.id);
          setXReport(x);
        } catch {
          // X report peut échouer, on affiche quand même le dashboard
          setXReport(null);
        }
        setMode('live');
      }
    } catch {
      setMode('open-form');
    } finally {
      setRefreshing(false);
    }
  }, [activeCaisseId]);

  useFocusEffect(useCallback(() => {
    setMode('loading');
    refresh();
  }, [refresh]));

  // ── Ouverture ──────────────────────────────────────────────────────
  const submitOpen = async () => {
    const parsed = parseFloat((openingFloat || '0').replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Erreur', 'Fond de caisse invalide');
      return;
    }
    setOpening(true);
    try {
      const created = await cashSessionService.open({
        openingFloat: parsed,
        notes: openNotes.trim() || null
      }, activeCaisseId);
      setSession(created);
      setOpeningFloat('');
      setOpenNotes('');
      const x = await cashSessionService.xReport(created.id);
      setXReport(x);
      setMode('live');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Impossible d\'ouvrir la caisse');
    } finally {
      setOpening(false);
    }
  };

  // ── Clôture ────────────────────────────────────────────────────────
  const beginClose = () => {
    setCountedCash(xReport ? xReport.expectedCash.toFixed(2) : '0.00');
    setVarianceNote('');
    setMode('close-form');
  };

  const submitClose = async () => {
    if (!session) return;
    const parsed = parseFloat((countedCash || '0').replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Erreur', 'Cash compté invalide');
      return;
    }
    const expected = xReport?.expectedCash ?? 0;
    const variance = parsed - expected;
    if (variance !== 0 && !varianceNote.trim()) {
      Alert.alert('Justification requise',
        `Écart de ${variance.toFixed(2)} DH — saisissez une note.`);
      return;
    }
    setClosing(true);
    try {
      const closed = await cashSessionService.close(session.id, {
        countedCash: parsed,
        varianceNote: varianceNote.trim() || null
      });
      Alert.alert(
        `✅ Caisse clôturée — ${closed.zNumber ?? `#${closed.id}`}`,
        `Écart : ${closed.cashVariance?.toFixed(2) ?? '0.00'} DH\n` +
        `Ventes : ${closed.totalSales?.toFixed(2) ?? '0.00'} DH`,
        [
          {
            text: '📄 Télécharger Z',
            onPress: async () => {
              try {
                const uri = await cashSessionService.downloadZReportPdf(closed.id);
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Rapport ${closed.zNumber ?? 'Z'}`,
                    UTI: 'com.adobe.pdf'
                  });
                }
              } catch (e: any) {
                Alert.alert('Erreur', e?.message ?? 'Téléchargement impossible');
              }
            }
          },
          {
            text: '📚 Historique',
            onPress: () => router.push('/(epicier)/cash-reports' as any)
          },
          { text: 'OK' }
        ]
      );
      setSession(null);
      setXReport(null);
      setMode('open-form');
      setCountedCash('');
      setVarianceNote('');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Clôture impossible');
    } finally {
      setClosing(false);
    }
  };

  // ── Rendus ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Caisse</Text>
        <CaisseSelector onChange={() => { setMode('loading'); refresh(); }} />
        {mode === 'live' && session && (
          <View style={styles.openBadge}>
            <View style={styles.openDot} />
            <Text style={styles.openBadgeText}>OUVERTE</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >

        {mode === 'loading' && (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        )}

        {/* ── Formulaire d'ouverture ── */}
        {mode === 'open-form' && (
          <View>
            <Text style={styles.bigTitle}>Ouvrir la caisse</Text>
            <Text style={styles.subtitle}>
              Saisissez le fond de caisse présent dans le tiroir avant la première vente.
            </Text>

            <TouchableOpacity
              style={styles.historyLink}
              onPress={() => router.push('/(epicier)/cash-reports' as any)}
            >
              <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
              <Text style={styles.historyLinkText}>Consulter l'historique des rapports Z</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>

            <Text style={styles.label}>Fond de caisse (DH)</Text>
            <TextInput
              style={styles.input}
              value={openingFloat}
              onChangeText={setOpeningFloat}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#bbb"
            />

            <Text style={styles.label}>Notes (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={openNotes}
              onChangeText={setOpenNotes}
              placeholder="Ex. équipe matin / billet 200 inclus"
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, opening && { opacity: 0.6 }]}
              onPress={submitOpen}
              disabled={opening}
            >
              {opening
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>🔓 Ouvrir la caisse</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Dashboard live (X report) ── */}
        {mode === 'live' && session && (
          <View>
            <Text style={styles.bigTitle}>Rapport X (temps réel)</Text>
            <Text style={styles.subtitle}>
              Caisse ouverte depuis {new Date(session.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              Fond : {session.openingFloat.toFixed(2)} DH
            </Text>

            {xReport ? (
              <>
                {/* KPI grid */}
                <View style={styles.kpiGrid}>
                  <KpiCard label="Ventes" value={`${xReport.totalSales.toFixed(2)} DH`} color={Colors.primary} sub={`${xReport.orderCount} ticket(s)`} />
                  <KpiCard label="Cash encaissé" value={`${xReport.totalCash.toFixed(2)} DH`} color="#2e7d32" />
                  <KpiCard label="Carte" value={`${xReport.totalCard.toFixed(2)} DH`} color="#1976D2" />
                  <KpiCard label="Compte client" value={`${xReport.totalAccount.toFixed(2)} DH`} color="#7B1FA2" />
                </View>

                {/* Cash théorique */}
                <View style={styles.expectedCard}>
                  <Text style={styles.expectedLabel}>💰 Cash théorique au tiroir</Text>
                  <Text style={styles.expectedValue}>{xReport.expectedCash.toFixed(2)} DH</Text>
                  <Text style={styles.expectedSub}>
                    Fond ({session.openingFloat.toFixed(2)}) + cash encaissé ({xReport.totalCash.toFixed(2)})
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.expectedCard}>
                <Text style={styles.expectedLabel}>Session ouverte</Text>
                <Text style={styles.expectedSub}>Rapport X indisponible — tirez pour rafraîchir</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#e53935' }]}
              onPress={beginClose}
            >
              <Text style={styles.primaryBtnText}>🔒 Clôturer la caisse (Z report)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.primary }]}
              onPress={() => router.push('/(epicier)/cash-reports' as any)}
            >
              <Text style={[styles.primaryBtnText, { color: Colors.primary }]}>📚 Historique des Z</Text>
            </TouchableOpacity>

            <Text style={styles.hintText}>
              Tirer dans la liste pour rafraîchir les totaux.
            </Text>
          </View>
        )}

        {/* ── Formulaire de clôture ── */}
        {mode === 'close-form' && session && (
          <View>
            <Text style={styles.bigTitle}>Clôture de caisse</Text>
            <Text style={styles.subtitle}>
              Comptez le cash physique et saisissez le total.
            </Text>

            <Text style={styles.label}>Cash compté (DH)</Text>
            <TextInput
              style={[styles.input, styles.inputLarge]}
              value={countedCash}
              onChangeText={setCountedCash}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#bbb"
            />

            {/* Carte comparative Theorique / Compte / Ecart avec code couleur.
                Plus rapide a interpreter qu'une seule ligne d'ecart : l'epicier
                voit en un coup d'oeil si la caisse est equilibree ou pas. */}
            {xReport && (() => {
              const expected = xReport.expectedCash;
              const hasCount = countedCash !== '';
              const counted = parseFloat(countedCash.replace(',', '.')) || 0;
              const variance = hasCount ? counted - expected : 0;
              const absVar = Math.abs(variance);
              // Seuils en DH : 0 = parfait, <=5 = leger, >5 = significatif.
              // Adaptable plus tard via parametres epicerie si besoin.
              const status: 'balanced' | 'minor' | 'major' =
                !hasCount || absVar < 0.01 ? 'balanced' :
                absVar <= 5 ? 'minor' :
                'major';
              const palette = {
                balanced: { bg: '#e8f5e9', border: '#4caf50', text: '#1b5e20', label: '✓ Caisse equilibrée' },
                minor:    { bg: '#fff3e0', border: '#fb8c00', text: '#e65100', label: '⚠ Léger écart' },
                major:    { bg: '#ffebee', border: '#e53935', text: '#b71c1c', label: '⛔ Gros écart — vérifiez' },
              }[status];
              return (
                <View style={[varStyles.card, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <View style={varStyles.row}>
                    <View style={varStyles.col}>
                      <Text style={varStyles.colLabel}>Théorique</Text>
                      <Text style={varStyles.colValue}>{expected.toFixed(2)} DH</Text>
                    </View>
                    <View style={varStyles.sep} />
                    <View style={varStyles.col}>
                      <Text style={varStyles.colLabel}>Compté</Text>
                      <Text style={varStyles.colValue}>
                        {hasCount ? counted.toFixed(2) + ' DH' : '—'}
                      </Text>
                    </View>
                    <View style={varStyles.sep} />
                    <View style={varStyles.col}>
                      <Text style={varStyles.colLabel}>Écart</Text>
                      <Text style={[varStyles.colValue, { color: palette.text }]}>
                        {hasCount ? (variance >= 0 ? '+' : '') + variance.toFixed(2) + ' DH' : '—'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[varStyles.statusBadge, { color: palette.text }]}>
                    {palette.label}
                  </Text>
                </View>
              );
            })()}

            <Text style={styles.label}>Justification écart (obligatoire si ≠ 0)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={varianceNote}
              onChangeText={setVarianceNote}
              placeholder="Ex. billet froissé, avance remise, perte justifiée…"
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={3}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, backgroundColor: '#9e9e9e' }]}
                onPress={() => setMode('live')}
                disabled={closing}
              >
                <Text style={styles.primaryBtnText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 2, backgroundColor: '#2e7d32' }, closing && { opacity: 0.6 }]}
                onPress={submitClose}
                disabled={closing}
              >
                {closing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Confirmer la clôture</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const KpiCard: React.FC<{ label: string; value: string; color: string; sub?: string }> =
  ({ label, value, color, sub }) => (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  iconBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },

  openBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#e8f5e9', borderRadius: 12
  },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2e7d32' },
  openBadgeText: { fontSize: 11, fontWeight: '800', color: '#2e7d32' },

  centered: { padding: 40, alignItems: 'center' },

  bigTitle: { fontSize: 22, fontWeight: '800', color: '#333', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#777', marginBottom: 20 },

  label: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#333'
  },
  inputLarge: { fontSize: 20, fontWeight: '800', textAlign: 'center', paddingVertical: 16 },
  textarea: { height: 70, paddingTop: 10, textAlignVertical: 'top' },

  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 20
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  hintText: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: '#eee'
  },
  kpiLabel: { fontSize: 11, color: '#777', textTransform: 'uppercase', fontWeight: '700' },
  kpiValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  kpiSub: { fontSize: 11, color: '#999', marginTop: 2 },

  expectedCard: {
    backgroundColor: '#e3f2fd', borderRadius: 12, padding: 16, marginBottom: 14,
    alignItems: 'center'
  },
  expectedLabel: { fontSize: 13, color: '#1976D2', fontWeight: '700' },
  expectedValue: { fontSize: 28, fontWeight: '900', color: '#0d47a1', marginVertical: 4 },
  expectedSub: { fontSize: 11, color: '#1976D2' },

  theoreticalBox: {
    backgroundColor: '#e3f2fd', borderRadius: 10,
    padding: 14, alignItems: 'center', marginBottom: 10
  },
  theoreticalLabel: { fontSize: 12, color: '#1976D2', fontWeight: '700' },
  theoreticalValue: { fontSize: 24, fontWeight: '900', color: '#0d47a1', marginTop: 4 },

  varianceLabel: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 10 },

  historyLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, marginBottom: 16,
    backgroundColor: '#e3f2fd', borderRadius: 10,
    borderWidth: 1, borderColor: '#bbdefb'
  },
  historyLinkText: {
    flex: 1, color: '#1976D2', fontWeight: '700', fontSize: 13
  }
});

// Carte comparative Theorique / Compte / Ecart pour la cloture caisse.
const varStyles = StyleSheet.create({
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  colValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  sep: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
  },
  statusBadge: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
});
