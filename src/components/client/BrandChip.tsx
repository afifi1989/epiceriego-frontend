import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

/**
 * Visual identity of a product's brand on the client side.
 *
 * Two visual variants:
 *   - "badge"  : pilled label with the chip's blue background. Used in
 *                product list/grid cards where space is tight.
 *   - "inline" : transparent background, just avatar + text. Used in the
 *                wider product detail header where the chip sits on its own row.
 *
 * Avatar resolution:
 *   - If {@code logoUrl} is provided AND loads → show it (rounded).
 *   - Otherwise → render an initials avatar (1–2 chars from the name) on the
 *                 same fixed blue palette so the chip always carries a graphic
 *                 element. This keeps the look consistent whether or not the
 *                 épicier uploaded a logo.
 *
 * Interaction:
 *   - When {@code onPress} is provided, the chip becomes a TouchableOpacity.
 *     The caller decides what tapping does (typically: filter the product list
 *     by this brand or navigate to such a list).
 */
export type BrandChipSize = 'sm' | 'md';
export type BrandChipVariant = 'badge' | 'inline';

interface BrandChipProps {
  name: string;
  logoUrl?: string | null;
  size?: BrandChipSize;
  variant?: BrandChipVariant;
  onPress?: () => void;
  style?: ViewStyle;
}

const PALETTE = {
  bg: '#E3F2FD',
  fg: '#1565C0',
  border: '#BBDEFB',
};

const SIZES: Record<BrandChipSize, { avatar: number; font: number; gap: number; padH: number; padV: number }> = {
  sm: { avatar: 18, font: 10, gap: 5, padH: 6, padV: 2 },
  md: { avatar: 22, font: 12, gap: 6, padH: 8, padV: 3 },
};

function initialsOf(name: string): string {
  if (!name) return '?';
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    // Single word → first 2 chars uppercased.
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const BrandChip: React.FC<BrandChipProps> = ({
  name,
  logoUrl,
  size = 'sm',
  variant = 'badge',
  onPress,
  style,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const dims = SIZES[size];

  const showLogo = !!logoUrl && !logoFailed;

  const avatar = showLogo ? (
    <Image
      source={{ uri: logoUrl as string }}
      style={[styles.avatar, { width: dims.avatar, height: dims.avatar, borderRadius: dims.avatar / 2 }]}
      onError={() => setLogoFailed(true)}
    />
  ) : (
    <View
      style={[
        styles.avatar,
        styles.avatarFallback,
        { width: dims.avatar, height: dims.avatar, borderRadius: dims.avatar / 2 },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { fontSize: Math.max(8, dims.font - 1) }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );

  const containerStyle: ViewStyle[] = [
    styles.base,
    { gap: dims.gap, paddingHorizontal: variant === 'badge' ? dims.padH : 0, paddingVertical: variant === 'badge' ? dims.padV : 0 },
    variant === 'badge' ? styles.badgeBg : styles.inlineBg,
  ];
  if (style) containerStyle.push(style);

  const content = (
    <View style={containerStyle}>
      {avatar}
      <Text style={[styles.name, { fontSize: dims.font }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Filtrer par marque ${name}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
  },
  badgeBg: {
    backgroundColor: PALETTE.bg,
  },
  inlineBg: {
    backgroundColor: 'transparent',
  },
  avatar: {
    backgroundColor: '#fff',
  },
  avatarFallback: {
    backgroundColor: PALETTE.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  name: {
    color: PALETTE.fg,
    fontWeight: '600',
  },
});
