import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { LoyaltyBalance } from '../types';
import { formatPoints, interpolate } from '../utils';

interface Props {
  balance: LoyaltyBalance;
  onPress: () => void;
}

/**
 * Ligne d'une épicerie dans la liste L1. Cliquable → ouvre L2.
 */
export function StoreLoyaltyCard({ balance, onPress }: Props) {
  const { t } = useLanguage();
  const programLabel = balance.programName
    ? interpolate(t('loyalty.programBadge'), { name: balance.programName })
    : null;
  const unit = balance.programType === 'STAMPS' ? t('loyalty.stamps') : t('loyalty.points');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🏪</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {balance.epicerieName ?? `#${balance.epicerieId}`}
        </Text>
        {programLabel ? (
          <Text style={styles.program} numberOfLines={1}>{programLabel}</Text>
        ) : null}
      </View>
      <View style={styles.balanceWrap}>
        <Text style={styles.balance}>{formatPoints(balance.balance)}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 14,
    marginHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  program: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  balanceWrap: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  balance: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4CAF50',
  },
  unit: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
  },
});
