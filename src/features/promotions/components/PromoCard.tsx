import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { Promotion } from '../types';
import { computeStatus, interpolate, statusColor } from '../utils';
import { PromoCountdown } from './PromoCountdown';
import { PromoStatusBadge } from './PromoStatusBadge';

interface Props {
  promo: Promotion;
  onPress: () => void;
}

/**
 * Card principale d'une promotion dans la liste épicier. Design pro :
 * - bord coloré selon statut
 * - % de réduction en gros à droite (hero)
 * - compteur temps restant (rouge si urgent)
 * - impact count
 * - cibles résumées
 */
export function PromoCard({ promo, onPress }: Props) {
  const { t } = useLanguage();
  const status = computeStatus(promo);
  const color = statusColor(status);

  const impactLabel = promo.impactedUnitsCount != null && promo.impactedUnitsCount > 0
    ? interpolate(
        t(promo.impactedUnitsCount === 1
          ? 'promotions.list.impactCount'
          : 'promotions.list.impactCountPlural'),
        { n: promo.impactedUnitsCount }
      )
    : null;

  const targetsLabel = buildTargetsLabel(promo, t);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.title} numberOfLines={2}>{promo.titre}</Text>
          {targetsLabel ? (
            <Text style={styles.target} numberOfLines={1}>{targetsLabel}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <PromoStatusBadge status={status} small />
            {status === 'ACTIVE' && (
              <PromoCountdown targetIso={promo.dateFin} mode="endsIn" small />
            )}
            {status === 'SCHEDULED' && (
              <PromoCountdown targetIso={promo.dateDebut} mode="startsIn" small />
            )}
          </View>
          {impactLabel ? (
            <Text style={styles.impact}>📦 {impactLabel}</Text>
          ) : null}
        </View>

        <View style={[styles.pctWrap, { backgroundColor: `${color}15` }]}>
          <Text style={[styles.pct, { color }]}>
            −{Math.round(promo.reductionPercentage)}
          </Text>
          <Text style={[styles.pctSuffix, { color }]}>%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function buildTargetsLabel(promo: Promotion, t: (k: string) => string): string | null {
  const type = promo.targetType;
  if (!type) return null;
  if (type === 'ALL') return t('promotions.wizard.targetAll');
  const names = (promo.targets ?? []).map(x => x.displayName).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length <= 2) return names.join(' • ');
  return `${names[0]} +${names.length - 1}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 6,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222',
  },
  target: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  impact: {
    fontSize: 12,
    color: '#555',
    marginTop: 6,
    fontWeight: '600',
  },
  pctWrap: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 72,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pct: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  pctSuffix: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 2,
    marginTop: 4,
  },
});
