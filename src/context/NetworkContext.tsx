/**
 * NetworkContext — Context React pour l'état réseau et le mode offline
 *
 * Fournit à toute l'app :
 * - isOnline : état de connectivité
 * - isSyncing : sync en cours
 * - pendingCount : opérations en attente
 * - lastSyncDate : dernière sync réussie
 * - triggerSync() : forcer une sync manuelle
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { offlineService } from '../services/offline';
import { syncQueue } from '../services/offline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetworkContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncDate: Date | null;
  triggerSync: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const initialized = useRef(false);

  // Initialiser le système offline
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const setup = async () => {
      await offlineService.initialize();
      setIsOnline(offlineService.isOnline());
      setPendingCount(offlineService.getPendingSyncCount());
    };

    setup();

    // Écouter les événements offline
    const removeOfflineListener = offlineService.addEventListener((event) => {
      switch (event.type) {
        case 'status:change': {
          const state = event.data as { status: string };
          setIsOnline(state.status === 'online');
          break;
        }
        case 'sync:start':
          setIsSyncing(true);
          break;
        case 'sync:complete':
          setIsSyncing(false);
          setLastSyncDate(new Date());
          setPendingCount(offlineService.getPendingSyncCount());
          break;
        case 'sync:error':
          setIsSyncing(false);
          break;
      }
    });

    // Écouter les changements de la queue
    const removeQueueListener = syncQueue.addListener((queue) => {
      setPendingCount(queue.filter((op) => op.status === 'pending' || op.status === 'failed').length);
    });

    return () => {
      removeOfflineListener();
      removeQueueListener();
      offlineService.teardown();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    await offlineService.syncPendingOperations();
  }, [isOnline, isSyncing]);

  return (
    <NetworkContext.Provider
      value={{ isOnline, isSyncing, pendingCount, lastSyncDate, triggerSync }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork doit être utilisé dans un <NetworkProvider>');
  }
  return context;
}
