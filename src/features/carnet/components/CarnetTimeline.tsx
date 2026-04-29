/**
 * CarnetTimeline — Liste chronologique des transactions du carnet
 * Affiche factures, paiements et avances avec solde cumulé
 */

import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CarnetTransaction, TRANSACTION_CONFIG } from '../types';

interface Props {
  transactions: CarnetTransaction[];
  hasMore: boolean;
  onLoadMore: () => void;
  loading?: boolean;
}

export function CarnetTimeline({ transactions, hasMore, onLoadMore, loading }: Props) {
  if (transactions.length === 0 && !loading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📒</Text>
        <Text style={styles.emptyText}>Aucune transaction</Text>
        <Text style={styles.emptyHint}>Les achats et paiements apparaîtront ici</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📒 Carnet</Text>

      {transactions.map((tx, idx) => {
        const config = TRANSACTION_CONFIG[tx.type] ?? TRANSACTION_CONFIG.INVOICE;
        const amount = tx.debit > 0 ? tx.debit : tx.credit;
        const dateStr = formatDate(tx.date);
        const showDateHeader = idx === 0 || formatDate(transactions[idx - 1].date) !== dateStr;

        return (
          <View key={tx.id}>
            {showDateHeader && (
              <Text style={styles.dateHeader}>{dateStr}</Text>
            )}
            <View style={[styles.row, idx === transactions.length - 1 && styles.rowLast]}>
              {/* Ligne verticale */}
              <View style={styles.lineColumn}>
                <View style={[styles.dot, { backgroundColor: config.color }]} />
                {idx < transactions.length - 1 && <View style={styles.line} />}
              </View>

              {/* Contenu */}
              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={styles.icon}>{config.icon}</Text>
                  <View style={styles.descBox}>
                    <Text style={styles.description}>{tx.description}</Text>
                    {tx.reference && <Text style={styles.reference}>{tx.reference}</Text>}
                  </View>
                  <Text style={[styles.amount, { color: config.color }]}>
                    {config.sign}{amount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.bottomRow}>
                  <Text style={styles.time}>{formatTime(tx.date)}</Text>
                  {tx.status === 'UNPAID' && (
                    <View style={styles.unpaidBadge}>
                      <Text style={styles.unpaidText}>Impayé</Text>
                    </View>
                  )}
                  <Text style={styles.balance}>
                    Solde: {tx.runningBalance.toFixed(2)} DH
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}

      {hasMore && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={onLoadMore} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Text style={styles.loadMoreText}>Charger plus...</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 12, paddingTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 12, marginLeft: 4 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#555' },
  emptyHint: { fontSize: 13, color: '#999', marginTop: 4 },

  dateHeader: {
    fontSize: 12, fontWeight: '700', color: '#999', marginTop: 12, marginBottom: 6, marginLeft: 28,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  row: { flexDirection: 'row', marginBottom: 2 },
  rowLast: { marginBottom: 0 },

  lineColumn: { width: 24, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  line: { width: 2, flex: 1, backgroundColor: '#e0e0e0', marginTop: 2 },

  content: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10,
    marginLeft: 6, marginBottom: 6,
    borderWidth: 1, borderColor: '#f0f0f0',
  },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  icon: { fontSize: 16, marginTop: 1 },
  descBox: { flex: 1 },
  description: { fontSize: 14, fontWeight: '600', color: '#333' },
  reference: { fontSize: 11, color: '#999', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  time: { fontSize: 11, color: '#bbb' },
  unpaidBadge: { backgroundColor: '#ffebee', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unpaidText: { fontSize: 10, fontWeight: '700', color: '#e53935' },
  balance: { fontSize: 11, color: '#999', marginLeft: 'auto' },

  loadMoreBtn: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: '#2196F3' },
});
