import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/orderService';
import { Theme, useTheme } from '../../theme';
import { Order } from '../../type';

/** Statuts considérés comme "en cours" — affichage de la carte sticky. */
const ONGOING_STATUSES = new Set([
  'PENDING', 'ACCEPTED', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY', 'OUT_FOR_DELIVERY',
]);

/** Étapes du tracker — ordre = progression visuelle. */
type Step = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const STEPS: Step[] = [
  { key: 'PENDING',     label: 'Commande',  icon: 'receipt-outline' },
  { key: 'PREPARING',   label: 'Préparation', icon: 'cube-outline' },
  { key: 'READY',       label: 'Prête',     icon: 'checkmark-circle-outline' },
  { key: 'IN_DELIVERY', label: 'Livraison', icon: 'bicycle-outline' },
];

/** Map status → index de progression dans STEPS. */
function getStepIndex(status: string): number {
  switch (status) {
    case 'PENDING':
    case 'ACCEPTED':
    case 'CONFIRMED':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY':
      return 2;
    case 'IN_DELIVERY':
    case 'OUT_FOR_DELIVERY':
      return 3;
    default:
      return -1;
  }
}

/**
 * Carte sticky en haut de la home affichant la commande en cours.
 * Ne s'affiche que si une commande active existe.
 *
 * Stratégie: au mount + chaque focus d'écran + toutes les 30s, recharge la
 * liste des commandes du client et garde la 1ère active. Pas d'API "active
 * order" dédiée côté backend — on filtre côté client.
 */
export function OngoingOrderCard() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [order, setOrder] = useState<Order | null>(null);

  const refresh = useCallback(async () => {
    try {
      const orders = await orderService.getMyOrders();
      const active = (orders || [])
        .filter(o => ONGOING_STATUSES.has(o.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      setOrder(active ?? null);
    } catch {
      // ne jamais bloquer la home — silencieux
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, 30_000);
      return () => clearInterval(id);
    }, [refresh])
  );

  if (!order) return null;

  const stepIdx = getStepIndex(order.status);
  const eta = computeETA(order, t);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({
        pathname: '/(client)/(commandes)/[id]',
        params: { id: order.id.toString() },
      })}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t('client.home.trackOrder') || 'Suivre votre commande'}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons
            name={STEPS[Math.max(stepIdx, 0)]?.icon ?? 'receipt-outline'}
            size={20}
            color={theme.colors.onBrand}
          />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={1}>
            {t('client.home.orderInProgress') || 'Commande en cours'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {order.epicerieNom} • {eta}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </View>

      <View style={styles.tracker}>
        {STEPS.map((step, idx) => {
          const reached = stepIdx >= idx;
          const isCurrent = stepIdx === idx;
          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepCol}>
                <View
                  style={[
                    styles.stepDot,
                    reached && styles.stepDotActive,
                    isCurrent && styles.stepDotCurrent,
                  ]}
                >
                  {reached && (
                    <Ionicons
                      name={isCurrent ? step.icon : 'checkmark'}
                      size={12}
                      color={theme.colors.onBrand}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    reached && styles.stepLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </View>
              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    stepIdx > idx && styles.stepLineActive,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

/**
 * ETA simple basée sur le status. Le backend n'expose pas de champ ETA dédié,
 * on fournit donc une estimation lisible.
 */
function computeETA(order: Order, t: (k: string) => string): string {
  switch (order.status) {
    case 'PENDING':
    case 'ACCEPTED':
    case 'CONFIRMED':
      return t('client.home.etaPending') || 'En attente de validation';
    case 'PREPARING':
      return t('client.home.etaPreparing') || 'Préparation • 10-20 min';
    case 'READY':
      return t('client.home.etaReady') || 'Prête à récupérer';
    case 'IN_DELIVERY':
    case 'OUT_FOR_DELIVERY':
      return t('client.home.etaDelivery') || 'En route • bientôt chez vous';
    default:
      return '';
  }
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.brandSubtle,
    ...theme.shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...theme.typography.titleSm,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  tracker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xs,
  },
  stepCol: {
    alignItems: 'center',
    width: 60,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  stepDotCurrent: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: theme.colors.brandSubtle,
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.border,
    marginTop: 11,
    marginHorizontal: -4,
  },
  stepLineActive: {
    backgroundColor: theme.colors.brand,
  },
});
