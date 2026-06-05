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
}

/**
 * Carte épicerie pleine largeur avec photo de présentation en bandeau (180px),
 * style Glovo/Deliveroo. Utilisée sur l'écran de découverte des épiceries.
 *
 * Affiche un statut Ouvert/Fermé, le type de boutique, la note, la distance,
 * et un bouton favori qui se superpose à l'image.
 */
export function EpicerieDiscoverCard({
  epicerie,
  isFavorite,
  onPress,
  onToggleFavorite,
  userLocation,
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
            <View style={styles.metaItem}>
              <Ionicons name="star-outline" size={13} color={theme.colors.textMuted} />
              <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                {t('client.home.noRating') || 'Nouveau'}
              </Text>
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
      </View>
    </TouchableOpacity>
  );
}

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
});
