/**
 * NetworkService — Détection de connectivité réseau
 *
 * Module isolé basé sur @react-native-community/netinfo.
 * Expose un modèle événementiel (listeners) + état synchrone.
 * Aucune dépendance vers les autres modules offline → peut être
 * remplacé indépendamment (ex: WebSocket heartbeat).
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

export interface NetworkState {
  status: ConnectivityStatus;
  /** Type de connexion (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Timestamp de la dernière transition */
  lastChanged: number;
}

export type NetworkListener = (state: NetworkState) => void;

// ---------------------------------------------------------------------------
// État interne
// ---------------------------------------------------------------------------

let currentState: NetworkState = {
  status: 'unknown',
  connectionType: null,
  lastChanged: Date.now(),
};

const listeners = new Set<NetworkListener>();
let unsubscribeNetInfo: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapNetInfoState(info: NetInfoState): NetworkState {
  const isConnected = info.isConnected && info.isInternetReachable !== false;

  return {
    status: isConnected === null ? 'unknown' : isConnected ? 'online' : 'offline',
    connectionType: info.type ?? null,
    lastChanged: Date.now(),
  };
}

function notifyListeners(state: NetworkState): void {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (err) {
      console.warn('[NetworkService] Erreur dans listener:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Démarre l'écoute réseau. Idempotent (appeler plusieurs fois est sûr).
 */
function start(): void {
  if (unsubscribeNetInfo) return;

  unsubscribeNetInfo = NetInfo.addEventListener((info) => {
    const prev = currentState.status;
    currentState = mapNetInfoState(info);

    // Notifier uniquement sur transition réelle
    if (prev !== currentState.status) {
      console.log(`[NetworkService] ${prev} → ${currentState.status} (${currentState.connectionType})`);
      notifyListeners(currentState);
    }
  });

  // État initial
  NetInfo.fetch().then((info) => {
    const prev = currentState.status;
    currentState = mapNetInfoState(info);
    if (prev === 'unknown' && currentState.status !== 'unknown') {
      notifyListeners(currentState);
    }
  });
}

/**
 * Arrête l'écoute réseau.
 */
function stop(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}

/**
 * Retourne l'état courant (synchrone).
 */
function getState(): NetworkState {
  return { ...currentState };
}

/**
 * Raccourci : true si le réseau est disponible.
 */
function isOnline(): boolean {
  return currentState.status === 'online';
}

/**
 * Abonne un listener aux changements de connectivité.
 * Retourne une fonction de désabonnement.
 */
function addListener(listener: NetworkListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Force un re-check immédiat de la connectivité.
 */
async function refresh(): Promise<NetworkState> {
  const info = await NetInfo.fetch();
  const prev = currentState.status;
  currentState = mapNetInfoState(info);

  if (prev !== currentState.status) {
    notifyListeners(currentState);
  }

  return { ...currentState };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const networkService = {
  start,
  stop,
  getState,
  isOnline,
  addListener,
  refresh,
};
