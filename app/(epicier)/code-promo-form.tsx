import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../src/components/feedback';
import { DateRangeField } from '../../src/features/promotions/components';
import {
  CreatePromoCodeRequest,
  PromoCodeChannel,
  PromoCodeDiscountType,
  promoCodeEpicierService,
} from '../../src/services/promoCodeService';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';

/**
 * Formulaire unifie creation / edition d'un code promo.
 *
 * <p>Mode determine par la presence du parametre {@code id} dans l'URL :
 * - {@code id} absent : creation (POST /api/promo-codes)
 * - {@code id} present : edition (PUT /api/promo-codes/{id})
 *
 * <p>UI epicier mobile en francais uniquement.
 */
export default function CodePromoFormScreen() {
  const ready = useRequirePermission('promoCodes:manage');
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const isEdit = editId != null;

  // ── Form state ─────────────────────────────────────────────────────────
  const defaultDates = useMemo(() => {
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<PromoCodeDiscountType>('PERCENT');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [startAt, setStartAt] = useState(defaultDates.start);
  const [endAt, setEndAt] = useState(defaultDates.end);
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('');
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [channel, setChannel] = useState<PromoCodeChannel>('BOTH');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // ── Edit : chargement initial du code ──────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoadingInitial(true);
      try {
        const p = await promoCodeEpicierService.getById(editId!);
        if (cancelled) return;
        setCode(p.code);
        setDescription(p.description ?? '');
        setDiscountType(p.discountType);
        setDiscountValue(String(p.discountValue));
        setMaxDiscount(p.maxDiscount != null ? String(p.maxDiscount) : '');
        setMinOrderAmount(p.minOrderAmount != null ? String(p.minOrderAmount) : '');
        setStartAt(p.startAt);
        setEndAt(p.endAt);
        setMaxUses(p.maxUses != null ? String(p.maxUses) : '');
        setMaxUsesPerUser(p.maxUsesPerUser != null ? String(p.maxUsesPerUser) : '');
        setFirstOrderOnly(p.firstOrderOnly);
        setChannel(p.channel);
        setIsActive(p.isActive);
      } catch (err: any) {
        toast.error('Erreur', String(err));
        router.back();
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, ready]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  /** Genere un code aleatoire 8 chars alphanumerique majuscule. */
  const generateRandomCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 pour lisibilite
    let out = '';
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setCode(out);
  }, []);

  // Sanitize: input ne contient que des caracteres autorises par le backend
  // (regex ^[A-Za-z0-9_\-]+$). On uppercase a la volee.
  const onCodeChange = useCallback((txt: string) => {
    const cleaned = txt.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    setCode(cleaned.slice(0, 40));
  }, []);

  const validate = useCallback((): string | null => {
    if (!code.trim()) return 'Le code est obligatoire';
    if (code.length < 3) return 'Le code doit faire au moins 3 caractères';
    const v = parseFloat(discountValue.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return 'La valeur de remise doit être > 0';
    if (discountType === 'PERCENT' && v > 100) return 'Le pourcentage doit être ≤ 100';
    if (maxDiscount) {
      const md = parseFloat(maxDiscount.replace(',', '.'));
      if (!Number.isFinite(md) || md <= 0) return 'Le plafond doit être > 0';
    }
    if (minOrderAmount) {
      const mo = parseFloat(minOrderAmount.replace(',', '.'));
      if (!Number.isFinite(mo) || mo < 0) return 'Le montant minimum doit être ≥ 0';
    }
    if (maxUses) {
      const mu = parseInt(maxUses, 10);
      if (!Number.isInteger(mu) || mu <= 0) return 'Le nombre d\'utilisations doit être > 0';
    }
    if (maxUsesPerUser) {
      const mup = parseInt(maxUsesPerUser, 10);
      if (!Number.isInteger(mup) || mup <= 0) return 'Le nombre par utilisateur doit être > 0';
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return 'La date de fin doit être après la date de début';
    }
    return null;
  }, [code, discountValue, discountType, maxDiscount, minOrderAmount, maxUses, maxUsesPerUser, startAt, endAt]);

  const handleSave = useCallback(async () => {
    const err = validate();
    if (err) {
      toast.warning('Validation', err);
      return;
    }
    const payload: CreatePromoCodeRequest = {
      code: code.trim(),
      description: description.trim() || undefined,
      discountType,
      discountValue: parseFloat(discountValue.replace(',', '.')),
      maxDiscount: maxDiscount ? parseFloat(maxDiscount.replace(',', '.')) : null,
      minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount.replace(',', '.')) : null,
      startAt,
      endAt,
      maxUses: maxUses ? parseInt(maxUses, 10) : null,
      maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser, 10) : null,
      firstOrderOnly,
      channel,
      isActive,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await promoCodeEpicierService.update(editId!, payload);
        toast.success('OK', 'Code mis à jour');
      } else {
        await promoCodeEpicierService.create(payload);
        toast.success('OK', 'Code créé');
      }
      router.back();
    } catch (e: any) {
      // Skip si l'intercepteur 402 a deja affiche l'Alert d'abonnement.
      if (!e?.__subscriptionGateHandled) {
        toast.error('Erreur', e?.response?.data?.message ?? e?.message ?? String(e));
      }
    } finally {
      setSaving(false);
    }
  }, [
    validate, code, description, discountType, discountValue, maxDiscount, minOrderAmount,
    startAt, endAt, maxUses, maxUsesPerUser, firstOrderOnly, channel, isActive,
    isEdit, editId, router, toast,
  ]);

  if (!ready) return null;

  if (loadingInitial) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* SECTION 1 — Identifiant */}
        <Text style={styles.sectionTitle}>Code</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={onCodeChange}
            placeholder="BIENVENUE10"
            placeholderTextColor="#aaa"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            editable={!saving}
          />
          {!isEdit && (
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={generateRandomCode}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.generateBtnText}>🎲</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.hint}>Majuscules, chiffres, tirets. Max 40 caractères.</Text>

        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description (interne, jamais montrée au client)"
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={2}
          maxLength={255}
          editable={!saving}
        />

        {/* SECTION 2 — Type et valeur */}
        <Text style={styles.sectionTitle}>Type de remise</Text>
        <View style={styles.segmented}>
          <SegmentBtn
            label="% Pourcentage"
            active={discountType === 'PERCENT'}
            onPress={() => setDiscountType('PERCENT')}
          />
          <SegmentBtn
            label="DH Montant fixe"
            active={discountType === 'FIXED'}
            onPress={() => setDiscountType('FIXED')}
          />
        </View>

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>
              {discountType === 'PERCENT' ? 'Pourcentage (%)' : 'Montant (DH)'}
            </Text>
            <TextInput
              style={styles.input}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder="10"
              placeholderTextColor="#aaa"
              editable={!saving}
            />
          </View>
          {discountType === 'PERCENT' && (
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Plafond (DH)</Text>
              <TextInput
                style={styles.input}
                value={maxDiscount}
                onChangeText={setMaxDiscount}
                keyboardType="decimal-pad"
                placeholder="Optionnel"
                placeholderTextColor="#aaa"
                editable={!saving}
              />
            </View>
          )}
        </View>

        {/* SECTION 3 — Dates */}
        <Text style={styles.sectionTitle}>Période de validité</Text>
        <DateRangeField
          startIso={startAt}
          endIso={endAt}
          onChange={(s, e) => { setStartAt(s); setEndAt(e); }}
        />

        {/* SECTION 4 — Conditions */}
        <Text style={styles.sectionTitle}>Conditions (optionnelles)</Text>

        <Text style={styles.fieldLabel}>Montant minimum du panier (DH)</Text>
        <TextInput
          style={styles.input}
          value={minOrderAmount}
          onChangeText={setMinOrderAmount}
          keyboardType="decimal-pad"
          placeholder="Aucun seuil"
          placeholderTextColor="#aaa"
          editable={!saving}
        />

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>Usages totaux max</Text>
            <TextInput
              style={styles.input}
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="number-pad"
              placeholder="Illimité"
              placeholderTextColor="#aaa"
              editable={!saving}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>Par client max</Text>
            <TextInput
              style={styles.input}
              value={maxUsesPerUser}
              onChangeText={setMaxUsesPerUser}
              keyboardType="number-pad"
              placeholder="Illimité"
              placeholderTextColor="#aaa"
              editable={!saving}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Réservé aux nouveaux clients</Text>
            <Text style={styles.switchHint}>Refuse les clients ayant déjà commandé chez vous.</Text>
          </View>
          <Switch
            value={firstOrderOnly}
            onValueChange={setFirstOrderOnly}
            disabled={saving}
          />
        </View>

        {/* SECTION 5 — Canal */}
        <Text style={styles.sectionTitle}>Canal d'application</Text>
        <View style={styles.segmented3}>
          <SegmentBtn
            label="App + Caisse"
            active={channel === 'BOTH'}
            onPress={() => setChannel('BOTH')}
          />
          <SegmentBtn
            label="App seulement"
            active={channel === 'APP'}
            onPress={() => setChannel('APP')}
          />
          <SegmentBtn
            label="Caisse seulement"
            active={channel === 'POS'}
            onPress={() => setChannel('POS')}
          />
        </View>

        {/* SECTION 6 — Etat */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Code actif</Text>
            <Text style={styles.switchHint}>Désactivez pour le suspendre temporairement.</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            disabled={saving}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{isEdit ? 'Enregistrer' : 'Créer le code'}</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════

function SegmentBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.segmentBtnText, active && styles.segmentBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  scroll: { padding: 16, paddingBottom: 32 },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#444',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 18, marginBottom: 8,
  },

  hint: { fontSize: 11, color: '#888', marginTop: 4, marginBottom: 8 },

  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#e0e0e0',
    fontSize: 14, color: '#222',
  },
  textarea: { marginTop: 8, textAlignVertical: 'top', minHeight: 60 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInput: { flex: 1, fontWeight: '700', letterSpacing: 1.5, fontSize: 16 },
  generateBtn: {
    width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
  },
  generateBtnText: { fontSize: 22 },

  segmented: { flexDirection: 'row', gap: 8 },
  segmented3: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segmentBtn: {
    flex: 1, minWidth: '30%',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  segmentBtnText: { fontSize: 13, color: '#666', fontWeight: '600' },
  segmentBtnTextActive: { color: '#1565c0' },

  row2: { flexDirection: 'row', gap: 12, marginTop: 8 },
  col: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12, paddingHorizontal: 14,
    marginTop: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  switchHint: { fontSize: 11, color: '#888', marginTop: 2 },

  saveBtn: {
    marginTop: 24, paddingVertical: 14,
    backgroundColor: '#2196F3', borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#90caf9' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
