export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../src/theme';
import { ColorPalette } from '../../src/theme/colors';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';
import {
  Caisse, CreateCaisseRequest, UpdateCaisseRequest, caisseService,
} from '../../src/services/caisseService';
import { useActiveCaisse, setActiveCaisseId } from '../../src/services/activeCaisse';
import { useSubscription } from '../../src/hooks/useSubscription';
import { ProBadgeInline } from '../../src/components/epicier/ProGate';
import { useLanguage } from '../../src/context/LanguageContext';

export default function CaissesScreen() {
  const ready = useRequirePermission('settings:edit');
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const activeCaisseId = useActiveCaisse();
  const { hasFeature } = useSubscription();
  const { t } = useLanguage();

  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modal création / édition
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: '', code: '', notes: '', makeDefault: false, active: true });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await caisseService.list(includeArchived);
      setCaisses(data);
      // Auto-sélection de la caisse par défaut sur ce poste si aucune choisie.
      const current = activeCaisseId;
      if (current == null) {
        const def = data.find(c => c.defaultCaisse && !c.archivedAt) ?? data.find(c => !c.archivedAt);
        if (def) setActiveCaisseId(def.id);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de charger les caisses');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Actions ────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ nom: '', code: '', notes: '', makeDefault: caisses.length === 0, active: true });
    setShowForm(true);
  };

  const openEdit = (c: Caisse) => {
    setEditingId(c.id);
    setForm({ nom: c.nom, code: c.code ?? '', notes: c.notes ?? '', makeDefault: c.defaultCaisse, active: c.active });
    setShowForm(true);
  };

  const submit = async () => {
    const nom = form.nom.trim();
    if (!nom) { Alert.alert('Nom requis', 'Donnez un nom à la caisse.'); return; }
    setSaving(true);
    try {
      if (editingId == null) {
        const req: CreateCaisseRequest = { nom, code: form.code.trim() || null, notes: form.notes.trim() || null, makeDefault: form.makeDefault };
        const created = await caisseService.create(req);
        if (activeCaisseId == null) setActiveCaisseId(created.id);
      } else {
        const req: UpdateCaisseRequest = { nom, code: form.code.trim() || null, notes: form.notes.trim() || null, active: form.active };
        await caisseService.update(editingId, req);
      }
      setShowForm(false);
      load(true);
    } catch (e: any) {
      if (!e?.__subscriptionGateHandled) {
        Alert.alert('Erreur', e?.response?.data?.message || 'Opération impossible');
      }
    } finally {
      setSaving(false);
    }
  };

  const useHere = (c: Caisse) => {
    setActiveCaisseId(c.id);
    Alert.alert('Caisse active', `« ${c.nom} » est utilisée sur ce poste.`);
  };

  const makeDefault = async (c: Caisse) => {
    if (c.defaultCaisse) return;
    try { await caisseService.setDefault(c.id); load(true); }
    catch (e: any) { Alert.alert('Erreur', e?.response?.data?.message || 'Impossible'); }
  };

  const confirmArchive = (c: Caisse) => {
    Alert.alert('Archiver la caisse',
      `Archiver « ${c.nom} » ? Son historique de rapports Z est conservé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver', style: 'destructive',
          onPress: async () => {
            try {
              await caisseService.archive(c.id);
              if (activeCaisseId === c.id) setActiveCaisseId(null);
              load(true);
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Impossible');
            }
          },
        },
      ]);
  };

  // ── Rendu carte ──────────────────────────────────────────────────────────
  const renderItem = ({ item: c }: { item: Caisse }) => {
    const isActiveDevice = c.id === activeCaisseId && !c.archivedAt;
    return (
      <View style={[
        s.card,
        c.defaultCaisse && s.cardDefault,
        isActiveDevice && s.cardActiveDevice,
        !!c.archivedAt && s.cardArchived,
      ]}>
        <View style={s.cardTop}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(c.code || c.nom || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>{c.nom}</Text>
              {!!c.code && <Text style={s.codeChip}>{c.code}</Text>}
            </View>
            <View style={s.badges}>
              {c.defaultCaisse && <Badge colors={colors} bg={colors.infoSubtle} fg={colors.info} icon="star" label="Par défaut" />}
              {isActiveDevice && <Badge colors={colors} bg={colors.infoSubtle} fg={colors.info} icon="desktop-outline" label="Ce poste" />}
              {!!c.archivedAt && <Badge colors={colors} bg={colors.surfaceMuted} fg={colors.textMuted} icon="file-tray-full-outline" label="Archivée" />}
              {!c.archivedAt && !c.active && <Badge colors={colors} bg={colors.warningSubtle} fg={colors.warning} icon="ban-outline" label="Désactivée" />}
            </View>
          </View>
        </View>

        {!!c.notes && <Text style={s.notes}>{c.notes}</Text>}

        {!c.archivedAt && (
          <View style={s.actions}>
            {!isActiveDevice && (
              <TouchableOpacity style={[s.actionBtn, { borderColor: colors.info }]} onPress={() => useHere(c)}>
                <Ionicons name="desktop-outline" size={15} color={colors.info} />
                <Text style={[s.actionTxt, { color: colors.info }]}>Utiliser ici</Text>
              </TouchableOpacity>
            )}
            {canManage && !c.defaultCaisse && (
              <TouchableOpacity style={s.actionGhost} onPress={() => makeDefault(c)}>
                <Ionicons name="star-outline" size={15} color={colors.textSecondary} />
                <Text style={[s.actionTxt, { color: colors.textSecondary }]}>Par défaut</Text>
              </TouchableOpacity>
            )}
            {canManage && (
              <>
                <TouchableOpacity style={s.iconGhost} onPress={() => openEdit(c)}>
                  <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconGhost} onPress={() => confirmArchive(c)}>
                  <Ionicons name="file-tray-full-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  if (!ready) return null;
  const canManage = ready; // écran gaté par settings:edit → l'accès implique la gestion
  const activeCount = caisses.filter(c => !c.archivedAt).length;

  // Multi-caisse (feature PRO) : la 1ʳᵉ caisse est GRATUITE (enforce backend).
  // On ne verrouille QUE la création d'une 2ᵉ caisse et plus — jamais la
  // consultation/gestion de l'existant, ni la première caisse.
  const multiCaisseLocked = !hasFeature('hasMultiCaisse') && activeCount >= 1;

  const onAddCaisse = () => {
    if (multiCaisseLocked) {
      // Redirige vers l'upsell au lieu d'ouvrir le formulaire de création.
      router.push('/(epicier)/mon-abonnement');
      return;
    }
    openCreate();
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Caisses</Text>
          <Text style={s.headerSub}>{activeCount} caisse{activeCount !== 1 ? 's' : ''} active{activeCount !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => { setIncludeArchived(v => !v); }} style={s.iconBtn}>
          <Ionicons name={includeArchived ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={colors.info} />
      ) : (
        <FlatList
          data={caisses}
          keyExtractor={c => String(c.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="wallet-outline" size={46} color={colors.textMuted} />
              <Text style={s.emptyTitle}>Aucune caisse</Text>
              <Text style={s.emptyDesc}>Créez une caisse pour ouvrir des sessions et encaisser.</Text>
            </View>
          }
        />
      )}

      {canManage && multiCaisseLocked && (
        <View style={s.multiHint} pointerEvents="none">
          <Text style={s.multiHintTxt}>{t('caisses.multiCaisseHint')}</Text>
        </View>
      )}

      {canManage && (
        <TouchableOpacity style={[s.fab, { backgroundColor: colors.info }]} onPress={onAddCaisse}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.fabTxt}>Créer</Text>
          {multiCaisseLocked && <ProBadgeInline feature="hasMultiCaisse" />}
        </TouchableOpacity>
      )}

      {/* Modal création / édition */}
      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editingId == null ? 'Nouvelle caisse' : 'Modifier la caisse'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={s.label}>Nom *</Text>
              <TextInput style={s.input} value={form.nom} onChangeText={v => setForm(f => ({ ...f, nom: v }))}
                placeholder="Ex : Caisse principale" placeholderTextColor={colors.textMuted} maxLength={80} />

              <Text style={s.label}>Code (optionnel)</Text>
              <TextInput style={s.input} value={form.code} onChangeText={v => setForm(f => ({ ...f, code: v }))}
                placeholder="Ex : C1" placeholderTextColor={colors.textMuted} maxLength={16} />

              <Text style={s.label}>Notes (optionnel)</Text>
              <TextInput style={[s.input, { height: 64, textAlignVertical: 'top' }]} value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Ex : comptoir entrée…"
                placeholderTextColor={colors.textMuted} multiline />

              {editingId == null ? (
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.switchTitle}>Caisse par défaut</Text>
                    <Text style={s.switchSub}>Utilisée pour les nouvelles sessions.</Text>
                  </View>
                  <Switch value={form.makeDefault} onValueChange={v => setForm(f => ({ ...f, makeDefault: v }))}
                    trackColor={{ true: colors.info }} />
                </View>
              ) : (
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.switchTitle}>Caisse active</Text>
                    <Text style={s.switchSub}>Désactivez pour bloquer l'ouverture de sessions.</Text>
                  </View>
                  <Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))}
                    trackColor={{ true: colors.info }} />
                </View>
              )}

              <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.info }, saving && { opacity: 0.6 }]}
                onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Enregistrer</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Badge({ colors, bg, fg, icon, label }:
  { colors: ColorPalette; bg: string; fg: string; icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Ionicons name={icon} size={11} color={fg} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: fg }}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
  headerSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },

  card: {
    backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: c.border,
  },
  cardDefault: { borderLeftWidth: 3, borderLeftColor: c.info },
  cardActiveDevice: { borderColor: c.info },
  cardArchived: { opacity: 0.6 },

  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.border,
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },
  codeChip: {
    fontSize: 11, fontWeight: '700', color: c.textSecondary,
    backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, overflow: 'hidden',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  notes: { fontSize: 13, color: c.textSecondary, marginTop: 10 },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1,
  },
  actionGhost: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7 },
  iconGhost: { padding: 7, marginLeft: 'auto' },
  actionTxt: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 64, gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary, marginTop: 6 },
  emptyDesc: { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingHorizontal: 40 },

  fab: {
    position: 'absolute', right: 20, bottom: 26,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  multiHint: {
    position: 'absolute', right: 20, bottom: 84,
    maxWidth: '78%',
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  multiHintTxt: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary },

  label: { fontSize: 13, fontWeight: '600', color: c.textPrimary, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.textPrimary,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16,
    backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14,
  },
  switchTitle: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
  switchSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },

  saveBtn: { borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
