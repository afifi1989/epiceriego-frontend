import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { LoyaltyBalance } from '../types';
import { formatPoints, interpolate } from '../utils';

interface Props {
  balance: LoyaltyBalance;
}

/**
 * Header pour l'écran détail épicerie (L2). Affiche solde en grand + nom programme.
 */
export function StoreHeader({ balance }: Props) {
  const { t } = useLanguage();
  const unit = balance.programType === 'STAMPS' ? t('loyalty.stamps') : t('loyalty.points');
  const programLabel = balance.programName
    ? interpolate(t('loyalty.programBadge'), { name: balance.programName })
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.gradientOverlay} />
      <Text style={styles.watermark}>⭐</Text>
      <Text style={styles.storeName} numberOfLines={1}>
        {balance.epicerieName ?? `#${balance.epicerieId}`}
      </Text>
      {programLabel ? <Text style={styles.program}>{programLabel}</Text> : null}
      <View style={styles.balanceWrap}>
        <Text style={styles.balance}>{formatPoints(balance.balance)}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: '#2E7D32',
    opacity: 0.3,
  },
  watermark: {
    position: 'absolute',
    right: -30,
    top: -30,
    fontSize: 180,
    opacity: 0.08,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  program: {
    fontSize: 12,
    color: '#E8F5E9',
    fontWeight: '600',
    marginTop: 2,
  },
  balanceWrap: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
  balance: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 54,
  },
  unit: {
    fontSize: 14,
    color: '#E8F5E9',
    fontWeight: '600',
    marginTop: -2,
  },
});
