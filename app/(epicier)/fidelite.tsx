export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Écran Fidélité — Configuration du programme + catalogue de récompenses.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  loyaltyService,
  LoyaltyProgram,
  LoyaltyReward,
  LoyaltyStats,
} from '../../src/services/loyaltyService';

type RewardType = 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT' | 'FREE_PRODUCT';

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  DISCOUNT_AMOUNT: 'Remise fixe (DH)',
  DISCOUNT_PERCENT: 'Remise %',
  FREE_PRODUCT: 'Produit offert',
};

export default function FideliteScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Reward form modal
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: '',
    pointsCost: '',
    rewardType: 'DISCOUNT_AMOUNT' as RewardType,
    discountAmount: '',
    discountPercent: '',
  });
  const [savingReward, setSavingReward] = useState(false);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    try {
      const [p, r, s] = await Promise.all([
        loyaltyService.getProgram(),
        loyaltyService.getRewards(),
        loyaltyService.getStats().catch(() => null),
      ]);
      setProgram(p);
      setRewards(r);
      setStats(s);
    } catch {
      // Programme pas encore cree — on recevra un programme par defaut
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Programme toggle ──
  const handleToggle = async (active: boolean) => {
    if (!program) return;
    try {
      const updated = await loyaltyService.toggleProgram(active);
      setProgram(updated);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Erreur');
    }
  };

  // ── Save programme config ──
  const handleSaveConfig = async () => {
    if (!program) return;
    setSaving(true);
    try {
      const updated = await loyaltyService.saveProgram({
        programType: program.programType,
        name: program.name,
        earningRateNumerator: program.earningRateNumerator,
        earningRateDenominator: program.earningRateDenominator,
        pointsExpiryDays: program.pointsExpiryDays,
        minOrderAmount: program.minOrderAmount,
        earnOnCreditOrders: program.earnOnCreditOrders,
      });
      setProgram(updated);
      Alert.alert('Enregistre', 'Configuration mise a jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // ── Reward CRUD ──
  const openAddReward = () => {
    setEditingReward(null);
    setRewardForm({ name: '', pointsCost: '', rewardType: 'DISCOUNT_AMOUNT', discountAmount: '', discountPercent: '' });
    setShowRewardModal(true);
  };

  const openEditReward = (r: LoyaltyReward) => {
    setEditingReward(r);
    setRewardForm({
      name: r.name,
      pointsCost: r.pointsCost.toString(),
      rewardType: r.rewardType,
      discountAmount: r.discountAmount?.toString() ?? '',
      discountPercent: r.discountPercent?.toString() ?? '',
    });
    setShowRewardModal(true);
  };

  const handleSaveReward = async () => {
    const cost = parseInt(rewardForm.pointsCost);
    if (!rewardForm.name.trim() || isNaN(cost) || cost <= 0) {
      Alert.alert('Erreur', 'Nom et cout en points requis.');
      return;
    }
    setSavingReward(true);
    try {
      const data: Partial<LoyaltyReward> = {
        name: rewardForm.name.trim(),
        pointsCost: cost,
        rewardType: rewardForm.rewardType,
        discountAmount: rewardForm.rewardType === 'DISCOUNT_AMOUNT' ? parseFloat(rewardForm.discountAmount) || 0 : null,
        discountPercent: rewardForm.rewardType === 'DISCOUNT_PERCENT' ? parseInt(rewardForm.discountPercent) || 0 : null,
      };
      if (editingReward) {
        await loyaltyService.updateReward(editingReward.id, data);
      } else {
        await loyaltyService.createReward(data);
      }
      setShowRewardModal(false);
      loadAll();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Erreur');
    } finally {
      setSavingReward(false);
    }
  };

  const handleDeleteReward = (r: LoyaltyReward) => {
    Alert.alert('Supprimer', `Desactiver "${r.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await loyaltyService.deleteReward(r.id);
        loadAll();
      }},
    ]);
  };

  const unitLabel = program?.programType === 'STAMPS' ? 'tampon(s)' : 'point(s)';

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Programme Fidelite</Text>
        {program && (
          <Switch
            value={program.isActive}
            onValueChange={handleToggle}
            trackColor={{ true: '#4CAF50' }}
          />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
      >
        {/* Stats */}
        {stats && program?.isActive && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Ionicons name="people" size={20} color={Colors.primary} />
              <Text style={s.statValue}>{stats.activeMembersCount}</Text>
              <Text style={s.statLabel}>Membres actifs</Text>
            </View>
            <View style={s.statCard}>
              <Ionicons name="star" size={20} color="#FF9800" />
              <Text style={s.statValue}>{stats.totalPointsInCirculation}</Text>
              <Text style={s.statLabel}>{unitLabel} en circulation</Text>
            </View>
          </View>
        )}

        {!program?.isActive && (
          <View style={s.inactiveCard}>
            <Ionicons name="gift-outline" size={40} color="#90caf9" />
            <Text style={s.inactiveTitle}>Programme desactive</Text>
            <Text style={s.inactiveSub}>Activez le programme pour fideliser vos clients et augmenter les ventes recurrentes.</Text>
          </View>
        )}

        {/* Configuration */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Configuration</Text>

          <Text style={s.label}>Nom du programme</Text>
          <TextInput
            style={s.input}
            value={program?.name ?? ''}
            onChangeText={t => setProgram(p => p ? { ...p, name: t } : p)}
            placeholder="Ex: Carte Fidelite Chez Omar"
            placeholderTextColor="#bbb"
          />

          <Text style={s.label}>Type</Text>
          <View style={s.typeRow}>
            {(['POINTS', 'STAMPS'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[s.typeBtn, program?.programType === type && s.typeBtnActive]}
                onPress={() => setProgram(p => p ? { ...p, programType: type } : p)}
              >
                <Ionicons
                  name={type === 'POINTS' ? 'star' : 'card'}
                  size={18}
                  color={program?.programType === type ? '#fff' : Colors.primary}
                />
                <Text style={[s.typeBtnText, program?.programType === type && s.typeBtnTextActive]}>
                  {type === 'POINTS' ? 'Points' : 'Tampons'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Taux de gain</Text>
          <View style={s.rateRow}>
            <TextInput
              style={[s.input, { flex: 1, textAlign: 'center' }]}
              value={program?.earningRateNumerator?.toString() ?? '1'}
              onChangeText={t => setProgram(p => p ? { ...p, earningRateNumerator: parseInt(t) || 1 } : p)}
              keyboardType="number-pad"
            />
            <Text style={s.rateText}>{unitLabel} pour</Text>
            <TextInput
              style={[s.input, { flex: 1, textAlign: 'center' }]}
              value={program?.earningRateDenominator?.toString() ?? '1'}
              onChangeText={t => setProgram(p => p ? { ...p, earningRateDenominator: parseFloat(t) || 1 } : p)}
              keyboardType="decimal-pad"
            />
            <Text style={s.rateText}>DH</Text>
          </View>

          <Text style={s.label}>Expiration des {unitLabel}</Text>
          <TextInput
            style={s.input}
            value={program?.pointsExpiryDays?.toString() ?? ''}
            onChangeText={t => setProgram(p => p ? { ...p, pointsExpiryDays: t ? parseInt(t) : null } : p)}
            placeholder="Jamais (laisser vide)"
            placeholderTextColor="#bbb"
            keyboardType="number-pad"
          />
          <Text style={s.hint}>En jours. Laissez vide pour ne jamais expirer.</Text>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Gagner des {unitLabel} sur achats a credit</Text>
            <Switch
              value={program?.earnOnCreditOrders ?? true}
              onValueChange={v => setProgram(p => p ? { ...p, earnOnCreditOrders: v } : p)}
              trackColor={{ true: '#4CAF50' }}
            />
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveConfig}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Enregistrer la configuration</Text>}
          </TouchableOpacity>
        </View>

        {/* Recompenses */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recompenses</Text>
            <TouchableOpacity style={s.addBtn} onPress={openAddReward}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {rewards.length === 0 ? (
            <View style={s.emptyRewards}>
              <Ionicons name="gift-outline" size={36} color="#ccc" />
              <Text style={s.emptyText}>Aucune recompense</Text>
              <Text style={s.hint}>Ajoutez des recompenses pour que vos clients puissent echanger leurs {unitLabel}.</Text>
            </View>
          ) : (
            rewards.map(r => (
              <TouchableOpacity key={r.id} style={s.rewardCard} onPress={() => openEditReward(r)} activeOpacity={0.7}>
                <View style={[s.rewardIcon, !r.isActive && { opacity: 0.4 }]}>
                  <Ionicons
                    name={r.rewardType === 'FREE_PRODUCT' ? 'gift' : 'pricetag'}
                    size={22}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rewardName, !r.isActive && { color: '#999' }]}>{r.name}</Text>
                  <Text style={s.rewardCost}>{r.pointsCost} {unitLabel}</Text>
                  {r.rewardType === 'DISCOUNT_AMOUNT' && r.discountAmount != null && (
                    <Text style={s.rewardDetail}>-{r.discountAmount} DH</Text>
                  )}
                  {r.rewardType === 'DISCOUNT_PERCENT' && r.discountPercent != null && (
                    <Text style={s.rewardDetail}>-{r.discountPercent}%</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteReward(r)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={18} color="#e53935" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal ajout/edition recompense */}
      <Modal visible={showRewardModal} transparent animationType="slide" onRequestClose={() => setShowRewardModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{editingReward ? 'Modifier' : 'Nouvelle'} recompense</Text>

            <Text style={s.label}>Nom</Text>
            <TextInput style={s.input} value={rewardForm.name} onChangeText={t => setRewardForm(f => ({ ...f, name: t }))} placeholder="Ex: Remise 25 DH" placeholderTextColor="#bbb" />

            <Text style={s.label}>Cout en {unitLabel}</Text>
            <TextInput style={s.input} value={rewardForm.pointsCost} onChangeText={t => setRewardForm(f => ({ ...f, pointsCost: t }))} keyboardType="number-pad" placeholder="Ex: 500" placeholderTextColor="#bbb" />

            <Text style={s.label}>Type de recompense</Text>
            <View style={s.typeRow}>
              {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[s.typeBtn, { flex: 1 }, rewardForm.rewardType === type && s.typeBtnActive]}
                  onPress={() => setRewardForm(f => ({ ...f, rewardType: type }))}
                >
                  <Text style={[s.typeBtnText, { fontSize: 11 }, rewardForm.rewardType === type && s.typeBtnTextActive]}>
                    {REWARD_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {rewardForm.rewardType === 'DISCOUNT_AMOUNT' && (
              <>
                <Text style={s.label}>Montant de la remise (DH)</Text>
                <TextInput style={s.input} value={rewardForm.discountAmount} onChangeText={t => setRewardForm(f => ({ ...f, discountAmount: t }))} keyboardType="decimal-pad" placeholder="25" placeholderTextColor="#bbb" />
              </>
            )}
            {rewardForm.rewardType === 'DISCOUNT_PERCENT' && (
              <>
                <Text style={s.label}>Pourcentage de remise</Text>
                <TextInput style={s.input} value={rewardForm.discountPercent} onChangeText={t => setRewardForm(f => ({ ...f, discountPercent: t }))} keyboardType="number-pad" placeholder="10" placeholderTextColor="#bbb" />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#9e9e9e' }]} onPress={() => setShowRewardModal(false)}>
                <Text style={s.saveBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { flex: 2 }, savingReward && { opacity: 0.6 }]} onPress={handleSaveReward} disabled={savingReward}>
                {savingReward ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editingReward ? 'Modifier' : 'Ajouter'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#eee',
  },
  statValue: { fontSize: 22, fontWeight: '900', color: '#333' },
  statLabel: { fontSize: 11, color: '#888' },

  inactiveCard: {
    alignItems: 'center', backgroundColor: '#e3f2fd', borderRadius: 14,
    padding: 24, marginBottom: 16, gap: 8,
  },
  inactiveTitle: { fontSize: 16, fontWeight: '700', color: '#1565c0' },
  inactiveSub: { fontSize: 13, color: '#1976D2', textAlign: 'center', lineHeight: 20 },

  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 12 },

  label: { fontSize: 12, fontWeight: '700', color: '#555', marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 11, color: '#999', marginTop: 4 },
  input: {
    backgroundColor: '#f8f8f8', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#333',
  },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fff',
  },
  typeBtnActive: { backgroundColor: '#1565c0', borderColor: '#1565c0' },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  typeBtnTextActive: { color: '#fff' },

  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateText: { fontSize: 13, color: '#666', fontWeight: '600' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  switchLabel: { fontSize: 13, color: '#555', flex: 1, fontWeight: '500' },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  addBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyRewards: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyText: { fontSize: 14, color: '#999', fontWeight: '600' },

  rewardCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f8f8f8', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#eee',
  },
  rewardIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#1565c0',
    alignItems: 'center', justifyContent: 'center',
  },
  rewardName: { fontSize: 14, fontWeight: '700', color: '#333' },
  rewardCost: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  rewardDetail: { fontSize: 11, color: '#888', marginTop: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 4 },
});
