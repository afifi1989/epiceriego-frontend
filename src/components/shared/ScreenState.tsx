/**
 * <ScreenState> — état d'écran réutilisable et thémable.
 *
 * Trois variantes couvrant les états non-nominaux d'un écran :
 *   - `loading` : spinner centré, non bloquant (option skeleton via `children`).
 *   - `empty`   : icône + titre + message + éventuel CTA (`children`).
 *   - `error`   : icône + titre + message + bouton « Réessayer » (`onRetry`).
 *
 * Générique par conception : destiné à être adopté par tous les écrans clients
 * dans un second temps. Les textes par défaut sont traduits (`screenState.*`)
 * mais surchargeables via `title` / `message` / `icon`.
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme';

export type ScreenStateVariant = 'loading' | 'empty' | 'error';

export interface ScreenStateProps {
  variant: ScreenStateVariant;
  /** Callback du bouton « Réessayer » (variante `error`). */
  onRetry?: () => void;
  /** Titre — surcharge le texte par défaut traduit. */
  title?: string;
  /** Message — surcharge le texte par défaut traduit. */
  message?: string;
  /**
   * Icône. Chaîne (emoji) ou n'importe quel nœud React (ex: <Ionicons/>).
   * Par défaut : une icône emoji adaptée à la variante.
   */
  icon?: React.ReactNode;
  /** Contenu additionnel : CTA (empty), skeleton custom (loading), etc. */
  children?: React.ReactNode;
  /** Style du conteneur racine. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ICON: Record<Exclude<ScreenStateVariant, 'loading'>, string> = {
  empty: '📭',
  error: '⚠️',
};

export function ScreenState({
  variant,
  onRetry,
  title,
  message,
  icon,
  children,
  style,
}: ScreenStateProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);

  // ── Loading ──────────────────────────────────────────────────────────
  if (variant === 'loading') {
    const loadingMsg = message ?? t('screenState.loading');
    return (
      <View
        style={[styles.container, style]}
        accessibilityRole="progressbar"
        accessibilityLabel={loadingMsg}
        accessibilityLiveRegion="polite"
      >
        {children ?? (
          <>
            <ActivityIndicator size="large" color={theme.colors.brand} />
            {!!loadingMsg && <Text style={styles.message}>{loadingMsg}</Text>}
          </>
        )}
      </View>
    );
  }

  // ── Empty / Error ────────────────────────────────────────────────────
  const isError = variant === 'error';
  const resolvedTitle = title ?? t(isError ? 'screenState.errorTitle' : 'screenState.emptyTitle');
  const resolvedMessage =
    message ?? t(isError ? 'screenState.errorMessage' : 'screenState.emptyMessage');
  const resolvedIcon = icon ?? DEFAULT_ICON[variant];

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole={isError ? 'alert' : 'summary'}
    >
      {resolvedIcon != null &&
        (typeof resolvedIcon === 'string' ? (
          <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
            {resolvedIcon}
          </Text>
        ) : (
          <View style={styles.iconWrap}>{resolvedIcon}</View>
        ))}

      {!!resolvedTitle && (
        <Text style={styles.title} accessibilityRole="header">
          {resolvedTitle}
        </Text>
      )}

      {!!resolvedMessage && <Text style={styles.message}>{resolvedMessage}</Text>}

      {isError && onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('screenState.retry')}
        >
          <Text style={styles.retryText}>{t('screenState.retry')}</Text>
        </TouchableOpacity>
      )}

      {children != null && <View style={styles.childrenWrap}>{children}</View>}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxl,
      backgroundColor: theme.colors.background,
    },
    icon: {
      fontSize: 48,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    iconWrap: {
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.titleSm,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    message: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
    retryButton: {
      marginTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.brand,
      minWidth: 160,
      alignItems: 'center',
    },
    retryText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.onBrand,
    },
    childrenWrap: {
      marginTop: theme.spacing.xl,
      alignItems: 'center',
      alignSelf: 'stretch',
    },
  });
}

export default ScreenState;
