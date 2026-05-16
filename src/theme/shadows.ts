import { Platform, ViewStyle } from 'react-native';

/**
 * Élévations cross-platform. iOS = shadow, Android = elevation.
 * Usage: `...theme.shadows.md` dans un style.
 */
function shadow(elevation: number, opacity: number, radius: number, offsetY: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor:   '#000',
      shadowOpacity: opacity,
      shadowRadius:  radius,
      shadowOffset:  { width: 0, height: offsetY },
    },
    android: {
      elevation,
    },
    default: {},
  })!;
}

export const shadows = {
  none: {} as ViewStyle,
  sm:   shadow(2, 0.06, 4,  1),
  md:   shadow(4, 0.10, 8,  2),
  lg:   shadow(8, 0.14, 16, 4),
} as const;

export type ShadowToken = keyof typeof shadows;
