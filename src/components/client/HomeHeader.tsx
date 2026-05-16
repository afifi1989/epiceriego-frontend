import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authService } from '../../services/authService';
import { cartService } from '../../services/cartService';
import { notificationService } from '../../services/notificationService';
import { useLanguage } from '../../context/LanguageContext';
import { Theme, useTheme } from '../../theme';
import { LoginResponse } from '../../type';

/**
 * Salutation contextuelle selon l'heure locale.
 */
function getGreetingKey(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/**
 * Extrait le prénom à partir du champ `nom` (qui contient nom complet).
 * Si vide, retourne null.
 */
function getFirstName(fullName?: string): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

/**
 * Header moderne pour la home client.
 *
 * Layout : avatar/salutation + adresse cliquable / icônes (notif badge + panier badge).
 * S'inscrit dans le flow de scroll (pas sticky) pour une transition douce avec
 * les autres sections.
 */
export function HomeHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme, insets.top), [theme, insets.top]);

  const [user, setUser] = useState<LoginResponse | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    authService.getCurrentUser().then(setUser).catch(() => {});
  }, []);

  const refreshCounters = useCallback(async () => {
    try {
      const [count, cart] = await Promise.all([
        notificationService.getUnreadCount().catch(() => 0),
        cartService.getCart().catch(() => []),
      ]);
      setUnreadNotifs(count);
      setCartCount(cart.reduce((acc, it: any) => acc + (it.quantity || 0), 0));
    } catch {
      // silencieux: header ne doit jamais bloquer l'écran
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCounters();
      const interval = setInterval(refreshCounters, 30000);
      return () => clearInterval(interval);
    }, [refreshCounters])
  );

  const greetingKey = getGreetingKey();
  const greeting =
    t(`client.home.greeting.${greetingKey}`) ||
    (greetingKey === 'morning' ? 'Bonjour' : greetingKey === 'afternoon' ? 'Bon après-midi' : 'Bonsoir');
  const firstName = getFirstName(user?.nom);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.avatarBox}
          onPress={() => router.push('/(client)/profil')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Profil"
        >
          <Text style={styles.avatarEmoji}>👋</Text>
        </TouchableOpacity>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(client)/profil')}
            activeOpacity={0.7}
            accessibilityLabel={t('client.home.deliveryAddress') || 'Adresse de livraison'}
          >
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.location} numberOfLines={1}>
                {(user as any)?.adresse || t('client.home.setLocation') || 'Définir une adresse'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <IconButton
            icon="notifications-outline"
            badge={unreadNotifs}
            onPress={() => router.push('/(client)/notifications')}
            theme={theme}
            label="Notifications"
          />
          <IconButton
            icon="cart-outline"
            badge={cartCount}
            onPress={() => router.push('/(client)/cart')}
            theme={theme}
            label="Panier"
          />
        </View>
      </View>
    </View>
  );
}

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  badge: number;
  onPress: () => void;
  theme: Theme;
  label: string;
}

function IconButton({ icon, badge, onPress, theme, label }: IconButtonProps) {
  return (
    <TouchableOpacity
      style={iconButtonStyles(theme).btn}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Ionicons name={icon} size={22} color={theme.colors.textPrimary} />
      {badge > 0 && (
        <View style={iconButtonStyles(theme).badge}>
          <Text style={iconButtonStyles(theme).badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const iconButtonStyles = (theme: Theme) => StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.danger,
    borderWidth: 2,
    borderColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
});

const makeStyles = (theme: Theme, topInset: number) => StyleSheet.create({
  container: {
    paddingTop: topInset + theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  greetingBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    ...theme.typography.titleSm,
    color: theme.colors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  location: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});
