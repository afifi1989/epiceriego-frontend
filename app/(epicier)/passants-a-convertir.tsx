export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Passants à convertir — épicier mobile
 *
 * Liste les emails de clients de passage qui reviennent (≥ 3 ventes par
 * défaut) et permet de les promouvoir en clients virtuels en un clic.
 *
 * Le backend (POST /epiceries/{id}/walk-in-conversions) crée le client
 * virtuel ET re-attribue les commandes passées : le carnet du nouveau
 * client commence complet, et le bucket "Ventes passantes" du dashboard
 * baisse d'autant.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  walkInConversionService,
  WalkInConversionSuggestion,
} from '../../src/services/walkInConversionService';
import { useLanguage } from '../../src/context/LanguageContext';
import { tFmt } from '../../src/services/chatbotService';

export default function PassantsAConvertirScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<WalkInConversionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Convert dialog state
  const [editing, setEditing] = useState<WalkInConversionSuggestion | null>(null);
  const [convertName, setConvertName] = useState('');
  const [convertPhone, setConvertPhone] = useState('');
  const [converting, setConverting] = useState(false);

  // ── Load épicerie id once (same pattern as clients-list) ─────────────
  useEffect(() => {
    (async () => {
      const userJson = await AsyncStorage.getItem('@abridgo_user');
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          if (user?.epicerieId) setEpicerieId(user.epicerieId);
        } catch {/* swallow */}
      }
    })();
  }, []);

  const loadSuggestions = useCallback(async () => {
    if (!epicerieId) return;
    try {
      const data = await walkInConversionService.getSuggestions(epicerieId);
      setSuggestions(data);
    } catch (e) {
      console.error('[passants] load failed', e);
      Alert.alert(t('walkInConversion.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [epicerieId, t]);

  // Reload on focus so a sale that just happened in another screen surfaces
  // the new candidate quickly without manual refresh.
  useFocusEffect(
    useCallback(() => {
      if (epicerieId) {
        setLoading(true);
        loadSuggestions();
      }
    }, [epicerieId, loadSuggestions]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSuggestions();
  }, [loadSuggestions]);

  // ── Convert flow ────────────────────────────────────────────────────
  const openConvertDialog = (suggestion: WalkInConversionSuggestion) => {
    setEditing(suggestion);
    setConvertName('');
    setConvertPhone('');
  };

  const closeDialog = () => {
    if (converting) return;
    setEditing(null);
  };

  const submitConvert = async () => {
    if (!editing || !epicerieId) return;
    if (!convertName.trim()) {
      Alert.alert(t('walkInConversion.nameLabel'), t('walkInConversion.namePlaceholder'));
      return;
    }
    setConverting(true);
    try {
      const result = await walkInConversionService.convert(epicerieId, {
        receiptEmail: editing.receiptEmail,
        name: convertName.trim(),
        phone: convertPhone.trim() || undefined,
      });
      Alert.alert(
        '',
        tFmt(t, 'walkInConversion.convertSuccess', {
          name: convertName.trim(),
          count: result.ordersTransferred,
        }),
      );
      // Drop the converted entry from the list optimistically — a refetch
      // would also work but feels slower.
      setSuggestions((prev) =>
        prev.filter((s) => s.receiptEmail !== editing.receiptEmail),
      );
      setEditing(null);
    } catch (e: any) {
      Alert.alert(
        t('walkInConversion.convertError'),
        e?.message || '',
      );
    } finally {
      setConverting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🚶</Text>
        <Text style={styles.emptyTitle}>{t('walkInConversion.emptyTitle')}</Text>
        <Text style={styles.emptyDesc}>{t('walkInConversion.emptyDesc')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('walkInConversion.pageTitle')}</Text>
        <Text style={styles.headerSubtitle}>{t('walkInConversion.pageSubtitle')}</Text>
      </View>

      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.receiptEmail}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowAvatar}>
              <Text style={styles.rowAvatarText}>
                {(item.receiptEmail.charAt(0) || '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowEmail} numberOfLines={1}>
                {item.receiptEmail}
              </Text>
              <Text style={styles.rowMeta}>
                {tFmt(t, 'walkInConversion.orderCount', { count: item.orderCount })}
                {' · '}
                {tFmt(t, 'walkInConversion.totalSpent', { total: item.totalSpent.toFixed(2) })}
              </Text>
              <Text style={styles.rowSubMeta}>
                {tFmt(t, 'walkInConversion.lastSeen', { date: formatDate(item.lastSeenAt) })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={() => openConvertDialog(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.convertBtnText}>{t('walkInConversion.convert')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Convert dialog */}
      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeDialog}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('walkInConversion.convertDialogTitle')}</Text>
            <Text style={styles.modalDesc}>{t('walkInConversion.convertDialogDesc')}</Text>

            {editing && (
              <Text style={styles.modalEmail}>{editing.receiptEmail}</Text>
            )}

            <Text style={styles.modalLabel}>{t('walkInConversion.nameLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={convertName}
              onChangeText={setConvertName}
              placeholder={t('walkInConversion.namePlaceholder')}
              placeholderTextColor="#bbb"
              autoFocus
            />

            <Text style={styles.modalLabel}>{t('walkInConversion.phoneLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={convertPhone}
              onChangeText={setConvertPhone}
              placeholder={t('walkInConversion.phonePlaceholder')}
              placeholderTextColor="#bbb"
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={closeDialog}
                disabled={converting}
              >
                <Text style={styles.modalBtnCancelText}>{t('walkInConversion.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, converting && { opacity: 0.6 }]}
                onPress={submitConvert}
                disabled={converting}
              >
                {converting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>{t('walkInConversion.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F5F5F5', paddingHorizontal: 32,
  },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  headerSubtitle: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },

  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#212121', textAlign: 'center', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  rowAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFB300',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  rowAvatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  rowBody: { flex: 1, marginRight: 8 },
  rowEmail: { fontSize: 14, fontWeight: '700', color: '#222' },
  rowMeta: { fontSize: 12, color: '#555', marginTop: 4 },
  rowSubMeta: { fontSize: 11, color: '#999', marginTop: 2 },

  convertBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  convertBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#222' },
  modalDesc: { fontSize: 13, color: '#666', marginTop: 6, marginBottom: 16, lineHeight: 18 },
  modalEmail: {
    backgroundColor: '#FFF8E1',
    color: '#5D4037',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '600',
  },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: '#222', backgroundColor: '#fafafa',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#f0f0f0' },
  modalBtnCancelText: { color: '#333', fontWeight: '600' },
  modalBtnConfirm: { backgroundColor: Colors.primary },
  modalBtnConfirmText: { color: '#fff', fontWeight: '700' },
});
