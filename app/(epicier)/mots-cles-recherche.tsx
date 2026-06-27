export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Mots-clés de recherche (synonymes) — épicier mobile.
 *
 * <p>Permet à l'épicier de personnaliser le mapping {@code term → canonical}
 * utilisé par la recherche produits darija/arabe. Les synonymes par défaut
 * (zit→huile, matisha→tomate, etc.) sont seedés à l'onboarding et listés
 * ici comme entrées normales — l'épicier peut les modifier ou les
 * supprimer, et utiliser "Restaurer défauts" pour les ré-installer.
 *
 * <p>Toute mutation invalide le cache local du POS via le service, donc le
 * prochain affichage de vente-directe applique la nouvelle map sans
 * attendre le TTL.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  synonymsService,
  SearchSynonym,
  SynonymRequest,
} from '../../src/services/synonymsService';

const LANG_LABEL: Record<string, string> = {
  ary: 'Darija',
  ar:  'Arabe',
  fr:  'Français',
  en:  'Anglais',
  tz:  'Tamazight',
  rif: 'Tarifit',
  shi: 'Tachelhit',
};

const LANGUAGE_OPTIONS = [
  { value: 'ary', label: 'Darija (latin)' },
  { value: 'ar',  label: 'Arabe' },
  { value: 'fr',  label: 'Français' },
  { value: 'en',  label: 'Anglais' },
  { value: 'tz',  label: 'Tamazight' },
  { value: 'rif', label: 'Tarifit (Rif)' },
  { value: 'shi', label: 'Tachelhit (Souss)' },
];

