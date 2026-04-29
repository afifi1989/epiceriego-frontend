import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import type { PromoListTab } from '../types';
import type { Stats } from '../hooks/usePromotions';

interface Props {
  stats: Stats;
  currentTab: PromoListTab;
  onSelect: (tab: PromoListTab) => void;
}

/**
 * Header épicier avec 4 tuiles cliquables qui servent aussi de sélecteur
 * d'onglet. Visuel pro : chiffre en grand, label en petit, accent coloré
 * sur la tuile active.
 */
export function PromoStatsHeader({ stats, currentTab, onSelect }: Props) {
  const { t } = useLanguage();

  const tiles: {
    key: PromoListTab;
    labelKey: string;
    value: number;
    color: string;
    bg: string;
  }[] = [
    {
      key: 'active',
      labelKey: 'promotions.stats.active',
      value: stats.active,
      color: '#2E7D32',
      bg: '#E8F5E9',
    },
    {
      key: 'scheduled',
      labelKey: 'promotions.stats.scheduled',
      value: stats.scheduled + stats.draft,
      color: '#EF6C00',
      bg: '#FFF3E0',
    },
    {
      key: 'expired',
      labelKey: 'promotions.stats.expired',
      value: stats.expired,
      color: '#616161',
      bg: '#F5F5F5',
    },
    {
      key: 'cancelled',
      labelKey: 'promotions.stats.inactive',
      value: stats.cancelled,
      color: '#C62828',
      bg: '#FFEBEE',
    },
  ];

  return (
    <View style={styles.container}>
      {tiles.map(tile => {
        const active = currentTab === tile.key;
        return (
          <TouchableOpacity
            key={tile.key}
            style={[
              styles.tile,
              { backgroundColor: tile.bg },
              active && [styles.tileActive, { borderColor: tile.color }],
            ]}
            onPress={() => onSelect(tile.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.value, { color: tile.color }]}>{tile.value}</Text>
            <Text style={[styles.label, { color: tile.color }]} numberOfLines={1}>
              {t(tile.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileActive: {
    transform: [{ scale: 1.03 }],
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
