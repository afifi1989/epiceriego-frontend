import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { Promotion } from '../../services/promotionService';
import { Theme, useTheme } from '../../theme';

interface FlashDealsSectionProps {
  promotions: Promotion[];
  onPress: (promotion: Promotion) => void;
  /** Seuil au-delà duquel on n'affiche plus le compte à rebours (en heures). */
  countdownMaxHours?: number;
}

/**
 * Section "Flash Deals" — promotions actives avec compte à rebours dynamique
 * basé sur `Promotion.dateFin`. Le timer se met à jour chaque minute.
 *
 * Filtre côté client : on ne garde que les promos qui se terminent dans les
 * `countdownMaxHours` prochaines heures (par défaut 24h) — celles qui durent
 * plus longtemps n'ont pas l'urgence "flash" et sont déjà visibles dans le
 * banner promo classique.
 */
export function FlashDealsSection({
  promotions,
  onPress,
  countdownMaxHours = 24,
}: FlashDealsSectionProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [now, setNow] = useState(Date.now());

  // Refresh chaque minute pour tenir le compte à rebours à jour.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const flashDeals = useMemo(() => {
    const cutoffMs = countdownMaxHours * 3600 * 1000;
    return (promotions || [])
      .filter(p => {
        if (!p.dateFin) return false;
        const remaining = new Date(p.dateFin).getTime() - now;
        return remaining > 0 && remaining <= cutoffMs;
      })
      .sort((a, b) =>
        new Date(a.dateFin).getTime() - new Date(b.dateFin).getTime()
      );
  }, [promotions, now, countdownMaxHours]);

  if (flashDeals.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleEmoji}>⚡</Text>
          <Text style={styles.title}>
            {t('client.home.flashDeals') || 'Flash Deals'}
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {t('client.home.live') || 'EN COURS'}
          </Text>
        </View>
      </View>
      <FlatList
        horizontal
        data={flashDeals}
        keyExtractor={(item) => `flash-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <FlashCard
            promotion={item}
            now={now}
            onPress={() => onPress(item)}
            theme={theme}
            t={t}
          />
        )}
      />
    </View>
  );
}

interface FlashCardProps {
  promotion: Promotion;
  now: number;
  onPress: () => void;
  theme: Theme;
  t: (key: string) => string;
}

function FlashCard({ promotion, now, onPress, theme, t }: FlashCardProps) {
  const styles = flashCardStyles(theme);
  const remainingMs = new Date(promotion.dateFin).getTime() - now;
  const countdown = formatCountdown(remainingMs, t);
  const urgent = remainingMs <= 60 * 60 * 1000; // ≤ 1h

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.imageWrap}>
        {promotion.imageUrl || promotion.epicerieImageUrl ? (
          <ExpoImage
            source={{ uri: promotion.imageUrl || promotion.epicerieImageUrl! }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderEmoji}>🎉</Text>
          </View>
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{promotion.reductionPercentage}%</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.dealTitle} numberOfLines={1}>{promotion.titre}</Text>
        <Text style={styles.store} numberOfLines={1}>
          {promotion.epicerieName}
        </Text>
        <View style={[styles.timerRow, urgent && styles.timerRowUrgent]}>
          <Ionicons
            name="time-outline"
            size={12}
            color={urgent ? theme.colors.danger : theme.colors.textSecondary}
          />
          <Text style={[styles.timer, urgent && styles.timerUrgent]}>
            {countdown}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Formate un délai en ms en chaîne lisible :
 *   - >= 1h  → "Plus que 3h12"
 *   - < 1h   → "Plus que 42 min"
 *   - < 1min → "Bientôt fini"
 */
function formatCountdown(ms: number, t: (k: string) => string): string {
  if (ms <= 0) return t('client.home.endsSoon') || 'Bientôt fini';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t('client.home.endsSoon') || 'Bientôt fini';
  if (minutes < 60) {
    const prefix = t('client.home.endsIn') || 'Plus que';
    const minLabel = t('common.minutesShort') || 'min';
    return `${prefix} ${minutes} ${minLabel}`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const prefix = t('client.home.endsIn') || 'Plus que';
  return mins > 0 ? `${prefix} ${hours}h${mins.toString().padStart(2, '0')}` : `${prefix} ${hours}h`;
}

const flashCardStyles = (theme: Theme) => StyleSheet.create({
  card: {
    width: 180,
    marginEnd: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: 110,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surfaceMuted,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 36,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.danger,
  },
  discountText: {
    color: theme.colors.textOnDanger,
    fontSize: 12,
    fontWeight: '800',
  },
  body: {
    padding: theme.spacing.sm,
  },
  dealTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  store: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignSelf: 'flex-start',
  },
  timerRowUrgent: {
    backgroundColor: theme.colors.dangerSubtle,
  },
  timer: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  timerUrgent: {
    color: theme.colors.danger,
  },
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  section: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleEmoji: {
    fontSize: 18,
  },
  title: {
    ...theme.typography.titleMd,
    color: theme.colors.textPrimary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.dangerSubtle,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.danger,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.danger,
    letterSpacing: 0.5,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
  },
});