export default function MotsClesRechercheScreen() {
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [items, setItems] = useState<SearchSynonym[]>([]);
  const [suggestions, setSuggestions] = useState<SynonymRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/edit form state
  const [editing, setEditing] = useState<SearchSynonym | 'new' | null>(null);
  const [formTerm, setFormTerm] = useState('');
  const [formCanonical, setFormCanonical] = useState('');
  const [formLanguage, setFormLanguage] = useState<string>('ary');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const userJson = await AsyncStorage.getItem('@abridgo_user');
      if (userJson) {
        try {
          const u = JSON.parse(userJson);
          if (u?.epicerieId) setEpicerieId(u.epicerieId);
        } catch {/* ignore */}
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!epicerieId) return;
    setLoading(true);
    try {
      // Parallel fetch — list and suggestions are independent.
      const [data, missing] = await Promise.all([
        synonymsService.list(epicerieId),
        synonymsService.listMissingDefaults(epicerieId).catch(() => []),
      ]);
      setItems(data);
      setSuggestions(missing);
    } catch (e: any) {
      Alert.alert('Chargement impossible', e?.message || '');
    } finally {
      setLoading(false);
    }
  }, [epicerieId]);

  /** Accept one suggestion: create the synonym, then drop it from the
   *  suggestions list optimistically. */
  const acceptSuggestion = async (s: SynonymRequest) => {
    if (!epicerieId) return;
    try {
      await synonymsService.create(epicerieId, s);
      setSuggestions(prev => prev.filter(x => x.term !== s.term || x.language !== s.language));
      // Reload to surface the new entry in the main list.
      const data = await synonymsService.list(epicerieId);
      setItems(data);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || e?.message || 'Échec');
    }
  };

  useEffect(() => {
    if (epicerieId) load();
  }, [epicerieId, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(s =>
      s.term.toLowerCase().includes(q) ||
      s.canonical.toLowerCase().includes(q));
  }, [items, search]);

  // ── Form ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing('new');
    setFormTerm(''); setFormCanonical(''); setFormLanguage('ary');
  };
  const openEdit = (s: SearchSynonym) => {
    setEditing(s);
    setFormTerm(s.term); setFormCanonical(s.canonical); setFormLanguage(s.language);
  };
  const closeForm = () => { if (!submitting) setEditing(null); };

  const submitForm = async () => {
    if (!epicerieId || !editing) return;
    if (!formTerm.trim() || !formCanonical.trim()) {
      Alert.alert('Champs requis', 'Saisissez le mot tapé et le mot canonique.');
      return;
    }
    setSubmitting(true);
    const request: SynonymRequest = {
      term: formTerm.trim(),
      canonical: formCanonical.trim(),
      language: formLanguage,
    };
    try {
      if (editing === 'new') {
        await synonymsService.create(epicerieId, request);
      } else {
        await synonymsService.update(epicerieId, editing.id, request);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || e?.message || 'Échec');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = (s: SearchSynonym) => {
    Alert.alert(
      'Supprimer le synonyme ?',
      `${s.term} → ${s.canonical}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            if (!epicerieId) return;
            try {
              await synonymsService.remove(epicerieId, s.id);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || '');
            }
          },
        },
      ]
    );
  };

  const restoreDefaults = () => {
    if (!epicerieId) return;
    Alert.alert(
      'Restaurer les défauts ?',
      'Réinstalle uniquement les synonymes par défaut manquants. Vos synonymes personnels ne sont pas touchés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Restaurer',
          onPress: async () => {
            try {
              const r = await synonymsService.restoreDefaults(epicerieId);
              Alert.alert('OK', r.message);
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || '');
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔤 Mots-clés de recherche</Text>
        <Text style={styles.subtitle}>
          Quand un client tape "zit", la recherche trouve "huile". Personnalisez les mappings selon votre clientèle.
        </Text>
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un mot…"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        ListHeaderComponent={
          suggestions.length > 0 ? (
            <View style={styles.suggestionsBlock}>
              <Text style={styles.suggestionsTitle}>
                💡 Suggestions ({suggestions.length})
              </Text>
              <Text style={styles.suggestionsSubtitle}>
                Synonymes par défaut non installés. Ajoutez ceux qui correspondent à votre clientèle.
              </Text>
              {suggestions.slice(0, 6).map((s, idx) => (
                <View key={`${s.term}-${s.language ?? 'fr'}-${idx}`} style={styles.suggestionRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.termRow}>
                      <Text style={styles.term}>{s.term}</Text>
                      <Text style={styles.arrow}>→</Text>
                      <Text style={styles.canonical}>{s.canonical}</Text>
                      <View style={styles.langBadge}>
                        <Text style={styles.langBadgeText}>
                          {LANG_LABEL[s.language ?? 'ary'] ?? s.language}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => acceptSuggestion(s)}
                  >
                    <Text style={styles.acceptBtnText}>+ Ajouter</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {suggestions.length > 6 && (
                <Text style={styles.suggestionsMore}>
                  + {suggestions.length - 6} autres — utilisez "Restaurer défauts" pour tout réinstaller en bloc
                </Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>Aucun synonyme</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <View style={styles.termRow}>
                <Text style={styles.term}>{item.term}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.canonical}>{item.canonical}</Text>
                <View style={styles.langBadge}>
                  <Text style={styles.langBadgeText}>{item.language}</Text>
                </View>
              </View>
            </View>
            <View style={styles.rowActions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmRemove(item)} style={styles.iconBtn}>
                <Text style={[styles.iconBtnText, { color: '#D32F2F' }]}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.restoreBtn} onPress={restoreDefaults}>
        <Text style={styles.restoreBtnText}>↻ Restaurer les défauts</Text>
      </TouchableOpacity>

      {/* Add/edit modal */}
      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeForm}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing === 'new' ? 'Nouveau synonyme' : 'Modifier le synonyme'}
            </Text>

            <Text style={styles.modalLabel}>Mot tapé par le client</Text>
            <TextInput
              style={styles.modalInput}
              value={formTerm}
              onChangeText={setFormTerm}
              placeholder="ex : zit, matisha, زيت"
              placeholderTextColor="#bbb"
              autoFocus
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>Mot canonique (cherché en base)</Text>
            <TextInput
              style={styles.modalInput}
              value={formCanonical}
              onChangeText={setFormCanonical}
              placeholder="ex : huile, tomate"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>Langue d'origine</Text>
            <View style={styles.langOptions}>
              {LANGUAGE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.langOpt, formLanguage === opt.value && styles.langOptActive]}
                  onPress={() => setFormLanguage(opt.value)}
                >
                  <Text style={[
                    styles.langOptText,
                    formLanguage === opt.value && styles.langOptTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={closeForm} disabled={submitting}>
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, submitting && { opacity: 0.6 }]}
                onPress={submitForm}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalBtnConfirmText}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: 16, paddingBottom: 8, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#222' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 6, lineHeight: 18 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#222',
  },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  rowMain: { flex: 1 },
  termRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  term: { fontSize: 14, fontWeight: '700', color: '#1976D2' },
  arrow: { color: '#999', fontSize: 14 },
  canonical: { fontSize: 14, color: '#222', fontWeight: '500' },
  langBadge: {
    backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginLeft: 4,
  },
  langBadgeText: { fontSize: 10, color: '#1976D2', fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  iconBtnText: { fontSize: 16, color: '#666' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888' },

  // Suggestions block — amber tint to distinguish from the user's own list
  suggestionsBlock: {
    backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082',
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  suggestionsTitle: { fontSize: 14, fontWeight: '700', color: '#5D4037', marginBottom: 4 },
  suggestionsSubtitle: { fontSize: 12, color: '#6D4C41', marginBottom: 10, lineHeight: 16 },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: '#FFE082',
  },
  acceptBtn: {
    backgroundColor: '#FFB300', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  suggestionsMore: {
    fontSize: 11, color: '#6D4C41', fontStyle: 'italic', marginTop: 4, textAlign: 'center',
  },

  restoreBtn: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#FFB300',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  restoreBtnText: { color: '#B26A00', fontWeight: '700', fontSize: 13 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: '#222', backgroundColor: '#fafafa',
  },
  langOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  langOpt: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fafafa',
  },
  langOptActive: { borderColor: Colors.primary, backgroundColor: '#E3F2FD' },
  langOptText: { fontSize: 12, color: '#666' },
  langOptTextActive: { color: '#1976D2', fontWeight: '700' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#f0f0f0' },
  modalBtnCancelText: { color: '#333', fontWeight: '600' },
  modalBtnConfirm: { backgroundColor: Colors.primary },
  modalBtnConfirmText: { color: '#fff', fontWeight: '700' },
});
