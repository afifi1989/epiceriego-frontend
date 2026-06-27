import { Colors } from '../../../constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { PromoTargetType } from '../types';

interface Props {
  value: PromoTargetType;
  onChange: (v: PromoTargetType) => void;
}

interface Option {
  key: PromoTargetType;
  emoji: string;
  titleKey: string;
  subtitleKey: string;
}

const OPTIONS: Option[] = [
  { key: 'ALL',      emoji: '🏪', titleKey: 'promotions.wizard.targetAll',       subtitleKey: 'promotions.wizard.targetAllSub' },
  { key: 'CATEGORY', emoji: '📁', titleKey: 'promotions.wizard.targetCategory',  subtitleKey: 'promotions.wizard.targetCategorySub' },
  { key: 'PRODUCT',  emoji: '🍎', titleKey: 'promotions.wizard.targetProduct',   subtitleKey: 'promotions.wizard.targetProductSub' },
  { key: 'UNIT',     emoji: '🏷️', titleKey: 'promotions.wizard.targetUnit',      subtitleKey: 'promotions.wizard.targetUnitSub' },
];

export function TargetTypePicker({ value, onChange }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      {OPTIONS.map(opt => {
        const selected = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.emoji}>{opt.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, selected && styles.titleSelected]}>
                {t(opt.titleKey)}
              </Text>
              <Text style={styles.subtitle}>{t(opt.subtitleKey)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#E3F2FD',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  emoji: {
    fontSize: 26,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  titleSelected: {
    color: '#0D47A1',
  },
  subtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
});
