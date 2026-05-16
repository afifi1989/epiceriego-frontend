import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../src/components/feedback';
import { useLanguage } from '../src/context/LanguageContext';
import type { Language } from '../src/i18n/translations';
import { clientOnboardingService } from '../src/services/clientOnboardingService';
import { useTheme } from '../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LangOption {
  code:   Language;
  label:  string;
  native: string;
  flag:   string;
}

const LANG_OPTIONS: LangOption[] = [
  { code: 'fr', label: 'Français', native: 'Français',  flag: '🇫🇷' },
  { code: 'ar', label: 'Arabe',    native: 'العربية',    flag: '🇲🇦' },
  { code: 'tz', label: 'Darija',   native: 'الدارجة',    flag: '🇲🇦' },
  { code: 'en', label: 'English',  native: 'English',   flag: '🇬🇧' },
];

interface CategoryOption {
  id:    string;
  label: string;
  emoji: string;
}

/**
 * Catégories sémantiques (string IDs, pas IDs DB) — utilisées pour la
 * personnalisation côté frontend. Le backend reste libre de mapper ces
 * IDs vers ses propres catégories quand on branchera la perso.
 */
const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'fruits',    label: 'Fruits & Légumes',  emoji: '🥬' },
  { id: 'meat',      label: 'Viandes & Poissons', emoji: '🥩' },
  { id: 'dairy',     label: 'Produits laitiers',  emoji: '🥛' },
  { id: 'bakery',    label: 'Boulangerie',        emoji: '🍞' },
  { id: 'beverages', label: 'Boissons',           emoji: '🥤' },
  { id: 'spices',    label: 'Épices & Conserves', emoji: '🌶️' },
  { id: 'hygiene',   label: 'Hygiène & Beauté',   emoji: '🧴' },
  { id: 'home',      label: 'Entretien',          emoji: '🧹' },
];

