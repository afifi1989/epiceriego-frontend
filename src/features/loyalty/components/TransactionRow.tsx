import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { LoyaltyTransaction } from '../types';
import { formatPoints, formatTxDate, interpolate, txColor, txIcon, txLabelKey, txSign } from '../utils';

interface Props {
  tx: LoyaltyTransaction;
}

/**
 * Ligne d'historique — icône + label + date + points signés.
 */
export function TransactionRow({ tx }: Props) {
  const { t } = useLanguage();
  const kind = tx.transactionType;
  const color = txColor(kind);
  const sign = txSign(kind);
  const absPoints = Math.abs(tx.points);
  const label = tx.description ?? t(txLabelKey(kind));

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}1A` }]}>
        <Text style={styles.icon}>{txIcon(kind)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <Text style={styles.date}>{formatTxDate(tx.createdAt)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.points, { color }]}>
          {sign}{formatPoints(absPoints)}
        </Text>
        <Text style={styles.balance}>
          {interpolate(t('loyalty.history.balanceAfter'), { n: formatPoints(tx.balanceAfter) })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  points: {
    fontSize: 15,
    fontWeight: '800',
  },
  balance: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
