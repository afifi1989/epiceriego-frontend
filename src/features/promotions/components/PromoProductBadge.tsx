import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { ActivePromotionSummary } from '../types';
import { interpolate } from '../utils';

interface Props {
  /** % calculé directement (prixBarre/prix) — fallback. */
  percentage?: number;
  /** Promo active complète — prioritaire, affiche titre + countdown si fourni. */
  promo?: ActivePromotionSummary | null;
  /** Plus petit pour liste compacte. */
  compact?: boolean;
}

/**
 * Badge promo affiché sur les cards de produits (client et épicier).
 *
 * Deux modes :
 *  - Simple : juste le %
 *  - Enrichi : %, titre de la promo, countdown si proche de l'expiration
 */
export function PromoProductBadge({ percentage, promo, compact = false }: Props) {
  const { t } = useLanguage();
  const pct = promo?.reductionPercentage ?? percentage ?? 0;
  if (pct <= 0) return null;

  const pctText = interpolate(t('promotions.badge.discount'), { n: Math.round(pct) });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.pill, compact && styles.pillCompact]}>
        <Text style={[styles.pctText, compact && styles.pctTextCompact]}>
          {pctText}
        </Text>
      </View>
      {promo?.titre && !compact ? (
        <Text style={styles.title} numberOfLines={1}>{promo.titre}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wrapCompact: {
    gap: 0,
  },
  pill: {
    backgroundColor: '#E53935',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  pillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pctText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  pctTextCompact: {
    fontSize: 11,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C62828',
    flex: 1,
  },
});
