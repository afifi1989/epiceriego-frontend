/**
 * Écran Paramètres Imprimante — Axe POS / S5.
 *
 * Configure :
 *   - Backend (SYSTEM_SHARE, BLUETOOTH — bientôt, NONE)
 *   - Largeur papier (58 / 80 mm)
 *   - Auto-print après vente
 *   - Test d'impression avec une commande réelle (optionnel)
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  PaperWidth,
  PrinterBackend,
  PrinterSettings,
  printerSettingsService,
  receiptPrinterService
} from '../../src/services/receiptPrinterService';

const BACKEND_OPTIONS: { value: PrinterBackend; label: string; description: string; available: boolean }[] = [
  {
    value: 'SYSTEM_SHARE',
    label: '📤 Partage système',
    description: 'Ticket PDF → partage (WhatsApp, Mail, AirPrint, Android Print)',
    available: true
  },
  {
    value: 'BLUETOOTH',
    label: '🖨️ Imprimante Bluetooth ESC/POS',
    description: 'Imprimante ticket 58/80mm connectée en Bluetooth — bientôt',
    available: false
  },
  {
    value: 'NONE',
    label: '🚫 Désactivé',
    description: 'Aucune impression — reçu par email uniquement',
    available: true
  }
];

export default function PrinterSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOrderId, setTestOrderId] = useState('');

  useEffect(() => {
    printerSettingsService.load().then(setSettings);
  }, []);

  const update = async (patch: Partial<PrinterSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await printerSettingsService.save(patch);
      setSettings(next);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const id = parseInt(testOrderId.trim(), 10);
    if (!id || isNaN(id)) {
      Alert.alert('Erreur', 'Saisis un numéro de commande valide (ex. 42)');
      return;
    }
    setTesting(true);
    try {
      await receiptPrinterService.testPrint(id);
    } catch (e: any) {
      Alert.alert('Test échoué', e?.message ?? 'Impossible d\'imprimer');
    } finally {
      setTesting(false);
    }
  };

  if (!settings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Imprimante</Text>
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color="#2196F3" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres imprimante</Text>
        {saving && <ActivityIndicator size="small" color="#2196F3" />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

        {/* Backend */}
        <Text style={styles.sectionTitle}>Type d'impression</Text>
        {BACKEND_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.backendCard,
              settings.backend === opt.value && styles.backendCardActive,
              !opt.available && styles.backendCardDisabled
            ]}
            disabled={!opt.available}
            onPress={() => update({ backend: opt.value })}
          >
            <View style={{ flex: 1 }}>
              <Text style={[
                styles.backendLabel,
                settings.backend === opt.value && { color: '#2196F3' }
              ]}>{opt.label}</Text>
              <Text style={styles.backendDesc}>{opt.description}</Text>
              {!opt.available && (
                <Text style={styles.comingSoon}>Prochainement</Text>
              )}
            </View>
            {settings.backend === opt.value && (
              <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
            )}
          </TouchableOpacity>
        ))}

        {/* Largeur papier */}
        {settings.backend !== 'NONE' && (
          <>
            <Text style={styles.sectionTitle}>Largeur du papier</Text>
            <View style={styles.paperRow}>
              {([58, 80] as PaperWidth[]).map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.paperBtn, settings.paperWidth === w && styles.paperBtnActive]}
                  onPress={() => update({ paperWidth: w })}
                >
                  <Text style={[
                    styles.paperText,
                    settings.paperWidth === w && { color: '#2196F3', fontWeight: '800' }
                  ]}>{w} mm</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              58mm = imprimante caisse standard. 80mm = imprimante restauration / desktop.
            </Text>
          </>
        )}

        {/* Auto-print */}
        {settings.backend !== 'NONE' && (
          <>
            <Text style={styles.sectionTitle}>Impression automatique</Text>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Après chaque vente</Text>
                <Text style={styles.toggleSub}>
                  Imprime ou partage le ticket automatiquement dès la validation.
                </Text>
              </View>
              <Switch
                value={settings.autoPrint}
                onValueChange={v => update({ autoPrint: v })}
                trackColor={{ false: '#ccc', true: '#81c784' }}
                thumbColor={settings.autoPrint ? '#2e7d32' : '#fff'}
              />
            </View>
          </>
        )}

        {/* Test */}
        {settings.backend !== 'NONE' && (
          <>
            <Text style={styles.sectionTitle}>Test d'impression</Text>
            <Text style={styles.hint}>
              Saisissez le numéro d'une commande existante pour tester.
            </Text>
            <View style={styles.testRow}>
              <TextInput
                style={styles.testInput}
                value={testOrderId}
                onChangeText={setTestOrderId}
                placeholder="Ex. 42"
                placeholderTextColor="#bbb"
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.testBtn, (testing || !testOrderId) && { opacity: 0.5 }]}
                onPress={test}
                disabled={testing || !testOrderId}
              >
                {testing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.testBtnText}>🖨️ Tester</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Info Bluetooth */}
        {settings.backend === 'BLUETOOTH' && (
          <View style={styles.btInfo}>
            <Ionicons name="information-circle" size={18} color="#1976D2" />
            <Text style={styles.btInfoText}>
              L'impression Bluetooth nécessite un module natif qui sera ajouté dans
              une prochaine mise à jour. En attendant, utilisez "Partage système".
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#666',
    textTransform: 'uppercase', marginTop: 18, marginBottom: 10
  },

  backendCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: '#e0e0e0'
  },
  backendCardActive: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  backendCardDisabled: { opacity: 0.55 },
  backendLabel: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 3 },
  backendDesc: { fontSize: 12, color: '#777' },
  comingSoon: {
    fontSize: 11, fontWeight: '800', color: '#fb8c00', marginTop: 4,
    textTransform: 'uppercase'
  },

  paperRow: { flexDirection: 'row', gap: 10 },
  paperBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fff',
    alignItems: 'center'
  },
  paperBtnActive: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  paperText: { fontSize: 15, fontWeight: '600', color: '#555' },

  hint: { fontSize: 12, color: '#999', marginTop: 6, fontStyle: 'italic' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#eee'
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  toggleSub: { fontSize: 12, color: '#777', marginTop: 3 },

  testRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  testInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#333'
  },
  testBtn: {
    backgroundColor: '#2196F3', borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 13
  },
  testBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  btInfo: {
    flexDirection: 'row', gap: 8, marginTop: 14,
    padding: 12, borderRadius: 10, backgroundColor: '#e3f2fd'
  },
  btInfoText: { flex: 1, fontSize: 12, color: '#1976D2', lineHeight: 17 }
});
