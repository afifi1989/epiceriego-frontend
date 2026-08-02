/**
 * EpiceriesMapView — Vue carte de la découverte d'épiceries (Lot 4).
 *
 * ⚠️ SÉCURITÉ NEW ARCHITECTURE ─────────────────────────────────────────────
 * `app.json` a `newArchEnabled: true`. Sous la New Architecture, le montage
 * d'un `<MapView>` de `react-native-maps` **fermait l'application** (crash
 * natif au montage) — c'est la raison pour laquelle le suivi de commande
 * (`TrackingMap.tsx`) affiche une **image Google Static Maps** au lieu d'un
 * vrai `MapView`.
 *
 * Ce composant applique la même stratégie : par défaut, il rend une carte
 * STATIQUE (image) + une liste d'épiceries sélectionnables — AUCUN module
 * natif de cartographie n'est monté, donc aucun risque de crash.
 *
 * Le rendu interactif (`<MapView>`) reste présent mais désactivé derrière le
 * flag `INTERACTIVE_MAP_ENABLED`. Il n'est monté QUE si ce flag passe à `true`
 * ET est enveloppé dans un `MapErrorBoundary`. ⚠️ Un crash NATIF sous New Arch
 * n'est PAS rattrapable par un ErrorBoundary JS (qui ne capture que les erreurs
 * de rendu JS) — c'est pourquoi le flag reste `false` par défaut tant que
 * `react-native-maps` n'a pas été validé sur device (iOS + Android) sous la
 * New Architecture.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme';
import { Epicerie } from '../../type';

/**
 * ⚠️ NE PASSER À `true` qu'après avoir VALIDÉ sur device réel (iOS ET Android)
 * que le montage d'un `<MapView>` de `react-native-maps` ne crashe plus sous
 * la New Architecture (`newArchEnabled: true` dans app.json). Tant que ce
 * n'est pas confirmé, le mode carte reste 100 % statique (aucun module natif).
 * Rappel : un crash natif n'est PAS rattrapé par le `MapErrorBoundary` JS.
 */
const INTERACTIVE_MAP_ENABLED = false;

type LatLng = { latitude: number; longitude: number };

type GeoEpicerie = Epicerie & { latitude: number; longitude: number };

interface EpiceriesMapViewProps {
  epiceries: Epicerie[];
  userLocation: LatLng | null;
  onSelectEpicerie: (id: number) => void;
  /** Map epicerieId → réduction max (%). Sert à afficher une pastille promo. */
  promoMap?: Map<number, number>;
}

/**
 * Clé Google Maps. Static Maps est un service web : la même clé que le module
 * natif fonctionne, sans dépendre de `react-native-maps`. Source primaire =
 * `extra.googleMapsApiKey` ; fallback = `android.config.googleMaps.apiKey`.
 * (Pattern identique à `TrackingMap.tsx`.)
 */
