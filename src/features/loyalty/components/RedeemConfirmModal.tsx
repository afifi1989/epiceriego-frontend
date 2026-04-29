import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { LoyaltyReward } from '../types';
import { formatPoints, interpolate } from '../utils';
import { RewardTypeBadge } from './RewardTypeBadge';

interface Props {
  visible: boolean;
  reward: LoyaltyReward | null;
  balance: number;
  redeeming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmation d'échange. Double confirmation pour éviter les
 * rédemptions accidentelles — l'échange consomme des points !
 */
export function RedeemConfirmModal({ visible, reward, balance, redeeming, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();

  if (!reward) return null;

  const newBalance = Math.max(0, balance - reward.pointsCost);
  const name = reward.name || reward.productNameSnapshot || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={redeeming ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('loyalty.rewards.confirmTitle')}</Text>

          <View style={styles.rewardBox}>
            <Text style={styles.rewardName}>{name}</Text>
            <RewardTypeBadge reward={reward} />
          </View>

          <Text style={styles.body}>
            {interpolate(t('loyalty.rewards.confirmBody'), {
              cost: formatPoints(reward.pointsCost),
              name,
            })}
          </Text>

          <View style={styles.balanceRow}>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Actuel</Text>
              <Text style={styles.balanceValue}>{formatPoints(balance)}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Après</Text>
              <Text style={[styles.balanceValue, { color: '#F57C00' }]}>
                {formatPoints(newBalance)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={onCancel}
              disabled={redeeming}
              activeOpacity={0.7}
            >
              <Text style={styles.btnCancelText}>{t('loyalty.rewards.confirmNo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnConfirm]}
              onPress={onConfirm}
              disabled={redeeming}
              activeOpacity={0.7}
            >
              {redeeming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnConfirmText}>{t('loyalty.rewards.confirmYes')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
  },
  rewardBox: {
    backgroundColor: '#F9FBFC',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  rewardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#555',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 18,
    paddingVertical: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  balanceCol: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4CAF50',
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F5F5F5',
  },
  btnCancelText: {
    color: '#555',
    fontWeight: '700',
    fontSize: 14,
  },
  btnConfirm: {
    backgroundColor: '#4CAF50',
  },
  btnConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
