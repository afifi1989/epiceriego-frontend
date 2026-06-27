import { Colors } from '../../../constants/colors';
/**
 * CarnetHeader — En-tête du carnet : avatar, nom, email, solde, badge crédit
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CarnetResponse } from '../types';

const BLUE = Colors.primary;

interface Props {
  carnet: CarnetResponse;
}

export function CarnetHeader({ carnet }: Props) {
  const initial = (carnet.clientName ?? '?')[0].toUpperCase();
  const balance = carnet.balanceDue;
  const balanceColor = balance > 0 ? '#e53935' : balance < 0 ? '#388E3C' : '#757575';

  // Show whichever contact info is available — for virtual clients an email
  // is often missing but the phone usually isn't.
  const subtitle = carnet.clientEmail?.trim() || carnet.clientPhone?.trim() || '';

  return (
    <View style={styles.container}>
      <View style={[styles.avatar, carnet.clientIsVirtual && styles.avatarVirtual]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{carnet.clientName}</Text>
          {carnet.clientIsVirtual && (
            <View style={styles.virtualBadge}>
              <Text style={styles.virtualBadgeText}>CARNET</Text>
            </View>
          )}
        </View>
        {subtitle.length > 0 && (
          <Text style={styles.email} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      <View style={styles.balanceBox}>
        <Text style={styles.balanceLabel}>Solde</Text>
        <Text style={[styles.balanceValue, { color: balanceColor }]}>
          {balance.toFixed(2)} DH
        </Text>
        {carnet.allowCredit && (
          <View style={[styles.creditBadge, carnet.creditUsedPct >= 80 ? styles.creditBadgeWarn : null]}>
            <Text style={styles.creditBadgeText}>
              Crédit {carnet.creditUsedPct}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarVirtual: {
    backgroundColor: '#FF9800',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  info: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 17, fontWeight: '700', color: '#222', flexShrink: 1 },
  virtualBadge: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  virtualBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#e65100',
    letterSpacing: 0.5,
  },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  balanceBox: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 11, color: '#999', fontWeight: '600' },
  balanceValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  creditBadge: {
    marginTop: 4, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, backgroundColor: '#e3f2fd',
  },
  creditBadgeWarn: { backgroundColor: '#fff3e0' },
  creditBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE },
});
