/**
 * StepHours — Étape "Horaires d'ouverture" du wizard.
 *
 * Format JSON serialisé sur Epicerie.horaires (clés FR attendues par le
 * backend, cf. ShopHoursManager.tsx aussi) :
 *   {
 *     "lundi":    { "isOpen": true,  "openTime": "08:00", "closeTime": "20:00" },
 *     "mardi":    { ... },
 *     ...
 *     "dimanche": { "isOpen": false, "openTime": "00:00", "closeTime": "00:00" }
 *   }
 *
 * Aligné sur HorairesUtil backend pour ne casser ni l'affichage public
 * "ouvert maintenant", ni la logique getHoursUntilClosing.
 *
 * Helpers UX :
 *  - Toggle ouvert/fermé par jour
 *  - Input HH:MM avec masque
 *  - "Appliquer cet horaire à tous les jours ouvrés" : raccourci très
 *    fréquent (lundi-vendredi identiques)
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { epicerieService } from '../../../services/epicerieService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

const DAYS = [
  { key: 'lundi',    label: 'Lundi' },
  { key: 'mardi',    label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi',    label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi',   label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
] as const;

type DayKey = typeof DAYS[number]['key'];

interface DaySchedule {
  isOpen: boolean;
  openTime: string;   // "HH:MM"
  closeTime: string;
}

type Schedule = Record<DayKey, DaySchedule>;

const DEFAULT_SCHEDULE: Schedule = {
  lundi:    { isOpen: true,  openTime: '08:00', closeTime: '20:00' },
  mardi:    { isOpen: true,  openTime: '08:00', closeTime: '20:00' },
  mercredi: { isOpen: true,  openTime: '08:00', closeTime: '20:00' },
  jeudi:    { isOpen: true,  openTime: '08:00', closeTime: '20:00' },
  vendredi: { isOpen: true,  openTime: '08:00', closeTime: '20:00' },
  samedi:   { isOpen: true,  openTime: '08:00', closeTime: '20:00' },
  dimanche: { isOpen: false, openTime: '00:00', closeTime: '00:00' },
};

export const StepHours = forwardRef<StepHandle, StepProps>(
  function StepHours({ epicerie, busy }, ref) {
    const [schedule, setSchedule] = useState<Schedule>(
      () => parseSchedule(epicerie.horaires) ?? DEFAULT_SCHEDULE,
    );

    const updateDay = (day: DayKey, patch: Partial<DaySchedule>) => {
      setSchedule(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    };

    const applyToWorkdays = (sourceDay: DayKey) => {
      const source = schedule[sourceDay];
      const workdays: DayKey[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
      setSchedule(prev => {
        const next = { ...prev };
        workdays.forEach(d => { next[d] = { ...source }; });
        return next;
      });
    };

    useImperativeHandle(ref, () => ({
      async submit() {
        // Validation : tous les jours "ouverts" doivent avoir un format
        // HH:MM valide et open < close.
        for (const { key, label } of DAYS) {
          const day = schedule[key];
          if (!day.isOpen) continue;
          if (!isValidTime(day.openTime) || !isValidTime(day.closeTime)) {
            Alert.alert('Format invalide', `Heure invalide pour ${label} (HH:MM attendu).`);
            return false;
          }
          if (day.openTime >= day.closeTime) {
            Alert.alert('Plage incohérente',
              `${label} : l'heure d'ouverture doit être avant l'heure de fermeture.`);
            return false;
          }
        }
        try {
          await epicerieService.updateMyEpicerie({
            horaires: JSON.stringify(schedule),
          });
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
          return false;
        }
      },
    }));

    return (
      <View>
        {DAYS.map(({ key, label }, idx) => {
          const day = schedule[key];
          return (
            <View key={key} style={styles.dayRow}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{label}</Text>
                <Switch
                  value={day.isOpen}
                  onValueChange={(v) => updateDay(key, { isOpen: v })}
                  trackColor={{ false: colors.border, true: '#A7F3D0' }}
                  thumbColor={day.isOpen ? colors.success : '#f4f4f4'}
                  disabled={busy}
                />
              </View>

              {day.isOpen ? (
                <View style={styles.timesRow}>
                  <TimeInput
                    value={day.openTime}
                    onChange={(v) => updateDay(key, { openTime: v })}
                    label="Ouverture"
                    disabled={busy}
                  />
                  <Text style={styles.timesSeparator}>→</Text>
                  <TimeInput
                    value={day.closeTime}
                    onChange={(v) => updateDay(key, { closeTime: v })}
                    label="Fermeture"
                    disabled={busy}
                  />
                </View>
              ) : (
                <Text style={styles.closedText}>Fermé ce jour</Text>
              )}

              {idx === 0 && day.isOpen && (
                <TouchableOpacity
                  style={styles.applyAllBtn}
                  onPress={() => applyToWorkdays('lundi')}
                  disabled={busy}
                >
                  <Text style={styles.applyAllText}>
                    📋 Appliquer ces horaires à tous les jours ouvrés
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  }
);

interface TimeInputProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled: boolean;
}

function TimeInput({ value, onChange, label, disabled }: TimeInputProps) {
  return (
    <View style={styles.timeBox}>
      <Text style={styles.timeLabel}>{label}</Text>
      <TextInput
        style={styles.timeInput}
        value={value}
        onChangeText={(text) => onChange(formatTimeInput(text))}
        placeholder="HH:MM"
        placeholderTextColor="#9aa3ad"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        editable={!disabled}
      />
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function parseSchedule(json?: string): Schedule | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Schedule;
    // Garde-fou : s'assurer que tous les jours sont présents.
    for (const { key } of DAYS) {
      if (!parsed[key]) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Auto-formatte l'input pour insérer le ":" après 2 chiffres.
 * Permet à l'utilisateur de taper "0830" → "08:30" sans effort.
 */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

const styles = StyleSheet.create({
  dayRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.sm + 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: space.sm + 2,
  },
  timesSeparator: {
    fontSize: 18,
    color: colors.textSubtle,
    marginBottom: 12,
  },
  timeBox: {
    flex: 1,
  },
  timeLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 4,
    marginLeft: 2,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  closedText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
    marginLeft: 2,
  },
  applyAllBtn: {
    marginTop: space.sm + 2,
    paddingVertical: 8,
  },
  applyAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});
