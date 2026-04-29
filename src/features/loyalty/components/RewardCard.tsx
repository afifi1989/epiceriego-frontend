import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { LoyaltyReward } from '../types';
import { canAfford, formatPoints, interpolate, pointsMissing, progressRatio } from '../utils';
import { ProgressBar } from './ProgressBar';
import { RewardTypeBadge } from './RewardTypeBadge';

interface Props {
  reward: LoyaltyReward;
  balance: number;
  redeeming?: boolean;
  onRedeem: () => void;
}

/**
 * Card d'une récompense — 2 états visuels :
 *  - accessible : bg blanc + border vert + bouton "Échanger"
 *  - verrouillée : bg grisé + progress bar + "Il manque X pts"
 */
export function RewardCard({ reward, balance, redeeming, onRedeem }: Props) {
  const { t } = useLanguage();
  const affordable = canAfford(reward, balance);
  const missing = pointsMissing(reward, balance);
  const progress = progressRatio(reward, balance);

  const productName = reward.name || reward.productNameSnapshot || '';

  return (
    <View style={[styles.card, affordable ? styles.cardAvailable : styles.cardLocked]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, !affordable && styles.nameLocked]} numberOfLines={2}>
            {productName}
          </Text>
          {reward.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {reward.description}
            </Text>
          ) : null}
        </View>
        <RewardTypeBadge reward={reward} />
      </View>

      <View style={styles.footer}>
        <View style={styles.costRow}>
          <Text style={styles.star}>⭐</Text>
          <Text style={[styles.cost, !affordable && styles.costLocked]}>
            {interpolate(t('loyalty.rewards.pointsCost'), { n: formatPoints(reward.pointsCost) })}
          </Text>
        </View>

        {affordable ? (
          <TouchableOpacity
            style={styles.redeemBtn}
            onPress={onRedeem}
            disabled={redeeming}
            activeOpacity={0.7}
          >
            {redeeming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.redeemBtnText}>{t('loyalty.rewards.redeem')}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.lockedInfo}>
            <Text style={styles.lockedText}>
              {interpolate(t('loyalty.rewards.locked'), { n: formatPoints(missing) })}
            </Text>
            <ProgressBar ratio={progress} color="#9E9E9E" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardAvailable: {
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
  },
  cardLocked: {
    borderColor: '#ECEFF1',
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  nameLocked: {
    color: '#666',
  },
  description: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    marginTop: 12,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  star: {
    fontSize: 14,
    marginRight: 4,
  },
  cost: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F57C00',
  },
  costLocked: {
    color: '#9E9E9E',
  },
  redeemBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  redeemBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  lockedInfo: {
    gap: 6,
  },
  lockedText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
});
