import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { Theme, useTheme } from '../../theme';
import { EPICERIE_TYPES, Epicerie } from '../../type';

interface EpicerieDiscoverCardProps {
  epicerie: Epicerie;
  isFavorite: boolean;
  onPress: (epicerie: Epicerie) => void;
  onToggleFavorite: (id: number, currentlyFavorite: boolean) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  /** Réduction max (%) d'une promo active sur cette épicerie. Undefined = pas de promo. */
  promoPercent?: number;
}

/**
 * Carte épicerie pleine largeur avec photo de présentation en bandeau (180px),
 * style Glovo/Deliveroo. Utilisée sur l'écran de découverte des épiceries.
 *
 * Affiche un statut Ouvert/Fermé, le type de boutique, la note, la distance,
 * et un bouton favori qui se superpose à l'image. Des badges contextuels
 * (promo, fermeture imminente, nouveau, top noté, livraison) enrichissent la
 * carte quand les données correspondantes sont disponibles.
 */
function EpicerieDiscoverCardBase({
  epicerie,
  isFavorite,
  onPress,
  onToggleFavorite,
  userLocation,
  promoPercent,
}: EpicerieDiscoverCardProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = epicerie.presentationPhotoUrl || epicerie.photoUrl;
  const showImage = imageUrl && imageUrl.trim() !== '' && !imageFailed;

  const distance = useMemo(() => {
    if (!userLocation || epicerie.latitude == null || epicerie.longitude == null) return null;
    return haversineKm(
      userLocation.latitude, userLocation.longitude,
      epicerie.latitude, epicerie.longitude,
    );
  }, [userLocation, epicerie.latitude, epicerie.longitude]);

  const typeInfo = useMemo(() => {
    if (!epicerie.epicerieType) return null;
    return EPICERIE_TYPES.find(t => t.value === epicerie.epicerieType) || null;
  }, [epicerie.epicerieType]);

  const typeLabel = epicerie.epicerieTypeLabel || typeInfo?.label || null;
  const typeIcon = epicerie.epicerieTypeIcon || typeInfo?.icon || null;

  // ── Badges contextuels ────────────────────────────────────────────────
  // Fermeture/ouverture imminente depuis hoursUntilClosing (renvoyé par le
  // backend, exprimé en heures). On ne montre le badge que si l'échéance est
  // proche pour éviter le bruit visuel.
  const minutesToChange = useMemo(() => {
    const h = epicerie.hoursUntilClosing;
    if (h == null || !Number.isFinite(h) || h <= 0) return null;
    return Math.round(h * 60);
  }, [epicerie.hoursUntilClosing]);

  const closingSoon = epicerie.isOpen === true && minutesToChange != null && minutesToChange <= 45;
  const openingSoon = epicerie.isOpen === false && minutesToChange != null && minutesToChange <= 60;

  const isNew = epicerie.totalRatings === 0;
  const isTopRated = (epicerie.averageRating ?? 0) >= 4.5 && (epicerie.totalRatings ?? 0) > 0;

  const hasPromo = promoPercent != null && promoPercent > 0;

  // Livraison — libellé compact selon le mode de calcul des frais.
  const deliveryLabel = useMemo(() => {
    const symbol = epicerie.currency?.symbol || 'DH';
    if (epicerie.deliveryMode === 'FLAT_RATE' && epicerie.flatDeliveryFee != null) {
      if (epicerie.flatDeliveryFee <= 0) return t('epiceries.freeDelivery') || 'Livraison gratuite';
      return (t('epiceries.deliveryFee') || 'Livraison {{fee}} {{currency}}')
        .replace('{{fee}}', String(epicerie.flatDeliveryFee))
        .replace('{{currency}}', symbol);
    }
    if (epicerie.hasLivreur || epicerie.deliveryMode === 'ZONES') {
      return t('epiceries.deliveryAvailable') || 'Livraison';
    }
    return null;
  }, [epicerie.deliveryMode, epicerie.flatDeliveryFee, epicerie.hasLivreur, epicerie.currency, t]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(epicerie)}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={epicerie.nomEpicerie}
    >
      {/* Bandeau image */}
      <View style={styles.imageWrap}>
        {showImage ? (
          <ExpoImage
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            recyclingKey={String(epicerie.id)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderEmoji}>{typeIcon || '🏪'}</Text>
          </View>
        )}

        {/* Status pill — top-left */}
        {epicerie.isOpen != null && (
          <View style={[
            styles.statusPill,
            epicerie.isOpen ? styles.statusPillOpen : styles.statusPillClosed,
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: epicerie.isOpen ? '#22c55e' : '#ef4444' },
            ]} />
            <Text style={[
              styles.statusText,
              { color: epicerie.isOpen ? '#15803d' : '#b91c1c' },
            ]}>
              {epicerie.isOpen
                ? (t('epiceries.openNow') || 'Ouvert')
                : (t('epiceries.closedNow') || 'Fermé')}
            </Text>
          </View>
        )}

        {/* Promo — pastille accent sous le statut */}
        {hasPromo && (
          <View style={styles.promoPill}>
            <Text style={styles.promoText}>🔥 -{Math.round(promoPercent!)}%</Text>
          </View>
        )}

        {/* Fermeture / ouverture imminente — bas-gauche de l'image */}
        {(closingSoon || openingSoon) && (
          <View style={[styles.timePill, closingSoon ? styles.timePillClosing : styles.timePillOpening]}>
            <Ionicons name="time-outline" size={12} color={closingSoon ? '#b45309' : '#15803d'} />
            <Text style={[styles.timeText, { color: closingSoon ? '#b45309' : '#15803d' }]} numberOfLines={1}>
              {closingSoon
                ? (t('epiceries.closingSoon') || 'Ferme dans ~{{min}} min').replace('{{min}}', String(minutesToChange))
                : (t('epiceries.openingSoon') || 'Ouvre bientôt')}
            </Text>
          </View>
        )}

        {/* Favori — top-right */}
        <TouchableOpacity
          style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFavorite(epicerie.id, isFavorite);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? t('epiceries.removeFromFavorites') || 'Retirer favori' : t('epiceries.addToFavorites') || 'Ajouter aux favoris'}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? '#e11d48' : '#fff'}
          />
        </TouchableOpacity>

        {/* Dégradé bas pour lisibilité éventuelle d'un overlay (vide ici, prêt pour évolution) */}
      </View>

      {/* Infos */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{epicerie.nomEpicerie}</Text>

        {typeLabel && (
          <View style={styles.typeRow}>
            {typeIcon && <Text style={styles.typeIcon}>{typeIcon}</Text>}
            <Text style={styles.typeLabel} numberOfLines={1}>{typeLabel}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {epicerie.averageRating != null && epicerie.averageRating > 0 ? (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={13} color="#F5A623" />
              <Text style={styles.metaText}>
                {epicerie.averageRating.toFixed(1)}
                {epicerie.totalRatings ? ` (${epicerie.totalRatings})` : ''}
              </Text>
            </View>
          ) : (
            // Épicerie sans note : le badge « Nouveau » (ci-dessous) porte
            // désormais l'info, on évite de la dupliquer dans la meta.
            <View style={styles.metaItem}>
              <Ionicons name="star-outline" size={13} color={theme.colors.textMuted} />
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>—</Text>
            </View>
          )}

          {distance != null && (
            <>
              <View style={styles.metaDot} />
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={styles.metaText}>{formatDistance(distance)}</Text>
              </View>
            </>
          )}
        </View>

        {epicerie.adresse ? (
          <Text style={styles.address} numberOfLines={1}>📍 {epicerie.adresse}</Text>
        ) : null}

        {/* Badges secondaires — nouveau, top noté, livraison */}
        {(isNew || isTopRated || deliveryLabel) && (
          <View style={styles.badgeRow}>
            {isTopRated && (
              <View style={[styles.badge, styles.badgeTop]}>
                <Ionicons name="ribbon" size={11} color="#b45309" />
                <Text style={[styles.badgeText, { color: '#b45309' }]}>
                  {t('epiceries.badgeTopRated') || 'Top noté'}
                </Text>
              </View>
            )}
            {isNew && (
              <View style={[styles.badge, styles.badgeNew]}>
                <Text style={[styles.badgeText, { color: '#15803d' }]}>
                  {t('epiceries.badgeNew') || 'Nouveau'}
                </Text>
              </View>
            )}
            {deliveryLabel && (
              <View style={[styles.badge, styles.badgeDelivery]}>
                <Ionicons name="bicycle" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {deliveryLabel}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Mémoïsé : sur la liste de découverte, seules les cartes dont les props
 * changent réellement (favori togglé, promo, position) se re-rendent.
 */
export const EpicerieDiscoverCard = React.memo(EpicerieDiscoverCardBase);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  imageWrap: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: theme.colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 56,
  },
  statusPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  statusPillOpen: {},
  statusPillClosed: {},
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  promoPill: {
    position: 'absolute',
    top: 44,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DC2626',
  },
  promoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  timePill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timePillClosing: {
    backgroundColor: 'rgba(255,247,237,0.96)',
  },
  timePillOpening: {
    backgroundColor: 'rgba(240,253,244,0.96)',
  },
  timeText: {
    fontSize: 11.5,
    fontWeight: '800',
    maxWidth: 150,
  },
  favoriteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtnActive: {
    backgroundColor: '#fff',
  },
  body: {
    padding: theme.spacing.md,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  typeIcon: {
    fontSize: 13,
  },
  typeLabel: {
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.borderStrong,
  },
  address: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTop: {
    backgroundColor: '#FFF6E1',
  },
  badgeNew: {
    backgroundColor: '#E6F4EA',
  },
  badgeDelivery: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    maxWidth: 150,
  },
});
