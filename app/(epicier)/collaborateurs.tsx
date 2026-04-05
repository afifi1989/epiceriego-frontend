import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView,
  RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';
import {
  Collaborateur, CollaboratorRole, CollaboratorDirectCreateRequest,
  COLLABORATOR_ROLE_CONFIG, COLLABORATOR_STATUS_CONFIG,
} from '../../src/type';
import { collaborateurService } from '../../src/services/collaborateurService';

const ROLES: { value: CollaboratorRole; label: string; desc: string }[] = [
  { value: 'MANAGER',      label: 'Manager',      desc: 'Accès complet (sauf suppression)' },
  { value: 'GESTIONNAIRE', label: 'Gestionnaire', desc: 'Produits, stock et commandes' },
  { value: 'CAISSIER',     label: 'Caissier',     desc: 'Ventes directes et commandes' },
];

export default function CollaborateursScreen() {
  const ready = useRequirePermission('collaborateurs:view');
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  // ── Création ──────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate]     = useState(false);
  const [creating, setCreating]         = useState(false);
  const [form, setForm]                 = useState<CollaboratorDirectCreateRequest>({
    nom: '', email: '', telephone: '', collaboratorRole: 'GESTIONNAIRE',
  });

  // ── Détail ────────────────────────────────────────────────────────────────
  const [selected, setSelected]         = useState<Collaborateur | null>(null);
  const [showDetail, setShowDetail]     = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await collaborateurService.getAll();
      setCollaborateurs(data);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de charger les collaborateurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(true); };

  // ── Création ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ nom: '', email: '', telephone: '', collaboratorRole: 'GESTIONNAIRE' });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!form.nom.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { Alert.alert('Erreur', 'Email invalide'); return; }

    setCreating(true);
    try {
      const collab = await collaborateurService.createDirect(form);
      setShowCreate(false);
      setCollaborateurs(prev => [collab, ...prev]);
      const idMsg = collab.identifiant
        ? `\n\nIdentifiant de connexion : ${collab.identifiant}`
        : '';
      Alert.alert(
        'Compte créé',
        `Un email avec les identifiants a été envoyé à ${collab.email}.${idMsg}`
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de créer le collaborateur');
    } finally {
      setCreating(false);
    }
  };

  // ── Actions détail ────────────────────────────────────────────────────────
  const openDetail = (collab: Collaborateur) => {
    setSelected(collab);
    setSuspendReason('');
    setShowDetail(true);
  };

  const doSuspend = () => {
    if (!selected) return;
    Alert.alert(
      'Suspendre',
      `Suspendre l'accès de ${selected.nom || selected.email} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Suspendre', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await collaborateurService.suspend(selected.id, suspendReason || undefined);
              setShowDetail(false);
              loadData(true);
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de suspendre');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const doReactivate = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await collaborateurService.reactivate(selected.id);
      setShowDetail(false);
      loadData(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de réactiver');
    } finally {
      setActionLoading(false);
    }
  };

  const doRevoke = () => {
    if (!selected) return;
    Alert.alert(
      'Révoquer définitivement',
      `Révoquer l'accès de ${selected.nom || selected.email} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await collaborateurService.revoke(selected.id);
              setShowDetail(false);
              loadData(true);
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de révoquer');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const getInitial = (c: Collaborateur) =>
    (c.nom || c.email || '?').charAt(0).toUpperCase();

  const renderItem = ({ item }: { item: Collaborateur }) => {
    const roleConf   = COLLABORATOR_ROLE_CONFIG[item.collaboratorRole];
    const statusConf = COLLABORATOR_STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
        <View style={[styles.avatar, { backgroundColor: roleConf.color }]}>
          <Text style={styles.avatarText}>{getInitial(item)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.nom || '(compte en attente)'}</Text>
          {item.identifiant && (
            <Text style={[styles.cardEmail, { fontWeight: '700', color: '#2196F3', fontFamily: 'monospace' }]}>{item.identifiant}</Text>
          )}
          <Text style={styles.cardEmail}>{item.email}</Text>
          <View style={styles.cardBadges}>
            <View style={[styles.badge, { backgroundColor: roleConf.color + '22' }]}>
              <Text style={[styles.badgeText, { color: roleConf.color }]}>
                {roleConf.icon} {roleConf.label}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusConf.color + '22' }]}>
              <Text style={[styles.badgeText, { color: statusConf.color }]}>
                {statusConf.label}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const activeCount  = collaborateurs.filter(c => c.status === 'ACTIVE').length;
  const pendingCount = collaborateurs.filter(c => c.status === 'PENDING').length;

  if (!ready) return null;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{collaborateurs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#43A047' }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Actifs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F57C00' }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>

      {/* Liste */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={collaborateurs}
          keyExtractor={c => String(c.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Aucun collaborateur</Text>
              <Text style={styles.emptyDesc}>
                Ajoutez un collaborateur pour partager la gestion de votre épicerie.
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+ Créer</Text>
      </TouchableOpacity>

      {/* ── Modal création ──────────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer un collaborateur</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.fieldLabel}>Nom complet *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.nom}
                onChangeText={v => setForm(f => ({ ...f, nom: v }))}
                placeholder="Ex : Ahmed Benali"
              />

              <Text style={styles.fieldLabel}>Email *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.email}
                onChangeText={v => setForm(f => ({ ...f, email: v.toLowerCase() }))}
                placeholder="collaborateur@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Téléphone (optionnel)</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.telephone}
                onChangeText={v => setForm(f => ({ ...f, telephone: v }))}
                placeholder="Ex : 0612345678"
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>Rôle *</Text>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.roleOption,
                    form.collaboratorRole === r.value && styles.roleOptionActive,
                  ]}
                  onPress={() => setForm(f => ({ ...f, collaboratorRole: r.value }))}
                >
                  <Text style={[
                    styles.roleOptionLabel,
                    form.collaboratorRole === r.value && { color: '#2196F3' },
                  ]}>
                    {COLLABORATOR_ROLE_CONFIG[r.value].icon} {r.label}
                  </Text>
                  <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  ℹ️ Un email avec les identifiants sera envoyé automatiquement. Le collaborateur devra changer son mot de passe à la première connexion.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
                onPress={submitCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Créer le compte</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal détail ─────────────────────────────────────────────────── */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selected && (() => {
              const roleConf   = COLLABORATOR_ROLE_CONFIG[selected.collaboratorRole];
              const statusConf = COLLABORATOR_STATUS_CONFIG[selected.status];
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{selected.nom || selected.email}</Text>
                    <TouchableOpacity onPress={() => setShowDetail(false)}>
                      <Text style={styles.modalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView>
                    {/* Badges */}
                    <View style={styles.detailBadges}>
                      <View style={[styles.badge, { backgroundColor: roleConf.color + '22' }]}>
                        <Text style={[styles.badgeText, { color: roleConf.color }]}>
                          {roleConf.icon} {roleConf.label}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: statusConf.color + '22' }]}>
                        <Text style={[styles.badgeText, { color: statusConf.color }]}>
                          {statusConf.label}
                        </Text>
                      </View>
                    </View>

                    {/* Infos */}
                    <View style={styles.detailSection}>
                      {selected.identifiant && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Identifiant</Text>
                          <Text style={[styles.detailValue, { fontWeight: '700', color: '#2196F3', fontFamily: 'monospace', fontSize: 16 }]}>{selected.identifiant}</Text>
                        </View>
                      )}
                      {selected.email && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Email</Text>
                          <Text style={styles.detailValue}>{selected.email}</Text>
                        </View>
                      )}
                      {selected.telephone && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Téléphone</Text>
                          <Text style={styles.detailValue}>{selected.telephone}</Text>
                        </View>
                      )}
                      {selected.suspensionReason && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Motif suspension</Text>
                          <Text style={[styles.detailValue, { color: '#e53935' }]}>
                            {selected.suspensionReason}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Actions */}
                    {selected.status === 'ACTIVE' && (
                      <>
                        <Text style={styles.fieldLabel}>Motif de suspension (optionnel)</Text>
                        <TextInput
                          style={[styles.fieldInput, { height: 70, textAlignVertical: 'top' }]}
                          value={suspendReason}
                          onChangeText={setSuspendReason}
                          placeholder="Ex : absence temporaire..."
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#F57C00' }]}
                          onPress={doSuspend}
                          disabled={actionLoading}
                        >
                          <Text style={styles.actionBtnText}>⏸ Suspendre l'accès</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {selected.status === 'SUSPENDED' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#43A047' }]}
                        onPress={doReactivate}
                        disabled={actionLoading}
                      >
                        <Text style={styles.actionBtnText}>▶ Réactiver l'accès</Text>
                      </TouchableOpacity>
                    )}

                    {selected.status !== 'REVOKED' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#e53935', marginTop: 8 }]}
                        onPress={doRevoke}
                        disabled={actionLoading}
                      >
                        <Text style={styles.actionBtnText}>✕ Révoquer définitivement</Text>
                      </TouchableOpacity>
                    )}

                    {actionLoading && (
                      <ActivityIndicator style={{ marginTop: 16 }} color="#2196F3" />
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },

  // Stats
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  cardEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  cardBadges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  chevron: { fontSize: 24, color: '#ccc' },

  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#888', textAlign: 'center', paddingHorizontal: 32 },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    backgroundColor: '#2196F3', borderRadius: 28,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: '#2196F3', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  modalClose: { fontSize: 20, color: '#999', padding: 4 },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    backgroundColor: '#fafafa', marginBottom: 14,
  },

  // Role options
  roleOption: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    padding: 12, marginBottom: 8, backgroundColor: '#fafafa',
  },
  roleOptionActive: {
    borderColor: '#2196F3', backgroundColor: '#e3f2fd',
  },
  roleOptionLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  roleOptionDesc: { fontSize: 12, color: '#888', marginTop: 2 },

  infoBanner: {
    backgroundColor: '#e3f2fd', borderRadius: 8,
    padding: 12, marginVertical: 14,
  },
  infoBannerText: { fontSize: 12, color: '#1565c0', lineHeight: 18 },

  submitBtn: {
    backgroundColor: '#2196F3', borderRadius: 10,
    height: 50, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Detail modal
  detailBadges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  detailSection: { marginBottom: 16 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  detailLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  detailValue: { fontSize: 13, color: '#1a1a2e', fontWeight: '600', flex: 1, textAlign: 'right' },

  actionBtn: {
    borderRadius: 10, height: 48, alignItems: 'center',
    justifyContent: 'center', marginBottom: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
