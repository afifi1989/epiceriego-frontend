import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { formatPoints, interpolate } from '../utils';

interface Props {
  totalPoints: number;
  storesCount: number;
}

/**
 * Grande carte "hero" affichant le solde agrégé du client.
 * Gradient simulé en 2 couches + étoile filigrane en fond.
 */
export function PointsHeroCard({ totalPoints, storesCount }: Props) {
  const { t } = useLanguage();

  const storesLabel = storesCount <= 1
    ? t('loyalty.heroStoresOne')
    : interpolate(t('loyalty.heroStoresMany'), { n: storesCount });

  return (
    <View style={styles.card}>
      <View style={styles.gradientOverlay} />
      <Text style={styles.watermark}>⭐</Text>

      <View style={styles.content}>
        <Text style={styles.label}>{t('loyalty.heroTotal')}</Text>
        <Text style={styles.value}>{formatPoints(totalPoints)}</Text>
        <Text style={styles.sub}>{t('loyalty.heroPoints')}</Text>
        {storesCount > 0 && (
          <Text style={styles.storesCount}>{storesLabel}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    padding: 24,
    margin: 15,
    overflow: 'hidden',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    minHeight: 180,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: '#2E7D32',
    opacity: 0.35,
  },
  watermark: {
    position: 'absolute',
    right: -20,
    top: -20,
    fontSize: 180,
    opacity: 0.1,
  },
  content: {
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    color: '#E8F5E9',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
    lineHeight: 64,
  },
  sub: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
  },
  storesCount: {
    fontSize: 13,
    color: '#E8F5E9',
    marginTop: 12,
    fontWeight: '500',
  },
});
