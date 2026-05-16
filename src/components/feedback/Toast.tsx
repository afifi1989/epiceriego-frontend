import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  id:        string;
  variant:   ToastVariant;
  title:     string;
  message?:  string;
  duration?: number;
}

interface ToastProps {
  config:    ToastConfig;
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error:   'alert-circle',
  warning: 'warning',
  info:    'information-circle',
};

/**
 * Bulle de toast individuelle. Animation in/out + auto-dismiss.
 * Pas de logique métier ici — orchestration côté ToastProvider.
 */
export function Toast({ config, onDismiss }: ToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    const duration = config.duration ?? 3200;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) });
    translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });

    // Auto-dismiss
    opacity.value = withDelay(
      duration,
      withSequence(
        withTiming(0, { duration: 200 }, finished => {
          if (finished) runOnJS(onDismiss)(config.id);
        })
      )
    );
    // Pas de cleanup nécessaire : Reanimated pose les valeurs sur un thread UI.
    // Si le composant est démonté avant la fin, runOnJS ne sera pas rappelé,
    // ce qui est le comportement voulu (le parent gère le démontage explicite).
  }, [config.id, config.duration, opacity, translateY, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const colorByVariant: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
    success: { bg: theme.colors.successSubtle, border: theme.colors.success, icon: theme.colors.success },
    error:   { bg: theme.colors.dangerSubtle,  border: theme.colors.danger,  icon: theme.colors.danger  },
    warning: { bg: theme.colors.warningSubtle, border: theme.colors.warning, icon: theme.colors.warning },
    info:    { bg: theme.colors.infoSubtle,    border: theme.colors.info,    icon: theme.colors.info    },
  };
  const palette = colorByVariant[config.variant];

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + theme.spacing.sm },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={() => onDismiss(config.id)}
        style={[
          styles.toast,
          theme.shadows.md,
          {
            backgroundColor: palette.bg,
            borderColor:     palette.border,
            borderRadius:    theme.radius.lg,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <Ionicons name={ICONS[config.variant]} size={22} color={palette.icon} />
        <View style={styles.content}>
          <Text
            style={[
              theme.typography.bodyStrong,
              { color: theme.colors.textPrimary },
            ]}
            numberOfLines={2}
          >
            {config.title}
          </Text>
          {!!config.message && (
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary, marginTop: 2 },
              ]}
              numberOfLines={3}
            >
              {config.message}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left:     12,
    right:    12,
    zIndex:   9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
    borderLeftWidth: 4,
  },
  content: {
    flex: 1,
  },
});
