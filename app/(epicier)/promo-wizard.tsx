export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  DateRangeField,
  DateShortcutsRow,
  MultiPickerList,
  PromoPreviewList,
  TargetTypePicker,
  WizardStepBar,
  type PickItem,
} from '../../src/features/promotions/components';
import { usePromotionPreview } from '../../src/features/promotions/hooks';
import type { CreatePromotionRequest, PromoTargetType, WizardState } from '../../src/features/promotions/types';
import { interpolate } from '../../src/features/promotions/utils';
import { categoryService } from '../../src/services/categoryService';
import { epicerieService } from '../../src/services/epicerieService';
import { productService } from '../../src/services/productService';
import { promotionService } from '../../src/services/promotionService';
import type { Category } from '../../src/services/categoryService';
import type { Product } from '../../src/type';

const TOTAL_STEPS = 5;

function initialState(): WizardState {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return {
    titre: '',
    description: '',
    reductionPercentage: 10,
    dateDebut: start.toISOString(),
    dateFin: end.toISOString(),
    targetType: 'ALL',
    targetIds: [],
    autoApply: true,
    priority: 0,
  };
}

/**
 * Wizard 5 étapes : Infos → Cible → Planification → Aperçu → Confirmation.
 * Remplace les écrans legacy ajouter-promo et modifier-promo.
 *
 * Le paramètre `id` (optionnel) active le mode édition.
 */
