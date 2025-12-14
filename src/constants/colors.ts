/**
 * Color constants for Epicier application
 * Blue theme (#2196F3) for shop owner interface
 */

export const Colors = {
  // Primary colors - Blue theme for Epicier
  primary: '#2196F3',
  primaryLight: '#E3F2FD',
  primaryDark: '#1565C0',

  // Semantic colors
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  danger: '#F44336',
  dangerLight: '#FFEBEE',
  info: '#2196F3',
  infoLight: '#E3F2FD',

  // Stock status colors
  inStock: '#4CAF50',
  lowStock: '#FF9800',
  outOfStock: '#F44336',

  // Neutral colors
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  divider: '#BDBDBD',

  // Text colors
  text: '#212121',
  textSecondary: '#757575',
  textTertiary: '#BDBDBD',
  textInverse: '#FFFFFF',

  // Status colors
  active: '#4CAF50',
  inactive: '#9E9E9E',
  pending: '#FF9800',
  completed: '#4CAF50',
  error: '#F44336',

  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontWeights = {
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
