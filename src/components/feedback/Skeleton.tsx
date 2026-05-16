import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?:   number | string;
  height?:  number;
  style?:   StyleProp<ViewStyle>;
  /** Si false, désactive la pulsation (utile pour un placeholder statique). */
  animated?: boolean;
}

/**
 * Placeholder de chargement avec pulsation douce.
 * - `text`   : ligne 14px, radius pill
 * - `rect`   : bloc rectangulaire avec radius md
 * - `circle` : avatar — `width` = `height`
 */
export function Skeleton({
  variant = 'rect',
  width,
  height,
  style,
  animated = true,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (!animated) {
      opacity.value = 0.55;
      return;
    }
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [animated, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const baseHeight = height ?? (variant === 'text' ? 14 : variant === 'circle' ? 40 : 80);
  const baseWidth  = width  ?? (variant === 'circle' ? baseHeight : '100%');
  const borderRadius =
    variant === 'circle' ? baseHeight / 2 :
    variant === 'text'   ? theme.radius.pill :
    theme.radius.md;

  return (
    <Animated.View
      style={[
        {
          width:  baseWidth as number,
          height: baseHeight,
          backgroundColor: theme.colors.border,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

interface SkeletonGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapper sémantique. N'apporte rien fonctionnellement aujourd'hui mais
 * permet aux écrans de marquer leurs zones loading (a11y future,
 * tests, opt-in à un skeleton pulse partagé).
 */
export function SkeletonGroup({ children, style }: SkeletonGroupProps) {
  return <Animated.View style={style} accessibilityLabel="Chargement">{children}</Animated.View>;
}
