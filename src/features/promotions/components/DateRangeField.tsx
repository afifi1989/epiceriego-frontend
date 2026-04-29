import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useLanguage } from '../../../context/LanguageContext';
import { formatShortDate } from '../utils';

interface Props {
  startIso: string;
  endIso: string;
  onChange: (start: string, end: string) => void;
}

/**
 * Champ paire de dates "Du … au …" avec modal datetime picker.
 */
export function DateRangeField({ startIso, endIso, onChange }: Props) {
  const { t } = useLanguage();
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const startDate = safeParse(startIso);
  const endDate = safeParse(endIso);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setShowStart(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>{t('promotions.wizard.dateDebut')}</Text>
        <Text style={styles.value}>{formatShortDate(startIso)}</Text>
      </TouchableOpacity>

      <Text style={styles.sep}>→</Text>

      <TouchableOpacity
        style={styles.field}
        onPress={() => setShowEnd(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>{t('promotions.wizard.dateFin')}</Text>
        <Text style={styles.value}>{formatShortDate(endIso)}</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={showStart}
        mode="date"
        date={startDate}
        onConfirm={(d) => {
          setShowStart(false);
          const newStart = d.toISOString();
          const newEnd = endDate.getTime() <= d.getTime()
            ? new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString()
            : endIso;
          onChange(newStart, newEnd);
        }}
        onCancel={() => setShowStart(false)}
      />
      <DateTimePickerModal
        isVisible={showEnd}
        mode="date"
        date={endDate}
        minimumDate={startDate}
        onConfirm={(d) => {
          setShowEnd(false);
          onChange(startIso, d.toISOString());
        }}
        onCancel={() => setShowEnd(false)}
      />
    </View>
  );
}

function safeParse(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  field: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  label: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 15,
    color: '#333',
    fontWeight: '700',
    marginTop: 3,
  },
  sep: {
    fontSize: 20,
    color: '#999',
  },
});