export default function PromoWizardScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(initialState());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const { preview, loading: previewLoading, error: previewError, run: runPreview, clear: clearPreview } = usePromotionPreview();

  // ── Bootstrap : charger épicerie, catégories, produits (si édition, promo)
  useEffect(() => {
    (async () => {
      try {
        const [cats, prods] = await Promise.all([
          (async () => {
            try {
              // Taxonomie plateforme filtrée sur le type de la boutique.
              return await categoryService.getCategoriesForMyEpicerie();
            } catch {
              return [];
            }
          })(),
          (async () => {
            try {
              const epicerie = await epicerieService.getMyEpicerie();
              return await productService.getProductsByEpicerie(epicerie.id, false);
            } catch {
              return [];
            }
          })(),
        ]);
        setCategories(cats);
        setProducts(prods);

        if (editId) {
          const promo = await promotionService.getPromotionById(editId);
          setState({
            id: promo.id,
            titre: promo.titre,
            description: promo.description ?? '',
            reductionPercentage: promo.reductionPercentage,
            imageUrl: promo.imageUrl,
            dateDebut: promo.dateDebut,
            dateFin: promo.dateFin,
            targetType: (promo.targetType ?? 'ALL') as PromoTargetType,
            targetIds: (promo.targets ?? []).map(t => t.targetId),
            autoApply: promo.autoApply ?? true,
            priority: promo.priority ?? 0,
          });
        }
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [editId]);

  // ── Items pour les pickers
  const categoryItems: PickItem[] = useMemo(
    () => flattenCategories(categories).map(c => ({ id: c.id, label: c.name })),
    [categories]
  );
  const productItems: PickItem[] = useMemo(
    () => products.map(p => ({
      id: p.id,
      label: p.nom,
      subtitle: `${p.units?.length ?? 0} variante${(p.units?.length ?? 0) > 1 ? 's' : ''}`,
    })),
    [products]
  );
  const unitItems: PickItem[] = useMemo(() => {
    const items: PickItem[] = [];
    for (const p of products) {
      for (const u of p.units ?? []) {
        items.push({ id: u.id, label: `${p.nom} — ${u.label}`, subtitle: `${u.prix} DH` });
      }
    }
    return items;
  }, [products]);

  // ── Navigation étapes
  const canGoNext = useCallback((): { ok: boolean; reason?: string } => {
    if (step === 1) {
      if (!state.titre.trim()) return { ok: false, reason: t('promotions.errors.titleRequired') };
      if (state.reductionPercentage <= 0 || state.reductionPercentage > 100) {
        return { ok: false, reason: t('promotions.errors.invalidPercent') };
      }
    }
    if (step === 2) {
      if (state.targetType !== 'ALL' && state.targetIds.length === 0) {
        return { ok: false, reason: t('promotions.errors.targetRequired') };
      }
    }
    if (step === 3) {
      if (new Date(state.dateFin).getTime() <= new Date(state.dateDebut).getTime()) {
        return { ok: false, reason: t('promotions.errors.invalidDates') };
      }
    }
    return { ok: true };
  }, [step, state, t]);

  const goNext = useCallback(() => {
    const { ok, reason } = canGoNext();
    if (!ok) { Alert.alert('', reason || ''); return; }
    if (step === 3) {
      // Déclenche la prévisualisation en entrant en étape 4
      runPreview(toRequest(state));
    }
    setStep(s => Math.min(TOTAL_STEPS, s + 1));
  }, [step, canGoNext, runPreview, state]);

  const goBack = useCallback(() => setStep(s => Math.max(1, s - 1)), []);

  const goExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(epicier)/promotions' as any);
  }, [router]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    try {
      const req = toRequest(state);
      if (editId) {
        await promotionService.updatePromotion(editId, req);
      } else {
        await promotionService.createPromotion(req);
      }
      clearPreview();
      Alert.alert('✅', t(editId ? 'promotions.wizard.confirmUpdate' : 'promotions.wizard.confirmTitle'), [
        { text: 'OK', onPress: goExit },
      ]);
    } catch (err: any) {
      Alert.alert('⚠️', err?.message ?? 'Erreur');
    } finally {
      setSaving(false);
    }
  }, [editId, state, clearPreview, t, goExit]);

  if (bootstrapping) {
    return (
      <View style={styles.bootstrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const stepLabels = [
    t('promotions.wizard.step1'),
    t('promotions.wizard.step2'),
    t('promotions.wizard.step3'),
    t('promotions.wizard.step4'),
    t('promotions.wizard.step5'),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardStepBar currentStep={step} totalSteps={TOTAL_STEPS} labels={stepLabels} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && <StepInfos state={state} setState={setState} />}
        {step === 2 && (
          <StepTarget
            state={state}
            setState={setState}
            categoryItems={categoryItems}
            productItems={productItems}
            unitItems={unitItems}
          />
        )}
        {step === 3 && <StepSchedule state={state} setState={setState} />}
        {step === 4 && (
          <StepPreview
            preview={preview}
            loading={previewLoading}
            error={previewError}
            onRetry={() => runPreview(toRequest(state))}
          />
        )}
        {step === 5 && <StepConfirm state={state} preview={preview} editMode={!!editId} />}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 ? (
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goBack} disabled={saving}>
            <Text style={styles.btnSecondaryText}>{t('promotions.back')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goExit} disabled={saving}>
            <Text style={styles.btnSecondaryText}>{t('promotions.cancel')}</Text>
          </TouchableOpacity>
        )}

        {step < TOTAL_STEPS ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={goNext}>
            <Text style={styles.btnPrimaryText}>{t('promotions.next')} →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnPrimaryText}>{t('promotions.confirm')} ✓</Text>}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Steps (sub-components)
// ═══════════════════════════════════════════════════════════════════════════

function StepInfos({
  state, setState,
}: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorisez l’accès à la galerie pour choisir une image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      const url = await promotionService.uploadImage(result.assets[0]);
      setState(s => ({ ...s, imageUrl: url }));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible d'envoyer l'image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.fieldLabel}>{t('promotions.wizard.titreHelp')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('promotions.wizard.titrePlaceholder')}
        placeholderTextColor="#999"
        value={state.titre}
        onChangeText={v => setState(s => ({ ...s, titre: v }))}
        maxLength={80}
      />

      <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
        {t('promotions.wizard.descriptionHelp')}
      </Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder={t('promotions.wizard.descriptionPlaceholder')}
        placeholderTextColor="#999"
        value={state.description}
        onChangeText={v => setState(s => ({ ...s, description: v }))}
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
        {t('promotions.wizard.reductionHelp')}
      </Text>
      <View style={styles.reductionRow}>
        <TextInput
          style={[styles.input, styles.reductionInput]}
          placeholder={t('promotions.wizard.reductionPlaceholder')}
          placeholderTextColor="#999"
          value={String(state.reductionPercentage)}
          onChangeText={v => {
            const n = parseFloat(v.replace(',', '.'));
            setState(s => ({ ...s, reductionPercentage: Number.isNaN(n) ? 0 : n }));
          }}
          keyboardType="numeric"
          maxLength={5}
        />
        <Text style={styles.reductionSuffix}>{t('promotions.wizard.reductionSuffix')}</Text>
      </View>

      <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Image (optionnel)</Text>
      {state.imageUrl ? (
        <View style={styles.imagePreviewWrap}>
          <Image source={{ uri: state.imageUrl }} style={styles.imagePreview} resizeMode="cover" />
          <TouchableOpacity
            style={styles.imageRemove}
            onPress={() => setState(s => ({ ...s, imageUrl: undefined }))}
          >
            <Text style={styles.imageRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={pickImage}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator color={Colors.primary} />
            : <Text style={styles.imagePickerText}>＋  Choisir une image</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

function StepTarget({
  state, setState, categoryItems, productItems, unitItems,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  categoryItems: PickItem[];
  productItems: PickItem[];
  unitItems: PickItem[];
}) {
  const { t } = useLanguage();
  const selected = useMemo(() => new Set(state.targetIds), [state.targetIds]);

  const toggle = useCallback((id: number) => {
    setState(s => {
      const next = new Set(s.targetIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, targetIds: Array.from(next) };
    });
  }, [setState]);

  const items = state.targetType === 'CATEGORY'
    ? categoryItems
    : state.targetType === 'PRODUCT'
    ? productItems
    : state.targetType === 'UNIT'
    ? unitItems
    : [];

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.fieldLabel}>{t('promotions.wizard.targetChoose')}</Text>
      <TargetTypePicker
        value={state.targetType}
        onChange={type => setState(s => ({ ...s, targetType: type, targetIds: [] }))}
      />

      {state.targetType !== 'ALL' && (
        <View style={{ marginTop: 20 }}>
          <View style={styles.pickerHeader}>
            <Text style={styles.fieldLabel}>
              {state.targetType === 'CATEGORY' && t('promotions.wizard.selectCategories')}
              {state.targetType === 'PRODUCT' && t('promotions.wizard.selectProducts')}
              {state.targetType === 'UNIT' && t('promotions.wizard.selectUnits')}
            </Text>
            <Text style={styles.countLabel}>
              {interpolate(
                t(state.targetIds.length === 1 ? 'promotions.wizard.selectedCount' : 'promotions.wizard.selectedCountPlural'),
                { n: state.targetIds.length }
              )}
            </Text>
          </View>
          <View style={styles.pickerBox}>
            <MultiPickerList items={items} selected={selected} onToggle={toggle} />
          </View>
        </View>
      )}
    </View>
  );
}

function StepSchedule({
  state, setState,
}: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const { t } = useLanguage();
  return (
    <View style={styles.stepWrap}>
      <Text style={styles.fieldLabel}>{t('promotions.wizard.quickShortcuts')}</Text>
      <DateShortcutsRow
        onApply={(start, end) => setState(s => ({ ...s, dateDebut: start, dateFin: end }))}
      />

      <View style={{ height: 14 }} />
      <DateRangeField
        startIso={state.dateDebut}
        endIso={state.dateFin}
        onChange={(start, end) => setState(s => ({ ...s, dateDebut: start, dateFin: end }))}
      />

      <View style={{ marginTop: 20 }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>⚡ {t('promotions.wizard.autoApply')}</Text>
            <Text style={styles.switchHint}>{t('promotions.wizard.autoApplyHint')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, state.autoApply && styles.toggleOn]}
            onPress={() => setState(s => ({ ...s, autoApply: !s.autoApply }))}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleKnob, state.autoApply && styles.toggleKnobOn]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function StepPreview({
  preview, loading, error, onRetry,
}: {
  preview: any;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.stepWrap}>
      <Text style={styles.fieldTitle}>{t('promotions.wizard.previewTitle')}</Text>
      <PromoPreviewList preview={preview} loading={loading} error={error} />
      {!loading && error && (
        <TouchableOpacity style={styles.retryMini} onPress={onRetry}>
          <Text style={styles.retryMiniText}>{t('promotions.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StepConfirm({
  state, preview, editMode,
}: { state: WizardState; preview: any; editMode: boolean }) {
  const { t } = useLanguage();
  const now = Date.now();
  const start = new Date(state.dateDebut).getTime();
  const actionKey = start <= now && state.autoApply
    ? 'confirmActionApply'
    : start > now && state.autoApply
    ? 'confirmActionSchedule'
    : 'confirmActionDraft';
  const action = t(`promotions.wizard.${actionKey}`);

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.fieldTitle}>
        {t(editMode ? 'promotions.wizard.confirmUpdate' : 'promotions.wizard.confirmTitle')}
      </Text>
      <Text style={styles.confirmBody}>
        {interpolate(t('promotions.wizard.confirmBody'), { action })}
      </Text>

      <View style={styles.summaryCard}>
        <SummaryRow label={t('promotions.wizard.step1')} value={state.titre} />
        <SummaryRow label="Réduction" value={`${state.reductionPercentage}%`} />
        <SummaryRow
          label={t('promotions.wizard.step2')}
          value={t(`promotions.wizard.target${cap(state.targetType.toLowerCase())}`)}
        />
        {state.targetType !== 'ALL' && (
          <SummaryRow label="IDs" value={`${state.targetIds.length}`} />
        )}
        <SummaryRow
          label={t('promotions.wizard.step3')}
          value={`${new Date(state.dateDebut).toLocaleDateString('fr-FR')} → ${new Date(state.dateFin).toLocaleDateString('fr-FR')}`}
        />
        {preview && (
          <SummaryRow label="Impact" value={`${preview.totalUnits} articles`} />
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function toRequest(s: WizardState): CreatePromotionRequest {
  return {
    titre: s.titre.trim(),
    description: s.description.trim() || undefined,
    reductionPercentage: s.reductionPercentage,
    imageUrl: s.imageUrl,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
    targetType: s.targetType,
    targetIds: s.targetType === 'ALL' ? [] : s.targetIds,
    autoApply: s.autoApply,
    priority: s.priority,
  };
}

function flattenCategories(cats: Category[], depth = 0): (Category & { depth: number })[] {
  const out: (Category & { depth: number })[] = [];
  for (const c of cats) {
    out.push({ ...c, depth });
    if (c.children?.length) out.push(...flattenCategories(c.children, depth + 1));
  }
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  bootstrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 15,
    paddingBottom: 30,
  },
  stepWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#222',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reductionInput: {
    flex: 1,
  },
  reductionSuffix: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  imagePicker: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7D2DD',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
  imagePreviewWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imagePreview: {
    width: 220,
    height: 160,
  },
  imageRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  countLabel: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '700',
  },
  pickerBox: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    maxHeight: 340,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  switchHint: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#CFD8DC',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#4CAF50',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    transform: [{ translateX: 18 }],
  },
  retryMini: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryMiniText: {
    color: '#1565C0',
    fontWeight: '700',
  },

  confirmBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 14,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#777',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 13,
    color: '#222',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: '#F5F5F5',
  },
  btnSecondaryText: {
    color: '#555',
    fontWeight: '700',
    fontSize: 14,
  },
});
