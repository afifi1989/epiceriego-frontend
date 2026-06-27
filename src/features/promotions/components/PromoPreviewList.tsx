import { Colors } from '../../../constants/colors';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { PromotionPreview } from '../types';
import { formatDH, interpolate } from '../utils';

interface Props {
  preview: PromotionPreview | null;
  loading: boolean;
  error?: string | null;
}

/**
 * Affiche le résultat d'une prévisualisation : nombre d'unités, économie
 * moyenne, conflits potentiels, et un échantillon de 50 unités max.
 */
export function PromoPreviewList({ preview, loading, error }: Props) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loading}>{t('promotions.wizard.previewLoading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!preview) return null;

  if (preview.totalUnits === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={styles.empty}>{t('promotions.wizard.previewEmpty')}</Text>
      </View>
    );
  }

  const subtitleKey = preview.totalUnits === 1
    ? 'promotions.wizard.previewSubtitle'
    : 'promotions.wizard.previewSubtitlePlural';

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>
          {interpolate(t(subtitleKey), { n: preview.totalUnits })}
        </Text>
        <Text style={styles.saving}>
          {interpolate(t('promotions.wizard.previewAvgSaving'), {
            n: preview.avgSavingPerUnit.toFixed(2),
          })}
        </Text>
        {preview.unitsAlreadyUnderPromo > 0 && (
          <Text style={styles.conflict}>
            ⚠️ {interpolate(t('promotions.wizard.previewConflict'), {
              n: preview.unitsAlreadyUnderPromo,
            })}
          </Text>
        )}
      </View>

      <View style={styles.list}>
        {preview.unitsSample.map((u, idx) => (
          <View key={u.unitId} style={[styles.row, idx > 0 && styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={1}>
                {u.productName}
              </Text>
              <Text style={styles.unitLabel}>{u.unitLabel}</Text>
            </View>
            <View style={styles.prices}>
              <Text style={styles.oldPrice}>{formatDH(u.currentPrix)}</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.newPrice}>{formatDH(u.projectedPrix)}</Text>
            </View>
          </View>
        ))}
      </View>

      {preview.totalUnits > preview.unitsSample.length && (
        <Text style={styles.more}>
          … +{preview.totalUnits - preview.unitsSample.length}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  loading: { marginTop: 10, color: '#666', fontSize: 13 },
  errorEmoji: { fontSize: 36, marginBottom: 8 },
  error: { fontSize: 14, color: '#C62828', textAlign: 'center' },
  emoji: { fontSize: 40, opacity: 0.5, marginBottom: 10 },
  empty: { fontSize: 14, color: '#666', textAlign: 'center' },

  header: { marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: '#222' },
  saving: {
    marginTop: 4,
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  conflict: {
    marginTop: 6,
    fontSize: 12,
    color: '#EF6C00',
    fontWeight: '600',
  },

  list: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  unitLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
  prices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  oldPrice: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: 13,
    color: '#bbb',
  },
  newPrice: {
    fontSize: 14,
    color: '#E53935',
    fontWeight: '800',
  },
  more: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: '#999',
  },
});
