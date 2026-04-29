import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { PromoStatus } from '../types';
import { statusBackground, statusColor, statusEmoji } from '../utils';

interface Props {
  status: PromoStatus;
  small?: boolean;
}

export function PromoStatusBadge({ status, small = false }: Props) {
  const { t } = useLanguage();
  const color = statusColor(status);
  const bg = statusBackground(status);
  const label = t(`promotions.status.${status}`);

  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small]}>
      <Text style={[styles.emoji, small && { fontSize: 10 }]}>{statusEmoji(status)}</Text>
      <Text style={[styles.label, { color }, small && { fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    gap: 4,
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
