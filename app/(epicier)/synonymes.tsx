/**
 * Écran de gestion des synonymes de recherche pour l'épicier.
 *
 * Permet de lister/ajouter/modifier/supprimer les synonymes darija/arabe/fr
 * qui sont utilisés par la recherche classique, le chatbot mobile et la
 * commande WhatsApp. Chaque synonyme est propre à l'épicerie courante.
 */

import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '@/src/constants/colors';
import {
  SYNONYM_LANGUAGES,
  Synonym,
  SynonymLanguage,
  SynonymLanguageMeta,
  SynonymRequest,
  getSynonymLanguageMeta,
  synonymService,
} from '@/src/services/synonymService';
import { authService } from '@/src/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type LangFilter = SynonymLanguage | 'all';

export default function SynonymesScreen() {
  const router = useRouter();

  const [synonyms, setSynonyms] = useState<Synonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState<LangFilter>('all');

  // Edit/create modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Synonym | null>(null);
  const [form, setForm] = useState<SynonymRequest>({
    term: '',
    canonical: '',
    language: 'ary',
  });
  const [saving, setSaving] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const user = await authService.getCurrentUser();
        if (!user?.epicerieId) {
          Toast.show({ type: 'error', text1: 'Erreur', text2: 'Épicerie introuvable.' });
          setLoading(false);
          return;
        }
        setEpicerieId(user.epicerieId);
        await load(user.epicerieId);
      })();
    }, [])
  );

  const load = async (id: number) => {
    try {
      setLoading(true);
      const list = await synonymService.list(id);
      setSynonyms(list);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Chargement impossible',
        text2: err?.response?.data?.message ?? 'Réessayez dans un instant.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return synonyms
      .filter((s) => langFilter === 'all' || s.language === langFilter)
      .filter(
        (s) =>
          !q ||
          s.term.toLowerCase().includes(q) ||
          s.canonical.toLowerCase().includes(q)
      );
  }, [synonyms, search, langFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: synonyms.length };
    for (const meta of SYNONYM_LANGUAGES) {
      map[meta.code] = synonyms.filter((s) => s.language === meta.code).length;
    }
    return map;
  }, [synonyms]);

  // ── Actions ───────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ term: '', canonical: '', language: langFilter === 'all' ? 'ary' : (langFilter as SynonymLanguage) });
    setModalVisible(true);
  };

  const openEdit = (s: Synonym) => {
    setEditing(s);
    setForm({ term: s.term, canonical: s.canonical, language: s.language });
    setModalVisible(true);
  };

  const save = async () => {
    if (!epicerieId) return;
    if (!form.term.trim() || !form.canonical.trim()) {
      Toast.show({ type: 'error', text1: 'Champs requis', text2: 'Remplissez le terme et le canonique.' });
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await synonymService.update(epicerieId, editing.id, form);
        Toast.show({ type: 'success', text1: 'Mis à jour' });
      } else {
        await synonymService.create(epicerieId, form);
        Toast.show({ type: 'success', text1: 'Synonyme créé' });
      }
      setModalVisible(false);
      await load(epicerieId);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message ?? 'Une erreur est survenue.';
      Toast.show({
        type: 'error',
        text1: status === 409 ? 'Doublon' : 'Échec',
        text2: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (s: Synonym) => {
    Alert.alert(
      'Supprimer le synonyme',
      `Voulez-vous vraiment supprimer "${s.term}" → "${s.canonical}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!epicerieId) return;
            try {
              await synonymService.delete(epicerieId, s.id);
              Toast.show({ type: 'success', text1: 'Supprimé' });
              await load(epicerieId);
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Échec',
                text2: err?.response?.data?.message ?? 'Réessayez.',
              });
            }
          },
        },
      ]
    );
  };

  const confirmRestore = () => {
    Alert.alert(
      'Restaurer les défauts',
      'Ré-insérer les synonymes par défaut manquants ? Vos ajouts personnels ne seront pas touchés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Restaurer',
          onPress: async () => {
            if (!epicerieId) return;
            try {
              const res = await synonymService.restoreDefaults(epicerieId);
              Toast.show({ type: 'success', text1: 'Défauts restaurés', text2: res.message });
              await load(epicerieId);
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Échec',
                text2: err?.response?.data?.message ?? 'Réessayez.',
              });
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────
  const renderLangChip = (meta: SynonymLanguageMeta | { code: 'all'; flag: string; label: string; color: string }) => {
    const isActive = langFilter === meta.code;
    const count = counts[meta.code] ?? 0;
    return (
      <TouchableOpacity
        key={meta.code}
        onPress={() => setLangFilter(meta.code as LangFilter)}
        style={[
          styles.chip,
          isActive && { backgroundColor: meta.color, borderColor: meta.color },
        ]}
        activeOpacity={0.7}
      >
        <Text style={styles.chipFlag}>{meta.flag}</Text>
        <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
          {meta.label}
        </Text>
        <View style={[styles.chipCount, isActive && styles.chipCountActive]}>
          <Text style={[styles.chipCountText, isActive && styles.chipCountTextActive]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>Synonymes</Text>
          <Text style={styles.headerSubtitle}>Darija → produits</Text>
        </View>
        <TouchableOpacity onPress={confirmRestore} style={styles.restoreBtn} hitSlop={8}>
          <Ionicons name="refresh" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Intro card */}
      <View style={styles.introCard}>
        <Ionicons name="language" size={22} color={Colors.primary} />
        <Text style={styles.introText}>
          Permettez à vos clients de trouver vos produits en tapant{' '}
          <Text style={styles.introHighlight}>"zit"</Text> ou{' '}
          <Text style={styles.introHighlight}>"matisha"</Text>.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un terme ou un canonique…"
          placeholderTextColor={Colors.textTertiary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Language chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {renderLangChip({ code: 'all', flag: '🌐', label: 'Tous', color: Colors.primary })}
        {SYNONYM_LANGUAGES.map((l) => renderLangChip(l))}
      </ScrollView>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="file-tray-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>
            {synonyms.length === 0 ? 'Aucun synonyme' : 'Aucun résultat'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {synonyms.length === 0
              ? 'Ajoutez votre premier synonyme avec le bouton +'
              : 'Essayez un autre filtre ou une autre recherche.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((s) => {
            const meta = getSynonymLanguageMeta(s.language);
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.row}
                onPress={() => openEdit(s)}
                activeOpacity={0.7}
              >
                <View style={[styles.langBadge, { backgroundColor: meta.color }]}>
                  <Text style={styles.langBadgeText}>{meta.labelShort}</Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowLine}>
                    <Text style={styles.term}>{s.term}</Text>
                    <Ionicons name="arrow-forward" size={16} color={Colors.textTertiary} />
                    <Text style={styles.canonical}>{s.canonical}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmDelete(s);
                  }}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Edit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editing ? 'Modifier le synonyme' : 'Nouveau synonyme'}
            </Text>

            <Text style={styles.fieldLabel}>Terme tapé par le client</Text>
            <TextInput
              style={styles.input}
              value={form.term}
              onChangeText={(v) => setForm({ ...form, term: v })}
              placeholder="ex: zit, matisha, خبز"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Canonique (ce qu'on cherche)</Text>
            <TextInput
              style={styles.input}
              value={form.canonical}
              onChangeText={(v) => setForm({ ...form, canonical: v })}
              placeholder="ex: huile, tomate, pain"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Langue</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.langPickerRow}
            >
              {SYNONYM_LANGUAGES.map((l) => {
                const active = form.language === l.code;
                return (
                  <TouchableOpacity
                    key={l.code}
                    style={[
                      styles.langPick,
                      active && { backgroundColor: l.color, borderColor: l.color },
                    ]}
                    onPress={() => setForm({ ...form, language: l.code })}
                  >
                    <Text style={styles.chipFlag}>{l.flag}</Text>
                    <Text style={[styles.langPickText, active && { color: '#fff' }]}>
                      {l.labelShort}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {form.term.length > 0 && form.canonical.length > 0 && (
              <View style={styles.preview}>
                <Text style={styles.previewLabel}>Aperçu</Text>
                <View style={styles.previewBody}>
                  <Text style={styles.previewTerm}>{form.term}</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                  <Text style={styles.previewCanonical}>{form.canonical}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>
                    {editing ? 'Enregistrer' : 'Ajouter'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTextBox: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  restoreBtn: {
    padding: Spacing.xs,
  },

  // Intro card
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  introText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  introHighlight: {
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.text,
    paddingVertical: 0,
  },

  // Chips
  chipsRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    gap: 6,
  },
  chipFlag: {
    fontSize: 15,
  },
  chipLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  chipLabelActive: {
    color: '#fff',
  },
  chipCount: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  chipCountTextActive: {
    color: '#fff',
  },

  // List
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  langBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FontWeights.bold,
  },
  rowBody: {
    flex: 1,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  term: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  canonical: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  deleteBtn: {
    padding: Spacing.xs,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg + 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSizes.base,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  langPickerRow: {
    gap: 8,
    paddingVertical: 4,
  },
  langPick: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
    gap: 5,
  },
  langPickText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  preview: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  previewTerm: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewCanonical: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnGhostText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
  },
});
