import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/orderService';
import { DeliveryTracking } from '../../type';
import { TrackingMap } from './TrackingMap';

/** Cadence du polling tant que la carte est montée (commande IN_DELIVERY). */
const POLL_INTERVAL_MS = 10_000;
/** Au-delà de N erreurs consécutives, on arrête de poller (livraison finie, réseau…). */
const MAX_CONSECUTIVE_ERRORS = 3;

/** Distance grand-cercle (Haversine) en kilomètres. */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** « 45 s » / « 3 min » — chiffres + unités, lisible dans toutes les langues. */
const formatFreshness = (seconds?: number): string | null => {
  if (seconds == null) return null;
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`;
  return `${Math.round(seconds / 60)} min`;
};

interface DeliveryTrackingCardProps {
  orderId: number;
}

/**
 * Suivi en direct du livreur pendant une livraison à domicile.
 *
 * Polle GET /orders/{id}/tracking toutes les 10 s tant que le composant est
 * monté (le parent ne le rend que si la commande est IN_DELIVERY +
 * HOME_DELIVERY). S'arrête seul après 3 erreurs consécutives — typiquement
 * la livraison vient d'être complétée côté livreur.
 */
export const DeliveryTrackingCard = ({ orderId }: DeliveryTrackingCardProps) => {
  const { t } = useLanguage();
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [stopped, setStopped] = useState(false);
  const errorCountRef = useRef(0);

  const fetchTracking = useCallback(async () => {
    try {
      const data = await orderService.getDeliveryTracking(orderId);
      errorCountRef.current = 0;
      setTracking(data);
    } catch {
      errorCountRef.current += 1;
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setStopped(true);
      }
    }
  }, [orderId]);

  useEffect(() => {
    if (stopped) return;

    fetchTracking();
    const interval = setInterval(fetchTracking, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTracking, stopped]);

  // Position du livreur disponible ?
  const hasPosition =
    tracking?.livreurLatitude != null && tracking?.livreurLongitude != null;

  // Distance livreur → destination, si les deux points sont connus
  const remainingKm =
    hasPosition &&
    tracking?.destinationLatitude != null &&
    tracking?.destinationLongitude != null
      ? haversineKm(
          tracking.livreurLatitude!,
          tracking.livreurLongitude!,
          tracking.destinationLatitude,
          tracking.destinationLongitude
        )
      : null;

  const freshness = formatFreshness(tracking?.secondsSinceUpdate);

  const openOnMap = () => {
    if (!hasPosition) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${tracking!.livreurLatitude},${tracking!.livreurLongitude}`;
    Linking.openURL(url).catch(() => {});
  };

  if (stopped) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🛵 {t('orderDetail.trackingTitle')}</Text>
        <View style={styles.liveDot} />
      </View>

      {tracking?.livreurNom ? (
        <Text style={styles.livreurName}>👤 {tracking.livreurNom}</Text>
      ) : null}

      {hasPosition ? (
        <>
          <TrackingMap
            livreur={{
              latitude: tracking!.livreurLatitude!,
              longitude: tracking!.livreurLongitude!,
            }}
            epicerie={
              tracking!.epicerieLatitude != null && tracking!.epicerieLongitude != null
                ? { latitude: tracking!.epicerieLatitude, longitude: tracking!.epicerieLongitude }
                : null
            }
            destination={
              tracking!.destinationLatitude != null && tracking!.destinationLongitude != null
                ? {
                    latitude: tracking!.destinationLatitude,
                    longitude: tracking!.destinationLongitude,
                  }
                : null
            }
          />

          <View style={styles.infoRow}>
            {remainingKm != null && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>{t('orderDetail.trackingRemainingDistance')}</Text>
                <Text style={styles.infoValue}>
                  {remainingKm < 1
                    ? `${Math.round(remainingKm * 1000)} m`
                    : `${remainingKm.toFixed(1)} km`}
                </Text>
              </View>
            )}
            {freshness && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>📍</Text>
                <Text style={styles.infoValue}>{freshness}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={openOnMap}
            accessibilityRole="button"
            accessibilityLabel={t('orderDetail.trackingViewOnMap')}
          >
            <Text style={styles.mapButtonText}>🗺️ {t('orderDetail.trackingViewOnMap')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.waiting}>{t('orderDetail.trackingWaiting')}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B5E20',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  livreurName: {
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B5E20',
  },
  waiting: {
    fontSize: 13,
    color: '#558B2F',
    fontStyle: 'italic',
  },
  mapButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
