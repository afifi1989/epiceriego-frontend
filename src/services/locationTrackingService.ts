import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { livreurService } from './livreurService';

/**
 * Tracking GPS arrière-plan du livreur (phase 2).
 *
 * La tâche {@link LOCATION_TASK_NAME} est exécutée par l'OS même quand
 * l'application est en arrière-plan (Android : service au premier plan avec
 * notification persistante ; iOS : background mode "location").
 *
 * IMPORTANT : `TaskManager.defineTask` doit être appelé dans le scope global
 * d'un module importé au démarrage de l'app — ce module est importé par
 * `app/_layout.tsx`. Ne pas déplacer la définition dans une fonction.
 *
 * Nécessite un build de développement / production (expo-task-manager et le
 * background location ne fonctionnent PAS dans Expo Go).
 */

export const LOCATION_TASK_NAME = 'abridgo-livreur-location-task';

/** Distance minimale (m) entre deux émissions de position. */
const DISTANCE_INTERVAL_M = 30;
/** Intervalle minimal (ms) entre deux émissions de position. */
const TIME_INTERVAL_MS = 15_000;
/** Garde-fou anti-rafale : n'envoie jamais plus d'une position par fenêtre. */
const MIN_SEND_INTERVAL_MS = 10_000;

let lastSentAt = 0;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  // L'OS peut livrer les positions par lots (deferred updates) : on
  // n'envoie que la plus récente, et jamais plus d'une par fenêtre.
  const now = Date.now();
  if (now - lastSentAt < MIN_SEND_INTERVAL_MS) return;
  lastSentAt = now;

  try {
    await livreurService.updateLocation(latest.coords.latitude, latest.coords.longitude);
  } catch {
    // Best-effort : la prochaine position rattrapera
  }
});

export const locationTrackingService = {
  /**
   * Démarre le tracking arrière-plan.
   * @returns true si démarré, false si la permission « toujours » est refusée
   *          (l'appelant doit alors basculer sur le tracking foreground).
   */
  startBackgroundTracking: async (): Promise<boolean> => {
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') return false;

      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status !== 'granted') return false;

      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (alreadyRunning) return true;

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: TIME_INTERVAL_MS,
        distanceInterval: DISTANCE_INTERVAL_M,
        // Android : notification persistante obligatoire (service premier plan)
        foregroundService: {
          notificationTitle: 'AbridGO — Livraison en cours',
          notificationBody: 'Votre position est partagée avec vos clients pendant vos livraisons.',
          notificationColor: '#9C27B0',
        },
        // iOS : indicateur visuel + pas de pause automatique pendant une course
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });

      return true;
    } catch {
      // Expo Go, permission révoquée, GPS désactivé… → fallback foreground
      return false;
    }
  },

  /** Arrête le tracking arrière-plan s'il est actif (idempotent). */
  stopBackgroundTracking: async (): Promise<void> => {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (running) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch {
      // Tâche non définie (Expo Go) — rien à arrêter
    }
  },

  /** Le tracking arrière-plan est-il en cours ? */
  isBackgroundTrackingActive: async (): Promise<boolean> => {
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      return false;
    }
  },
};
