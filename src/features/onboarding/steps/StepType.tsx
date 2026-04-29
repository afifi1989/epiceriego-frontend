/**
 * StepType — Étape 1 (obligatoire) : choix du type d'épicerie.
 *
 * À la sélection : PUT epicerie + POST step-type. Le wizard avance
 * automatiquement (handler appelé via onSelected du parent).
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { epicerieService } from '../../../services/epicerieService';
import { onboardingService } from '../../../services/onboardingService';
import { EPICERIE_TYPES } from '../types';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

export const StepType = forwardRef<StepHandle, StepProps>(
  function StepType({ epicerie, busy }, ref) {
    const [selectedType, setSelectedType] = useState<string | null>(
      epicerie.epicerieType ?? null,
    );

    useImperativeHandle(ref, () => ({
      async submit() {
        if (!selectedType) {
          Alert.alert('Choix requis', 'Sélectionnez un type d\'épicerie.');
          return false;
        }
        try {
          await epicerieService.updateMyEpicerie({ epicerieType: selectedType } as any);
          await onboardingService.completeStepType(epicerie.id);
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
          return false;
        }
      },
    }));

    return (
      <View style={styles.list}>
        {EPICERIE_TYPES.map(option => {
          const selected = selectedType === option.type;
          return (
            <Pressable
              key={option.type}
              onPress={() => setSelectedType(option.type)}
              disabled={busy}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && !selected && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                <Text style={styles.icon}>{option.icon}</Text>
              </View>

              <View style={styles.textCol}>
                <Text style={[styles.label, selected && styles.labelSelected]}>
                  {option.label}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {option.description}
                </Text>
              </View>

              <View style={[styles.check, selected && styles.checkSelected]}>
                {selected && <Text style={styles.checkGlyph}>✓</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  list: { gap: space.sm },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
  },
  cardPressed: { backgroundColor: colors.bg },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: '#fff' },
  icon: { fontSize: 26 },

  textCol: { flex: 1 },
  label: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 2,
  },
  labelSelected: { color: colors.primary },
  desc: {
    ...typography.caption,
    color: colors.textMuted,
  },

  check: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkGlyph: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
