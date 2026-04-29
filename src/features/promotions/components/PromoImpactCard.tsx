import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { PromotionImpact } from '../types';
import { interpolate } from '../utils';

interface Props {
  impact: PromotionImpact;
}

/**
 * Card "Impact" affichée sur l'écran détail d'une promo active :
 * grand chiffre d'unités impactées + total d'économies offertes aux clients.
 */
export function PromoImpactCard({ impact }: Props) {
  const { t } = useLanguage();
  const countLabel = interpolate(
    t(impact.activeUnitsCount === 1
      ? 'promotions.detail.nUnitsAffected'
      : 'promotions.detail.nUnitsAffectedPlural'),
    { n: impact.activeUnitsCount }
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.icon}>📦</Text>
        <Text style={styles.countLabel}>{countLabel}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.icon}>💰</Text>
        <Text style={styles.savings}>
          {interpolate(t('promotions.detail.totalSavings'), {
            amount: impact.totalSavingsGiven.toFixed(2),
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E3F2FD',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 15,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 22,
  },
  countLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
  },
  savings: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  divider: {
    height: 1,
    backgroundColor: '#BBDEFB',
    marginVertical: 10,
  },
});
