import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EPICERIE_TYPES, EpicerieType } from '../../type';

export interface EpicerieDiscoverFiltersValue {
  radius: number;
  openOnly: boolean;
  type: EpicerieType | null;
}

interface EpicerieDiscoverFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  value: EpicerieDiscoverFiltersValue;
  onApply: (next: EpicerieDiscoverFiltersValue) => void;
  labels: {
    title: string;
    radiusTitle: string;
    radiusHint: string;
    openOnlyTitle: string;
    openOnlyHint: string;
    typeTitle: string;
    allTypes: string;
    reset: string;
    apply: string;
  };
  accentColor?: string;
}

/**
 * Bottom-sheet de filtres pour la découverte d'épiceries.
 *
 * Trois sections : rayon de recherche (km), "Ouvert maintenant" toggle, et
 * sélection du type de boutique (grille d'icônes). Gestion par brouillon
 * local — seuls les filtres validés via "Appliquer" remontent au parent.
 */
export const EpicerieDiscoverFiltersSheet: React.FC<EpicerieDiscoverFiltersSheetProps> = ({
  visible,
  onClose,
  value,
  onApply,
  labels,
  accentColor = '#4CAF50',
}) => {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<EpicerieDiscoverFiltersValue>(value);
  const [radiusInput, setRadiusInput] = useState(String(value.radius));

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setRadiusInput(String(value.radius));
    }
  }, [visible, value]);

  const apply = () => {
    const parsed = parseFloat(radiusInput);
    const cleanRadius = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
    onApply({ ...draft, radius: cleanRadius });
    onClose();
  };

  const reset = () => {
    setDraft({ radius: 5, openOnly: false, type: null });
    setRadiusInput('5');
  };

  const totalActive =
    (draft.openOnly ? 1 : 0) + (draft.type ? 1 : 0) + (draft.radius !== 5 ? 1 : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{labels.title}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Rayon ──────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.radiusTitle}</Text>
            <Text style={styles.sectionHint}>{labels.radiusHint}</Text>
            <View style={styles.radiusInputWrap}>
              <TextInput
                style={styles.radiusInput}
                value={radiusInput}
                onChangeText={setRadiusInput}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor="#aaa"
              />
              <Text style={styles.radiusUnit}>km</Text>
            </View>
            <View style={styles.presetsRow}>
              {[1, 3, 5, 10, 20].map((preset) => {
                const isActive = parseFloat(radiusInput) === preset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => setRadiusInput(String(preset))}
                    style={[
                      styles.presetChip,
                      isActive && { borderColor: accentColor, backgroundColor: accentColor + '15' },
                    ]}
                  >
                    <Text style={[styles.presetText, isActive && { color: accentColor, fontWeight: '800' }]}>
                      {preset} km
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Ouvert maintenant ──────────────────────── */}
          <View style={styles.section}>
            <View style={styles.openRow}>
              <View style={{ flex: 1, marginEnd: 12 }}>
                <Text style={styles.sectionTitle}>{labels.openOnlyTitle}</Text>
                <Text style={styles.sectionHint}>{labels.openOnlyHint}</Text>
              </View>
              <Switch
                value={draft.openOnly}
                onValueChange={(v) => setDraft((d) => ({ ...d, openOnly: v }))}
                trackColor={{ false: '#d4d4d4', true: accentColor + '99' }}
                thumbColor={draft.openOnly ? accentColor : '#f4f4f4'}
              />
            </View>
          </View>

          {/* ── Type d'épicerie ────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.typeTitle}</Text>
            <View style={styles.typesGrid}>
              <Pressable
                onPress={() => setDraft((d) => ({ ...d, type: null }))}
                style={[
                  styles.typeCell,
                  draft.type === null && { borderColor: accentColor, backgroundColor: accentColor + '15' },
                ]}
              >
                <Text style={styles.typeCellIcon}>🛍️</Text>
                <Text
                  style={[styles.typeCellLabel, draft.type === null && { color: accentColor, fontWeight: '800' }]}
                  numberOfLines={2}
                >
                  {labels.allTypes}
                </Text>
              </Pressable>
              {EPICERIE_TYPES.map((t) => {
                const isActive = draft.type === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setDraft((d) => ({ ...d, type: isActive ? null : t.value }))}
                    style={[
                      styles.typeCell,
                      isActive && { borderColor: accentColor, backgroundColor: accentColor + '15' },
                    ]}
                  >
                    <Text style={styles.typeCellIcon}>{t.icon}</Text>
                    <Text
                      style={[styles.typeCellLabel, isActive && { color: accentColor, fontWeight: '800' }]}
                      numberOfLines={2}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={reset}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.resetBtnText}>{labels.reset}</Text>
          </Pressable>
          <Pressable
            onPress={apply}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.applyBtnText}>
              {labels.apply}{totalActive > 0 ? ` (${totalActive})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#777',
    marginBottom: 12,
  },
  radiusInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  radiusInput: {
    flex: 1,
    backgroundColor: '#F4F4F4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F1F1F',
    fontWeight: '700',
  },
  radiusUnit: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
  },
  presetText: {
    fontSize: 12.5,
    color: '#444',
    fontWeight: '600',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCell: {
    width: '23.5%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  typeCellIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeCellLabel: {
    fontSize: 10,
    color: '#444',
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
    backgroundColor: '#FFFFFF',
  },
  resetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  applyBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
