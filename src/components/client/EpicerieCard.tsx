import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { Promotion } from '../../services/promotionService';
import { Theme, useTheme } from '../../theme';
import { Epicerie } from '../../type';

interface EpicerieCardProps {
  epicerie: Epicerie;
  onPress: (epicerie: Epicerie) => void;
  /** Position GPS de l'utilisateur — si fournie, affiche la distance. */
  userLocation?: { latitude: number; longitude: number } | null;
  /** Liste des promotions actives, filtrée sur cette épicerie pour afficher le badge. */
  promotions?: Promotion[];
  /** Largeur de la carte. Par défaut 45% du viewport. */
  width?: number;
}

/**
 * Card épicerie enrichie pour la home : image, nom, note ⭐, distance, ETA
 * livraison, badge ouvert/fermé, badge promo si offre active.
 *
 * Toutes les méta-infos (rating, distance, promo) sont optionnelles : la card
 * dégrade proprement si une donnée manque.
 */
export function EpicerieCard({
  epicerie,
  onPress,
  userLocation,
  promotions,
  width = 180,
}: EpicerieCardProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(theme, width), [theme, width]);
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

  const eta = estimateDeliveryEta(distance);

  const bestPromo = useMemo(() => {
    if (!promotions || promotions.length === 0) return null;
    const matching = promotions.filter(p => p.epicerieId === epicerie.id);
    if (matching.length === 0) return null;
    return matching.reduce((best, p) =>
      p.reductionPercentage > best.reductionPercentage ? p : best,
      matching[0]
    );
  }, [promotions, epicerie.id]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(epicerie)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={epicerie.nomEpicerie}
    >
      <View style={styles.imageWrap}>
        {showImage ? (
          <ExpoImage
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderEmoji}>🏪</Text>
          </View>
        )}

        {bestPromo && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>
              -{bestPromo.reductionPercentage}%
            </Text>
          </View>
        )}

        <View style={[
          styles.statusBadge,
          epicerie.isOpen ? styles.statusOpen : styles.statusClosed,
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: epicerie.isOpen ? theme.colors.success : theme.colors.danger },
          ]} />
          <Text style={[
            styles.statusText,
            { color: epicerie.isOpen ? theme.colors.success : theme.colors.danger },
          ]}>
            {epicerie.isOpen
              ? (t('client.home.open') || 'Ouvert')
              : (t('client.home.closed') || 'Fermé')}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {epicerie.nomEpicerie}
        </Text>

        <View style={styles.metaRow}>
          {epicerie.averageRating != null && epicerie.averageRating > 0 ? (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={styles.metaText}>
                {epicerie.averageRating.toFixed(1)}
                {epicerie.totalRatings ? ` (${epicerie.totalRatings})` : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.metaItem}>
              <Ionicons name="star-outline" size={12} color={theme.colors.textMuted} />
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                {t('client.home.noRating') || 'Nouveau'}
              </Text>
            </View>
          )}

          {distance != null && (
            <>
              <View style={styles.metaDot} />
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.metaText}>{formatDistance(distance)}</Text>
              </View>
            </>
          )}
        </View>

        {eta && (
          <View style={styles.etaRow}>
            <Ionicons name="bicycle-outline" size={12} color={theme.colors.brand} />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Distance haversine entre 2 points en km. Précision suffisante pour
 * de l'affichage local (épiceries voisines).
 */
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

/**
 * ETA estimée selon la distance. Vélo urbain = ~15 km/h en charge + 10 min
 * préparation. Affiche une fourchette pour donner de la marge.
 */
function estimateDeliveryEta(distanceKm: number | null): string | null {
  if (distanceKm == null) return null;
  const travelMin = (distanceKm / 15) * 60;
  const min = Math.max(15, Math.round(travelMin + 10));
  const max = min + 10;
  return `${min}-${max} min`;
}

const makeStyles = (theme: Theme, width: number) => StyleSheet.create({
  card: {
    width,
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
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.danger,
  },
  promoBadgeText: {
    color: theme.colors.textOnDanger,
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  statusOpen: {
    backgroundColor: theme.colors.surface,
  },
  statusClosed: {
    backgroundColor: theme.colors.surface,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    padding: theme.spacing.sm,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.borderStrong,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  etaText: {
    fontSize: 11,
    color: theme.colors.brand,
    fontWeight: '600',
  },
});
