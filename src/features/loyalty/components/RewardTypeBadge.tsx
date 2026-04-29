import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { LoyaltyReward } from '../types';
import { interpolate, rewardTypeKey, rewardTypeValue } from '../utils';

interface Props {
  reward: LoyaltyReward;
}

/**
 * Pill affichant le type d'avantage : −10 DH / −15% / 🎁 Gratuit.
 */
export function RewardTypeBadge({ reward }: Props) {
  const { t } = useLanguage();
  const key = rewardTypeKey(reward);
  const value = rewardTypeValue(reward);
  const label = value !== null
    ? interpolate(t(`loyalty.rewardType.${key}`), { n: value })
    : t(`loyalty.rewardType.${key}`);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F57C00',
  },
});
