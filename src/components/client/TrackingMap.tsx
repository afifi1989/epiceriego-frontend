import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';

/** Point géographique nommé, prêt à afficher. */
interface MapPoint {
  latitude: number;
  longitude: number;
}

interface TrackingMapProps {
  /** Position courante du livreur (obligatoire — la carte n'est rendue qu'avec). */
  livreur: MapPoint;
  /** Épicerie de départ (optionnelle). */
  epicerie?: MapPoint | null;
  /** Destination de livraison (optionnelle). */
  destination?: MapPoint | null;
}

/**
 * Clé Google Maps. Static Maps est un service web : la même clé que le module
 * natif fonctionne (vérifié), sans dépendre de react-native-maps.
 *
 * Source primaire = `extra.googleMapsApiKey` (toujours exposé dans
 * `Constants.expoConfig.extra`, en dev comme en build prod). Fallback =
 * `android.config.googleMaps.apiKey` pour rétro-compat. ⚠️ Toute modif de
 * app.json nécessite un redémarrage du serveur Expo (`npx expo start -c`) —
 * un simple reload Metro ne relit pas la config.
 */
const GOOGLE_MAPS_KEY: string =
  (Constants.expoConfig?.extra as any)?.googleMapsApiKey ??
  (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ??
  '';

/** Dimensions logiques demandées au service Static Maps (scale=2 pour la netteté). */
const MAP_W = 600;
const MAP_H = 280;

const coord = (p: MapPoint) => `${p.latitude},${p.longitude}`;

/**
 * Construit l'URL Google **Static Maps** :
 *  - auto-cadrage (`visible`) sur tous les points connus,
 *  - marqueurs colorés : L = livreur (vert), E = épicerie (bleu), D = destination (rouge),
 *  - tracé livreur → destination.
 *
 * Rendu comme simple image : aucun module natif, donc aucun risque de crash
 * (contrairement à `react-native-maps` qui fermait l'app au montage du
 * `<MapView>` sous la New Architecture).
 */
function buildStaticMapUrl({ livreur, epicerie, destination }: TrackingMapProps): string {
  const PIPE = '%7C';
  const params: string[] = [`size=${MAP_W}x${MAP_H}`, 'scale=2', 'maptype=roadmap'];

  const points = [livreur, epicerie, destination].filter((p): p is MapPoint => p != null);
  if (points.length <= 1) {
    params.push(`center=${coord(livreur)}`, 'zoom=15');
  } else {
    // Cadre automatiquement la carte sur l'ensemble des points.
    params.push(`visible=${points.map(coord).join(PIPE)}`);
  }

  params.push(`markers=color:0x4CAF50${PIPE}label:L${PIPE}${coord(livreur)}`);
  if (epicerie) params.push(`markers=color:0x2196F3${PIPE}label:E${PIPE}${coord(epicerie)}`);
  if (destination) params.push(`markers=color:0xF44336${PIPE}label:D${PIPE}${coord(destination)}`);
  if (destination) {
    params.push(`path=color:0x4CAF50ff${PIPE}weight:4${PIPE}${coord(livreur)}${PIPE}${coord(destination)}`);
  }

  params.push(`key=${GOOGLE_MAPS_KEY}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}

/** Placeholder affiché quand la carte ne peut pas se charger (clé absente / hors-ligne / quota). */
const MapUnavailable = () => {
  const { t } = useLanguage();
  return (
    <View style={[styles.container, styles.fallback]}>
      <Text style={styles.fallbackEmoji}>🗺️</Text>
      <Text style={styles.fallbackText}>{t('orderDetail.trackingMapUnavailable')}</Text>
    </View>
  );
};

/**
 * Carte de suivi de livraison (image Google Static Maps).
 *
 * Affiche la position du livreur 🛵 (+ épicerie 🏪 / destination 🏠 si connues)
 * et le tracé livreur → destination. L'image se rafraîchit à chaque polling
 * (l'URL change avec les coordonnées). Tappable → ouvre la position du livreur
 * dans l'app Google Maps.
 */
export const TrackingMap = (props: TrackingMapProps) => {
  const [failed, setFailed] = useState(false);
  const uri = GOOGLE_MAPS_KEY ? buildStaticMapUrl(props) : '';

  // Un échec ponctuel (hors-ligne, quota momentané) ne doit pas masquer la
  // carte à vie : on retente dès que l'URL change (nouvelles coords au polling).
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!GOOGLE_MAPS_KEY || failed) {
    return <MapUnavailable />;
  }

  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${coord(props.livreur)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={openInMaps} style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.map}
        contentFit="cover"
        transition={150}
        onError={() => setFailed(true)}
        accessibilityLabel="Carte de suivi de la livraison"
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  fallback: {
    backgroundColor: '#F1F8E9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
});