const GOOGLE_MAPS_KEY: string =
  (Constants.expoConfig?.extra as any)?.googleMapsApiKey ??
  (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ??
  '';

/** Dimensions logiques demandées au service Static Maps (scale=2 pour la netteté). */
const MAP_W = 600;
const MAP_H = 280;

/** Séparateur encodé attendu par l'API Static Maps dans les paramètres. */
const PIPE = '%7C';

/**
 * Plafond de markers sur l'image statique : au-delà, l'URL dépasse la limite
 * de longueur du service (≈ 8k). On garde les épiceries les plus proches.
 */
const MAX_STATIC_MARKERS = 25;

/** Région de repli (Casablanca) quand ni position ni épicerie géolocalisée. */
const FALLBACK_REGION: Region = {
  latitude: 33.5731,
  longitude: -7.5898,
  latitudeDelta: 0.6,
  longitudeDelta: 0.6,
};

/** Zoom confortable autour d'un point unique (position utilisateur). */
const POINT_DELTA = 0.05;

/** Sécurité perf carte interactive : au-delà, on ne rend que les N premiers markers. */
const MAX_MARKERS = 120;

const hasCoords = (e: Epicerie): e is GeoEpicerie =>
  e.latitude != null && Number.isFinite(e.latitude)
  && e.longitude != null && Number.isFinite(e.longitude);

const coordStr = (p: LatLng) => `${p.latitude},${p.longitude}`;

/** Distance km : préfère le backend, sinon haversine local. */
function distanceKm(e: Epicerie, loc: LatLng | null): number | null {
  if (e.distanceKm != null && Number.isFinite(e.distanceKm)) return e.distanceKm;
  if (!loc || e.latitude == null || e.longitude == null) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(e.latitude - loc.latitude);
  const dLon = toRad(e.longitude - loc.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(loc.latitude)) * Math.cos(toRad(e.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Épiceries géolocalisées triées par proximité (si position connue), plafonnées. */
function nearestGeoEpiceries(
  epiceries: Epicerie[],
  loc: LatLng | null,
  limit: number,
): GeoEpicerie[] {
  const geo = epiceries.filter(hasCoords);
  if (loc) {
    geo.sort((a, b) => {
      const da = distanceKm(a, loc);
      const db = distanceKm(b, loc);
      return (da ?? Number.POSITIVE_INFINITY) - (db ?? Number.POSITIVE_INFINITY);
    });
  }
  return geo.slice(0, limit);
}

/** Région englobant l'ensemble des points fournis (avec marge). */
function boundingRegion(points: LatLng[]): Region | null {
  if (points.length === 0) return null;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const latDelta = Math.max((maxLat - minLat) * 1.4, 0.02);
  const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.02);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/**
 * Construit l'URL Google **Static Maps** :
 *  - markers groupés par style pour limiter la longueur d'URL : un groupe vert
 *    pour les épiceries OUVERTES, un groupe gris pour les fermées ;
 *  - marker bleu distinct pour la position utilisateur ;
 *  - auto-cadrage (`visible`) sur l'ensemble des points, ou `center`+`zoom` si
 *    un seul point.
 *
 * Rendu comme simple image : aucun module natif, donc aucun risque de crash.
 */
function buildStaticMapUrl(geo: GeoEpicerie[], userLocation: LatLng | null): string {
  if (!GOOGLE_MAPS_KEY) return '';

  const open = geo.filter((e) => e.isOpen === true);
  const closed = geo.filter((e) => e.isOpen !== true);

  const allPoints: string[] = geo.map(coordStr);
  if (userLocation) allPoints.push(coordStr(userLocation));
  if (allPoints.length === 0) return '';

  const params: string[] = [`size=${MAP_W}x${MAP_H}`, 'scale=2', 'maptype=roadmap'];

  if (allPoints.length === 1) {
    params.push(`center=${allPoints[0]}`, 'zoom=14');
  } else {
    params.push(`visible=${allPoints.join(PIPE)}`);
  }

  if (open.length > 0) {
    params.push(`markers=color:0x4CAF50${PIPE}${open.map(coordStr).join(PIPE)}`);
  }
  if (closed.length > 0) {
    params.push(`markers=color:0x9E9E9E${PIPE}${closed.map(coordStr).join(PIPE)}`);
  }
  if (userLocation) {
    params.push(`markers=color:0x2196F3${PIPE}label:U${PIPE}${coordStr(userLocation)}`);
  }

  params.push(`key=${GOOGLE_MAPS_KEY}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}

/** Placeholder affiché quand la carte statique ne peut pas se charger. */
function MapUnavailable() {
  const { t } = useLanguage();
  return (
    <View style={[styles.staticImage, styles.fallback]}>
      <Text style={styles.fallbackEmoji}>🗺️</Text>
      <Text style={styles.fallbackText}>
        {t('epiceries.mapUnavailable') || 'Carte indisponible'}
      </Text>
    </View>
  );
}

/**
 * Rangée compacte d'épicerie sélectionnable. L'image statique n'étant pas
 * cliquable par marker, cette liste rend le mode carte pleinement utilisable.
 */
const EpicerieRow = memo(function EpicerieRow({
  epicerie,
  userLocation,
  hasPromo,
  onPress,
}: {
  epicerie: GeoEpicerie;
  userLocation: LatLng | null;
  hasPromo: boolean;
  onPress: (id: number) => void;
}) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isOpen = epicerie.isOpen === true;
  const dist = distanceKm(epicerie, userLocation);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(epicerie.id)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={epicerie.nomEpicerie}
    >
      <View style={[styles.rowPin, { backgroundColor: isOpen ? '#16a34a' : '#9AA0A6' }]}>
        <Ionicons name="storefront" size={15} color="#fff" />
        {hasPromo && (
          <View style={styles.rowPromoDot}>
            <Text style={styles.rowPromoDotText}>%</Text>
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{epicerie.nomEpicerie}</Text>
        <View style={styles.rowMetaRow}>
          {epicerie.averageRating != null && epicerie.averageRating > 0 ? (
            <View style={styles.rowMetaItem}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={styles.rowMetaText}>{epicerie.averageRating.toFixed(1)}</Text>
            </View>
          ) : null}
          {dist != null && (
            <View style={styles.rowMetaItem}>
              <Ionicons name="location-outline" size={12} color="#666" />
              <Text style={styles.rowMetaText}>{formatDistance(dist)}</Text>
            </View>
          )}
          <View style={styles.rowMetaItem}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? '#16a34a' : '#9AA0A6' }]} />
            <Text style={[styles.rowMetaText, { color: isOpen ? '#16a34a' : '#888' }]}>
              {isOpen
                ? (t('epiceries.openNow') || 'Ouvert')
                : (t('epiceries.closedNow') || 'Fermé')}
            </Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.colors.brand} />
    </TouchableOpacity>
  );
});

/**
 * Vue carte STATIQUE (sûre par défaut) : image Google Static Maps + liste
 * d'épiceries sélectionnables. Aucun module natif de cartographie monté.
 */
function StaticEpiceriesMap({
  epiceries,
  userLocation,
  onSelectEpicerie,
  promoMap,
}: EpiceriesMapViewProps) {
  const { t } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);

  // Épiceries géolocalisées, triées par proximité et plafonnées (longueur URL).
  const geo = useMemo(
    () => nearestGeoEpiceries(epiceries, userLocation, MAX_STATIC_MARKERS),
    [epiceries, userLocation],
  );

  const uri = useMemo(() => buildStaticMapUrl(geo, userLocation), [geo, userLocation]);

  // Un échec ponctuel (hors-ligne, quota) ne masque pas la carte à vie :
  // on retente dès que l'URL change.
  useEffect(() => {
    setImgFailed(false);
  }, [uri]);

  const openInMaps = useCallback(() => {
    const target = userLocation ?? geo[0] ?? null;
    if (!target) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${coordStr(target)}`;
    Linking.openURL(url).catch(() => {});
  }, [userLocation, geo]);

  const handlePress = useCallback((id: number) => onSelectEpicerie(id), [onSelectEpicerie]);

  const renderRow = useCallback(
    ({ item }: { item: GeoEpicerie }) => (
      <EpicerieRow
        epicerie={item}
        userLocation={userLocation}
        hasPromo={promoMap?.has(item.id) ?? false}
        onPress={handlePress}
      />
    ),
    [userLocation, promoMap, handlePress],
  );

  const header = (
    <View style={styles.headerWrap}>
      {!GOOGLE_MAPS_KEY || !uri || imgFailed ? (
        <MapUnavailable />
      ) : (
        <TouchableOpacity activeOpacity={0.9} onPress={openInMaps}>
          <Image
            source={{ uri }}
            style={styles.staticImage}
            contentFit="cover"
            transition={150}
            onError={() => setImgFailed(true)}
            accessibilityLabel={t('epiceries.viewMap') || 'Carte'}
          />
        </TouchableOpacity>
      )}
      {geo.length > 0 && (
        <Text style={styles.hint}>
          {t('epiceries.mapStaticHint') || 'Aperçu — touchez une épicerie ci-dessous'}
        </Text>
      )}
    </View>
  );

  const empty = (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyEmoji}>🗺️</Text>
      <Text style={styles.emptyText}>
        {t('epiceries.mapNoEpiceries') || 'Aucune épicerie à afficher sur la carte'}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={geo}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderRow}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      removeClippedSubviews
    />
  );
}

/**
 * Marker mémoïsé (carte interactive). `tracksViewChanges` passe à false peu
 * après le montage : contenu statique par épicerie → on évite le re-render
 * continu des vues natives sous Android.
 */
const EpicerieMarker = memo(function EpicerieMarker({
  epicerie,
  isOpen,
  hasPromo,
  onPress,
}: {
  epicerie: GeoEpicerie;
  isOpen: boolean;
  hasPromo: boolean;
  onPress: (id: number) => void;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: epicerie.latitude, longitude: epicerie.longitude }}
      onPress={() => onPress(epicerie.id)}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.markerWrap}>
        <View style={[styles.markerPin, { backgroundColor: isOpen ? '#16a34a' : '#9AA0A6' }]}>
          <Ionicons name="storefront" size={13} color="#fff" />
        </View>
        {hasPromo && (
          <View style={styles.promoDot}>
            <Text style={styles.promoDotText}>%</Text>
          </View>
        )}
      </View>
    </Marker>
  );
});