const STEP_COUNT = 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();

  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ── Navigation entre les pages ────────────────────────────────────────

  const goToStep = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(STEP_COUNT - 1, index));
    scrollRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
    setCurrentStep(clamped);
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / SCREEN_WIDTH);
    if (idx !== currentStep) setCurrentStep(idx);
  }, [currentStep]);

  // ── Step 1: langue ───────────────────────────────────────────────────

  const handlePickLanguage = useCallback(async (lang: Language) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedLang(lang);
    // Application immédiate: le reste de l'onboarding bascule dans la langue
    // choisie (les libellés français hardcodés ici resteraient en français,
    // mais c'est OK pour 3 écrans très courts).
    try {
      await setLanguage(lang);
    } catch {
      // Persistance best-effort, pas bloquant
    }
  }, [setLanguage]);

  // ── Step 2: géolocalisation ──────────────────────────────────────────

  const handleRequestLocation = useCallback(async () => {
    setRequestingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationGranted(granted);
      if (granted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast.success(
          t('onboarding.locationGranted') || 'Position activée',
          t('onboarding.locationGrantedHint') || 'On pourra vous proposer les épiceries proches'
        );
      } else {
        toast.info(
          t('onboarding.locationDenied') || 'Position refusée',
          t('onboarding.locationDeniedHint') || 'Vous pourrez chercher par nom ou adresse'
        );
      }
      // Avance automatiquement après ~700ms pour que l'utilisateur lise le toast.
      setTimeout(() => goToStep(currentStep + 1), 700);
    } catch (e) {
      console.warn('[onboarding] location request failed:', e);
      setLocationGranted(false);
    } finally {
      setRequestingLocation(false);
    }
  }, [currentStep, goToStep, t, toast]);

  // ── Step 3: catégories ───────────────────────────────────────────────

  const toggleCategory = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  // ── Finalisation ─────────────────────────────────────────────────────

  const finishOnboarding = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await clientOnboardingService.markCompleted({
        language: selectedLang,
        favoriteCategoryIds: selectedCategories,
        locationGranted: locationGranted ?? undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(client)');
    } catch (e) {
      console.warn('[onboarding] finish failed:', e);
      // On navigate quand même: bloquer l'utilisateur sur l'onboarding parce
      // que le storage a planté serait pire que perdre les préférences.
      router.replace('/(client)');
    }
  }, [finishing, locationGranted, router, selectedCategories, selectedLang]);

  const skipOnboarding = useCallback(async () => {
    // Skip = on marque comme done MAIS sans préférences
    // → l'app n'embêtera plus l'utilisateur, et la perso sera juste neutre.
    await clientOnboardingService.markCompleted({
      language: selectedLang,
    });
    router.replace('/(client)');
  }, [router, selectedLang]);

  const handleNext = useCallback(() => {
    if (currentStep < STEP_COUNT - 1) {
      Haptics.selectionAsync().catch(() => {});
      goToStep(currentStep + 1);
    } else {
      finishOnboarding();
    }
  }, [currentStep, finishOnboarding, goToStep]);

  // ── Rendu ────────────────────────────────────────────────────────────

  const isLastStep = currentStep === STEP_COUNT - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header: skip + progress dots */}
      <View style={styles.header}>
        <View style={styles.dots}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentStep && styles.dotActive,
                i < currentStep && styles.dotDone,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={skipOnboarding} style={styles.skipBtn} accessibilityRole="button">
          <Text style={styles.skipText}>{t('onboarding.skip') || 'Passer'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1 — Langue ─────────────────────────────────────────── */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Text style={styles.stepEmoji}>🌍</Text>
          <Text style={styles.title}>
            {t('onboarding.step1Title') || 'Choisissez votre langue'}
          </Text>
          <Text style={styles.subtitle}>
            {t('onboarding.step1Subtitle') || 'On vous proposera des produits dans votre langue préférée'}
          </Text>

          <View style={styles.langGrid}>
            {LANG_OPTIONS.map(opt => {
              const active = selectedLang === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  onPress={() => handlePickLanguage(opt.code)}
                  style={[styles.langCard, active && styles.langCardActive]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.langFlag}>{opt.flag}</Text>
                  <Text style={[styles.langNative, active && styles.langTextActive]}>
                    {opt.native}
                  </Text>
                  {active && (
                    <View style={styles.langCheck}>
                      <Ionicons name="checkmark" size={14} color={theme.colors.onBrand} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Step 2 — Géolocalisation ────────────────────────────────── */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Text style={styles.stepEmoji}>📍</Text>
          <Text style={styles.title}>
            {t('onboarding.step2Title') || 'Activez votre position'}
          </Text>
          <Text style={styles.subtitle}>
            {t('onboarding.step2Subtitle') || 'Pour trouver les épiceries proches de chez vous et calculer les frais de livraison'}
          </Text>

          <View style={styles.locationBenefits}>
            {[
              { icon: 'location', text: t('onboarding.benefit1') || 'Épiceries proches en 1 tap' },
              { icon: 'flash',    text: t('onboarding.benefit2') || 'Livraison plus rapide' },
              { icon: 'pricetag', text: t('onboarding.benefit3') || 'Promos géo-locales' },
            ].map((b, i) => (
              <View key={i} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon as any} size={16} color={theme.colors.brand} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {locationGranted === true ? (
            <View style={styles.locationStatus}>
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
              <Text style={styles.locationStatusText}>
                {t('onboarding.locationOk') || 'Position activée'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleRequestLocation}
              disabled={requestingLocation}
              style={[styles.primaryBtn, requestingLocation && styles.primaryBtnDisabled]}
              activeOpacity={0.85}
            >
              <Ionicons name="location" size={18} color={theme.colors.onBrand} />
              <Text style={styles.primaryBtnText}>
                {requestingLocation
                  ? (t('onboarding.requesting') || 'Demande en cours…')
                  : (t('onboarding.allowLocation') || 'Activer ma position')}
              </Text>
            </TouchableOpacity>
          )}

          {locationGranted === false && (
            <Text style={styles.subtleHint}>
              {t('onboarding.locationOptional') || 'Vous pourrez l\'activer plus tard depuis les paramètres.'}
            </Text>
          )}
        </View>

        {/* ── Step 3 — Catégories ─────────────────────────────────────── */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Text style={styles.stepEmoji}>🛒</Text>
          <Text style={styles.title}>
            {t('onboarding.step3Title') || 'Que cherchez-vous au quotidien ?'}
          </Text>
          <Text style={styles.subtitle}>
            {t('onboarding.step3Subtitle') || 'Sélectionnez vos catégories préférées (optionnel)'}
          </Text>

          <View style={styles.catGrid}>
            {CATEGORY_OPTIONS.map(opt => {
              const active = selectedCategories.includes(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => toggleCategory(opt.id)}
                  style={[styles.catCard, active && styles.catCardActive]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.catEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.catLabel, active && styles.catLabelActive]} numberOfLines={2}>
                    {opt.label}
                  </Text>
                  {active && (
                    <View style={styles.catCheck}>
                      <Ionicons name="checkmark" size={12} color={theme.colors.onBrand} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Footer: bouton principal */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          onPress={handleNext}
          disabled={finishing}
          style={[styles.cta, finishing && styles.primaryBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {isLastStep
              ? (t('onboarding.start') || 'Commencer')
              : (t('onboarding.next')  || 'Suivant')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.onBrand} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      width: 24,
      backgroundColor: theme.colors.brand,
    },
    dotDone: {
      backgroundColor: theme.colors.brandStrong,
    },
    skipBtn: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    skipText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textSecondary,
    },
    page: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      alignItems: 'center',
    },
    stepEmoji: {
      fontSize: 64,
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...theme.typography.titleLg,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      ...theme.typography.bodyLg,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },

    // ── Step 1: langues ────────────────────────────────
    langGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
      justifyContent: 'center',
    },
    langCard: {
      width: '47%',
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      gap: 8,
    },
    langCardActive: {
      borderColor: theme.colors.brand,
      backgroundColor: theme.colors.brandSubtle,
    },
    langFlag: {
      fontSize: 32,
    },
    langNative: {
      ...theme.typography.titleSm,
      color: theme.colors.textPrimary,
    },
    langTextActive: {
      color: theme.colors.brandStrong,
    },
    langCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Step 2: géoloc ─────────────────────────────────
    locationBenefits: {
      width: '100%',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
    },
    benefitIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.colors.brandSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitText: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.brand,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.pill,
    },
    primaryBtnDisabled: {
      opacity: 0.6,
    },
    primaryBtnText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.onBrand,
    },
    locationStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.successSubtle,
    },
    locationStatusText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.success,
    },
    subtleHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },

    // ── Step 3: catégories ─────────────────────────────
    catGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      justifyContent: 'space-between',
    },
    catCard: {
      width: '48%',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      gap: 6,
      minHeight: 88,
      justifyContent: 'center',
    },
    catCardActive: {
      borderColor: theme.colors.brand,
      backgroundColor: theme.colors.brandSubtle,
    },
    catEmoji: {
      fontSize: 28,
    },
    catLabel: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    catLabelActive: {
      color: theme.colors.brandStrong,
      fontWeight: '600',
    },
    catCheck: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Footer CTA ─────────────────────────────────────
    footer: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.brand,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.pill,
    },
    ctaText: {
      ...theme.typography.titleSm,
      color: theme.colors.onBrand,
    },
  });
}
