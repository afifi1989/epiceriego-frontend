import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { humanizeDuration, interpolate } from '../utils';

interface Props {
  targetIso: string;
  mode: 'endsIn' | 'startsIn' | 'endedAgo';
  small?: boolean;
}

/**
 * Petit compteur "expire dans 2h 15min" qui se rafraîchit toutes les minutes.
 */
export function PromoCountdown({ targetIso, mode, small = false }: Props) {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(targetIso).getTime();
  const diff = mode === 'endedAgo' ? now - target : target - now;
  const humanized = humanizeDuration(Math.max(0, diff));
  if (!humanized) return null;

  const key = mode === 'endsIn'
    ? 'promotions.list.endsIn'
    : mode === 'startsIn'
    ? 'promotions.list.startsIn'
    : 'promotions.list.endedAgo';

  const text = interpolate(t(key), { when: humanized });

  const urgent = mode === 'endsIn' && diff < 24 * 60 * 60_000;

  return (
    <View style={[styles.wrap, urgent && styles.urgent]}>
      <Text style={[styles.icon, small && { fontSize: 10 }]}>
        {mode === 'endedAgo' ? '🏁' : '⏰'}
      </Text>
      <Text style={[
        styles.text,
        urgent && { color: '#EF6C00' },
        small && { fontSize: 11 },
      ]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  urgent: {},
  icon: {
    fontSize: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
});
