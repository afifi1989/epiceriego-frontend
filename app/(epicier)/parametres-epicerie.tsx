/**
 * Paramètres détaillés de l'épicerie — réutilise les step components
 * de l'onboarding.
 *
 * Permet à l'épicier de revenir à tout moment sur une section,
 * notamment celles qu'il a "ignorées" pendant l'onboarding initial.
 *
 * Architecture :
 *  - Liste de cards par section (Localisation, Photos, Description,
 *    Horaires, Delivery, WhatsApp).
 *  - Tap sur une card → ouvre SettingsSectionModal qui héberge le
 *    step component approprié + bouton "Enregistrer".
 *  - Aucune duplication avec le wizard : exactement les mêmes step
 *    components sont utilisés.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { epicerieService } from '../../src/services/epicerieService';
import { geoService } from '../../src/services/geoService';
import type { Country, Epicerie } from '../../src/type';

import { SettingsSectionModal } from '../../src/features/onboarding/components/SettingsSectionModal';
import { StepLocation } from '../../src/features/onboarding/steps/StepLocation';
import { StepPhotos } from '../../src/features/onboarding/steps/StepPhotos';
import { StepDescription } from '../../src/features/onboarding/steps/StepDescription';
import { StepHours } from '../../src/features/onboarding/steps/StepHours';
import { StepDelivery } from '../../src/features/onboarding/steps/StepDelivery';
import { StepWhatsapp } from '../../src/features/onboarding/steps/StepWhatsapp';
import type { StepHandle } from '../../src/features/onboarding/steps/stepProps';

type SectionKey = 'LOCATION' | 'PHOTOS' | 'DESCRIPTION' | 'HOURS' | 'DELIVERY' | 'WHATSAPP';

interface SectionDef {
  key: SectionKey;
  icon: string;
  title: string;
  description: string;
}

const SECTIONS: SectionDef[] = [
  { key: 'LOCATION',    icon: '📍', title: 'Localisation',     description: 'Coordonnées GPS pour la livraison et la recherche' },
  { key: 'PHOTOS',      icon: '📸', title: 'Photos',           description: 'Logo et bannière de présentation' },
  { key: 'DESCRIPTION', icon: '✍️', title: 'Description',      description: 'Présentation publique et contact pro' },
  { key: 'HOURS',       icon: '🕐', title: 'Horaires',         description: 'Jours et heures d\'ouverture' },
  { key: 'DELIVERY',    icon: '🚚', title: 'Zones de livraison', description: 'Rayon GPS ou liste de quartiers' },
  { key: 'WHATSAPP',    icon: '💬', title: 'WhatsApp Business', description: 'Réception de commandes via WhatsApp' },
];

const SECTION_KEYS: readonly SectionKey[] = ['LOCATION', 'PHOTOS', 'DESCRIPTION', 'HOURS', 'DELIVERY', 'WHATSAPP'];

function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && (SECTION_KEYS as readonly string[]).includes(value);
}

export default function ParametresEpicerieScreen() {
  const router = useRouter();
  // Deep-link entry points (e.g. profil-epicerie's "🚚 Livraison" shortcut)
  // pass `?section=DELIVERY` to land directly inside the right config dialog.
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const stepRef = useRef<StepHandle>(null);

  // Open the requested section once the epicerie is loaded — opening before
  // would render the modal with empty data. Tracked via a ref so a manual
  // close inside the same session isn't undone by the same param.
  const sectionParamConsumed = useRef(false);
  useEffect(() => {
    if (sectionParamConsumed.current) return;
    if (!epicerie) return;
    if (isSectionKey(sectionParam)) {
      setOpenSection(sectionParam);
      sectionParamConsumed.current = true;
    }
  }, [epicerie, sectionParam]);

  const loadAll = useCallback(async () => {
    try {
      const ep = await epicerieService.getMyEpicerie();
      setEpicerie(ep);
      if (ep.country?.code) {
        const c = await geoService.getCountryByCode(ep.country.code).catch(() => null);
        setCountry(c ?? ep.country ?? null);
      } else {
        setCountry(ep.country ?? null);
      }
    } catch {
      // Le service notifie déjà — on garde l'état précédent.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Lecture des badges et résumés ----------------------------------

  const isFilled = (key: SectionKey): boolean => {
    if (!epicerie) return false;
    switch (key) {
      case 'LOCATION':    return epicerie.latitude != null && epicerie.longitude != null;
      case 'PHOTOS':      return !!epicerie.photoUrl || !!epicerie.presentationPhotoUrl;
      case 'DESCRIPTION': return !!epicerie.description?.trim() || !!epicerie.telephonePro;
      case 'HOURS':       return !!epicerie.horaires;
      case 'DELIVERY':
        // Toute combinaison valide compte comme "complète" :
        //   ZONES + au moins 1 zone définie, FLAT_RATE + flatDeliveryFee >= 0, ou NONE.
        if (epicerie.deliveryMode === 'NONE') return true;
        if (epicerie.deliveryMode === 'FLAT_RATE') {
          return epicerie.flatDeliveryFee != null && epicerie.flatDeliveryFee >= 0;
        }
        return !!epicerie.deliveryZones;
      case 'WHATSAPP':    return epicerie.whatsappEnabled === true;
    }
  };

  const summary = (key: SectionKey): string => {
    if (!epicerie) return '';
    switch (key) {
      case 'LOCATION':
        return isFilled('LOCATION')
          ? `${epicerie.latitude!.toFixed(4)}, ${epicerie.longitude!.toFixed(4)}`
          : 'Non renseignée';
      case 'PHOTOS': {
        const has = [epicerie.photoUrl, epicerie.presentationPhotoUrl].filter(Boolean).length;
        return has === 0 ? 'Aucune photo' : `${has}/2 photos ajoutées`;
      }
      case 'DESCRIPTION':
        if (epicerie.description?.trim()) {
          const t = epicerie.description.trim();
          return t.length > 50 ? t.slice(0, 49) + '…' : t;
        }
        return 'Aucune description';
      case 'HOURS':
        return epicerie.horaires ? 'Horaires configurés' : 'Non configurés';
      case 'DELIVERY':
        // Branche par mode : NONE / FLAT_RATE explicites, sinon comportement zones.
        if (epicerie.deliveryMode === 'NONE') return 'Pas de livraison (retrait uniquement)';
        if (epicerie.deliveryMode === 'FLAT_RATE') {
          if (epicerie.flatDeliveryFee == null) return 'Forfait à définir';
          const sym = epicerie.currency?.symbol ?? '';
          return `Forfait : ${epicerie.flatDeliveryFee} ${sym}`.trim();
        }
        if (!epicerie.deliveryZones) return 'Aucune zone définie';
        try {
          const parsed = JSON.parse(epicerie.deliveryZones);
          // Nouveau format : tableau de zones { name, deliveryFee, maxDistance, isActive }.
          if (Array.isArray(parsed)) {
            const active = parsed.filter((z: any) => z?.isActive !== false).length;
            return `${active} zone${active > 1 ? 's' : ''} active${active > 1 ? 's' : ''}`;
          }
          // Anciens formats objet — toléré le temps de la migration.
          if (parsed?.mode === 'RADIUS') return `Rayon ${parsed.radiusKm ?? '?'} km`;
          if (parsed?.mode === 'NEIGHBORHOODS') {
            const n = (parsed.neighborhoodIds ?? []).length;
            return `${n} quartier${n > 1 ? 's' : ''}`;
          }
          return 'Configuré';
        } catch { return 'Configuré'; }
      case 'WHATSAPP':
        return epicerie.whatsappEnabled ? 'Activé' : 'Désactivé';
    }
  };

  const sectionMeta = openSection
    ? SECTIONS.find(s => s.key === openSection)!
    : null;

  // Render section component dans le modal --------------------------

  const renderStep = () => {
    if (!epicerie || !openSection) return null;
    const stepProps = { epicerie, country, busy: false };
    switch (openSection) {
      case 'LOCATION':    return <StepLocation    ref={stepRef} {...stepProps} />;
      case 'PHOTOS':      return <StepPhotos      ref={stepRef} {...stepProps} />;
      case 'DESCRIPTION': return <StepDescription ref={stepRef} {...stepProps} />;
      case 'HOURS':       return <StepHours       ref={stepRef} {...stepProps} />;
      case 'DELIVERY':    return <StepDelivery    ref={stepRef} {...stepProps} />;
      case 'WHATSAPP':    return <StepWhatsapp    ref={stepRef} {...stepProps} />;
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Paramètres épicerie' }} />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Paramètres épicerie' }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>⚙️ Paramètres de l'épicerie</Text>
          <Text style={styles.headerSubtitle}>
            Modifiez les informations de votre boutique. Chaque section
            peut être complétée ou ajustée à tout moment.
          </Text>
        </View>

        {SECTIONS.map(s => {
          const filled = isFilled(s.key);
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.card, filled && styles.cardFilled]}
              onPress={() => setOpenSection(s.key)}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconWrapper}>
                <Text style={styles.cardIcon}>{s.icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <View style={[styles.badge, filled && styles.badgeFilled]}>
                    <Text style={styles.badgeText}>{filled ? '✓' : '!'}</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>{s.description}</Text>
                <Text style={[styles.cardSummary, !filled && styles.cardSummaryEmpty]}>
                  {summary(s.key)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Modal d'édition partagé (réutilise les step components) ── */}
      {epicerie && sectionMeta && (
        <SettingsSectionModal
          visible={openSection !== null}
          title={sectionMeta.title}
          icon={sectionMeta.icon}
          subtitle={sectionMeta.description}
          stepRef={stepRef}
          onClose={() => setOpenSection(null)}
          onSaved={loadAll}
        >
          {renderStep()}
        </SettingsSectionModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },

  headerBlock: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9aa3ad',
    lineHeight: 19,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
  },
  cardFilled: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  cardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: { fontSize: 22 },

  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#FFB300',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFilled: { backgroundColor: '#4CAF50' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  cardDesc: {
    fontSize: 12,
    color: '#9aa3ad',
    marginBottom: 4,
    lineHeight: 16,
  },
  cardSummary: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  cardSummaryEmpty: {
    color: '#9aa3ad',
    fontStyle: 'italic',
    fontWeight: '400',
  },

  chevron: {
    fontSize: 24,
    color: '#cbd5e0',
    alignSelf: 'center',
    marginLeft: 4,
  },
});
