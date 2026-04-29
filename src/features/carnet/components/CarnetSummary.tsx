/**
 * CarnetSummary — 4 cartes résumé financier : Dû, Avances, Solde net, Crédit utilisé
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CarnetResponse } from '../types';

interface Props {
  carnet: CarnetResponse;
}

export function CarnetSummary({ carnet }: Props) {
  const cards = [
    { label: 'Total dû', value: carnet.totalDebt, color: '#e53935', bg: '#ffebee', icon: '📋' },
    { label: 'Avances', value: carnet.totalAdvances, color: '#388E3C', bg: '#e8f5e9', icon: '💰' },
    { label: 'Solde net', value: carnet.balanceDue, color: carnet.balanceDue > 0 ? '#e53935' : '#388E3C', bg: carnet.balanceDue > 0 ? '#ffebee' : '#e8f5e9', icon: '📊' },
    { label: 'Total achats', value: carnet.totalPurchases, color: '#1565C0', bg: '#e3f2fd', icon: '🛒' },
  ];

  return (
    <View style={styles.container}>
      {cards.map((card, i) => (
        <View key={i} style={[styles.card, { backgroundColor: card.bg }]}>
          <Text style={styles.icon}>{card.icon}</Text>
          <Text style={[styles.value, { color: card.color }]}>
            {card.value.toFixed(2)}
          </Text>
          <Text style={styles.unit}>DH</Text>
          <Text style={styles.label}>{card.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  icon: { fontSize: 18, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '800' },
  unit: { fontSize: 11, color: '#888', fontWeight: '600', marginTop: -2 },
  label: { fontSize: 11, color: '#666', fontWeight: '600', marginTop: 4 },
});
