import { Colors } from '../../../constants/colors';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { DATE_SHORTCUTS } from '../utils';

interface Props {
  onApply: (start: string, end: string) => void;
}

/**
 * Raccourcis rapides : "Ce week-end", "Cette semaine", "3 jours", "Ce mois".
 */
export function DateShortcutsRow({ onApply }: Props) {
  const { t } = useLanguage();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wrap}
    >
      {DATE_SHORTCUTS.map(s => (
        <TouchableOpacity
          key={s.key}
          style={styles.chip}
          onPress={() => {
            const { start, end } = s.compute();
            onApply(start.toISOString(), end.toISOString());
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.chipText}>{t(s.labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '700',
  },
});
