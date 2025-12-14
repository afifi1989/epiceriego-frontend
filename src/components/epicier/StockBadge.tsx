/**
 * StockBadge component - displays stock status
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';

interface StockBadgeProps {
  stock: number;
  threshold: number;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export const StockBadge: React.FC<StockBadgeProps> = ({
  stock,
  threshold,
  size = 'medium',
  showIcon = true,
}) => {
  const getStatus = () => {
    if (stock === 0) return { label: 'Rupture', color: Colors.outOfStock, icon: 'alert-circle' };
    if (stock <= threshold) return { label: 'Stock bas', color: Colors.lowStock, icon: 'alert' };
    return { label: 'En stock', color: Colors.inStock, icon: 'check-circle' };
  };

  const status = getStatus();
  const sizeMap = {
    small: { padding: Spacing.xs, fontSize: FontSizes.xs, iconSize: 12 },
    medium: { padding: Spacing.sm, fontSize: FontSizes.sm, iconSize: 14 },
    large: { padding: Spacing.md, fontSize: FontSizes.base, iconSize: 18 },
  };

  const sizeConfig = sizeMap[size];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: status.color, padding: sizeConfig.padding },
      ]}
    >
      {showIcon && (
        <MaterialCommunityIcons
          name={status.icon}
          size={sizeConfig.iconSize}
          color={Colors.textInverse}
          style={{ marginRight: Spacing.xs }}
        />
      )}
      <Text
        style={[styles.label, { fontSize: sizeConfig.fontSize }]}
      >
        {status.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xs,
    alignSelf: 'flex-start',
  },
  label: {
    color: Colors.textInverse,
    fontWeight: '600',
  },
});