/**
 * Vue carte INTERACTIVE (`<MapView>` natif). ⚠️ Montée UNIQUEMENT derrière le
 * flag `INTERACTIVE_MAP_ENABLED` et enveloppée dans `MapErrorBoundary`. Voir
 * l'avertissement en tête de fichier sur le crash natif New Arch.
 */
function InteractiveEpiceriesMap({
  epiceries,
  userLocation,
  onSelectEpicerie,
  promoMap,
}: EpiceriesMapViewProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const centeredRef = useRef(false);

  const points = useMemo(
    () => epiceries.filter(hasCoords).slice(0, MAX_MARKERS),
    [epiceries],
  );

  const initialRegion = useMemo<Region>(() => {
    if (userLocation) {
      return { ...userLocation, latitudeDelta: POINT_DELTA, longitudeDelta: POINT_DELTA };
    }
    return boundingRegion(points) ?? FALLBACK_REGION;
    // Valeur au premier rendu uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userLocation && mapRef.current) {
      centeredRef.current = true;
      mapRef.current.animateToRegion(
        { ...userLocation, latitudeDelta: POINT_DELTA, longitudeDelta: POINT_DELTA },
        400,
      );
    }
  }, [userLocation]);

  useEffect(() => {
    if (userLocation || centeredRef.current || points.length === 0 || !mapRef.current) return;
    const region = boundingRegion(points);
    if (region) {
      centeredRef.current = true;
      mapRef.current.animateToRegion(region, 400);
    }
  }, [userLocation, points]);

  useEffect(() => {
    if (selectedId != null && !points.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [points, selectedId]);

  const handleMarkerPress = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const markers = useMemo(
    () => points.map((e) => (
      <EpicerieMarker
        key={e.id}
        epicerie={e}
        isOpen={e.isOpen === true}
        hasPromo={promoMap?.has(e.id) ?? false}
        onPress={handleMarkerPress}
      />
    )),
    [points, promoMap, handleMarkerPress],
  );

  const selected = selectedId != null ? points.find((p) => p.id === selectedId) ?? null : null;
  const selectedDistance = selected ? distanceKm(selected, userLocation) : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => setSelectedId(null)}
      >
        {markers}
      </MapView>

      {points.length === 0 && (
        <View pointerEvents="none" style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={styles.emptyText}>
              {t('epiceries.mapNoEpiceries') || 'Aucune épicerie à afficher sur la carte'}
            </Text>
          </View>
        </View>
      )}

      {selected && (
        <View style={styles.calloutWrap}>
          <View style={styles.calloutCard}>
            <TouchableOpacity
              style={styles.calloutClose}
              onPress={() => setSelectedId(null)}
              hitSlop={10}
              accessibilityLabel={t('common.close') || 'Fermer'}
            >
              <Ionicons name="close" size={18} color="#888" />
            </TouchableOpacity>

            <Text style={styles.calloutName} numberOfLines={1}>
              {selected.nomEpicerie}
            </Text>

            <View style={styles.calloutMetaRow}>
              {selected.averageRating != null && selected.averageRating > 0 ? (
                <View style={styles.calloutMetaItem}>
                  <Ionicons name="star" size={13} color="#F5A623" />
                  <Text style={styles.calloutMetaText}>{selected.averageRating.toFixed(1)}</Text>
                </View>
              ) : null}

              {selectedDistance != null && (
                <View style={styles.calloutMetaItem}>
                  <Ionicons name="location-outline" size={13} color="#666" />
                  <Text style={styles.calloutMetaText}>{formatDistance(selectedDistance)}</Text>
                </View>
              )}

              <View style={styles.calloutMetaItem}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: selected.isOpen ? '#16a34a' : '#9AA0A6' },
                  ]}
                />
                <Text
                  style={[
                    styles.calloutMetaText,
                    { color: selected.isOpen ? '#16a34a' : '#888' },
                  ]}
                >
                  {selected.isOpen
                    ? (t('epiceries.openNow') || 'Ouvert')
                    : (t('epiceries.closedNow') || 'Fermé')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.calloutBtn, { backgroundColor: theme.colors.brand }]}
              onPress={() => onSelectEpicerie(selected.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.calloutBtnText}>{t('epiceries.viewShop') || 'Voir'}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * ErrorBoundary local : si le rendu JS de la carte interactive lève une erreur,
 * on retombe sur le rendu statique (sûr). ⚠️ Ne rattrape PAS un crash natif
 * (New Arch) — voir l'avertissement en tête de fichier.
 */
class MapErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[EpiceriesMapView] carte interactive en erreur → repli statique', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Point d'entrée de la vue carte. Choisit statique (défaut, sûr) vs interactif
 * (derrière le flag + ErrorBoundary). Les filtres/tri/recherche sont appliqués
 * en amont (le parent passe déjà `sortedEpiceries`).
 */
export function EpiceriesMapView(props: EpiceriesMapViewProps) {
  if (INTERACTIVE_MAP_ENABLED) {
    return (
      <MapErrorBoundary fallback={<StaticEpiceriesMap {...props} />}>
        <InteractiveEpiceriesMap {...props} />
      </MapErrorBoundary>
    );
  }
  return <StaticEpiceriesMap {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  // ── Vue statique ────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 24,
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  staticImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EAEFEA',
  },
  hint: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#777',
    textAlign: 'center',
  },
  fallback: {
    backgroundColor: '#F1F8E9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  fallbackEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 13,
    color: '#558B2F',
    textAlign: 'center',
  },
  // ── Rangée épicerie (liste statique) ────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  rowPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPromoDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  rowPromoDotText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  rowMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowMetaText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#555',
  },
  // ── Marker (carte interactive) ──────────────────────────────────────
  markerWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  promoDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  promoDotText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  // ── Empty ───────────────────────────────────────────────────────────
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginHorizontal: 24,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
  },
  // ── Callout flottant (carte interactive) ────────────────────────────
  calloutWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
  },
  calloutCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    paddingRight: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  calloutClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  calloutName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  calloutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 12,
  },
  calloutMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calloutMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calloutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  calloutBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
