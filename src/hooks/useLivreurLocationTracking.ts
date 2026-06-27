import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { livreurService } from '../services/livreurService';
import { locationTrackingService } from '../services/locationTrackingService';

/**
 * Tracking GPS continu du livreur — stratégie en deux niveaux :
 *
 * 1. **Arrière-plan** (préféré) : si la permission « toujours » est accordée,
 *    le tracking continue même app fermée/écran éteint, via
 *    {@link locationTrackingService} (expo-task-manager). C'est le mode
 *    nominal d'un livreur en course, téléphone en poche.
 *
 * 2. **Foreground** (fallback) : si la permission background est refusée ou
 *    indisponible (Expo Go), on retombe sur un `watchPositionAsync` actif
 *    uniquement app ouverte — le comportement de la phase 1.
 *
 * Dans les deux cas le throttling est fait à la source (30 m / 15 s) et
 * chaque position part en best-effort vers PUT /livreurs/location.
 */

/** Distance minimale (m) entre deux émissions de position. */
const DISTANCE_INTERVAL_M = 30;
/** Intervalle minimal (ms) entre deux émissions de position. */
const TIME_INTERVAL_MS = 15_000;

/** Flag AsyncStorage : la divulgation background a déjà été acceptée. */
const BG_DISCLOSURE_KEY = 'livreur_bg_location_disclosure_v1';

/**
 * « Prominent disclosure » exigée par Google Play AVANT toute demande de
 * permission de localisation en arrière-plan : fenêtre dans l'app qui
 * explique quelle donnée est collectée, pourquoi, et mentionne explicitement
 * l'arrière-plan. Sans elle, la review Play rejette la version.
 *
 * Affichée une seule fois (acceptation persistée). Un refus n'est PAS
 * persisté : l'appelant bascule sur le tracking foreground, et la question
 * sera reposée à la prochaine session — le livreur peut changer d'avis.
 */
const askBackgroundDisclosure = async (): Promise<boolean> => {
  try {
    if ((await AsyncStorage.getItem(BG_DISCLOSURE_KEY)) === 'accepted') return true;
  } catch {
    // Lecture impossible → on repose la question, jamais bloquant
  }
  return new Promise(resolve => {
    Alert.alert(
      'Partage de position en arrière-plan',
      "Pendant que vous êtes en ligne, AbridGO collecte votre position et la partage avec les clients pour qu'ils suivent leur livraison en temps réel — y compris lorsque l'application est en arrière-plan ou que l'écran est éteint.\n\nUne notification reste visible tant que le partage est actif, et il s'arrête dès que vous passez hors ligne.",
      [
        { text: 'Pas maintenant', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Continuer',
          onPress: () => {
            AsyncStorage.setItem(BG_DISCLOSURE_KEY, 'accepted').catch(() => {});
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
};

export function useLivreurLocationTracking(enabled: boolean) {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startForegroundWatch = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: TIME_INTERVAL_MS,
            distanceInterval: DISTANCE_INTERVAL_M,
          },
          position => {
            livreurService
              .updateLocation(position.coords.latitude, position.coords.longitude)
              .catch(() => {
                // Best-effort : la prochaine position rattrapera
              });
          }
        );
      } catch {
        // Permission refusée ou GPS indisponible — le tracking est
        // un enrichissement, jamais bloquant pour le livreur.
      }
    };

    const startTracking = async () => {
      // Divulgation Play AVANT la demande de permission « toujours ».
      // Refus → on n'insiste pas : tracking foreground uniquement.
      const disclosed = await askBackgroundDisclosure();
      if (cancelled) return;
      if (!disclosed) {
        await startForegroundWatch();
        return;
      }

      const backgroundStarted = await locationTrackingService.startBackgroundTracking();
      if (cancelled) {
        await locationTrackingService.stopBackgroundTracking();
        return;
      }
      if (!backgroundStarted) {
        await startForegroundWatch();
      }
    };

    const stopTracking = () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      locationTrackingService.stopBackgroundTracking().catch(() => {});
    };

    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [enabled]);
}
