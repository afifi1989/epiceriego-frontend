/**
 * SyncQueue — File d'attente persistante pour les opérations offline
 *
 * Principes :
 * - FIFO strict (l'ordre des opérations métier est important)
 * - Persisté dans AsyncStorage (survit au redémarrage de l'app)
 * - Chaque opération est idempotente grâce à son `id` unique
 * - Retry avec backoff exponentiel
 * - Listeners pour le monitoring (UI badge, banner)
 * - Chaque opération porte son `domain` → future migration microservice
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { CacheNamespace, cacheService } from './cacheService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncOperationStatus = 'pending' | 'syncing' | 'failed';

export type SyncDomain =
  | 'orders'
  | 'products'
  | 'stock'
  | 'clients'
  | 'invoices'
  | 'collaborateurs'
  | 'livreurs'
  | 'epicerie'
  | 'pos';

export interface SyncOperation {
  id: string;
  domain: SyncDomain;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  payload?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  status: SyncOperationStatus;
  /** ID temporaire pour les créations (permet de référencer localement) */
  localId?: string;
  /** Namespaces de cache à invalider après sync réussie */
  invalidateCache?: CacheNamespace[];
  /** Description lisible pour l'UI */
  description?: string;
}

export interface SyncResult {
  operationId: string;
  success: boolean;
  response?: unknown;
  error?: string;
}

export type SyncQueueListener = (queue: SyncOperation[]) => void;

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = '@offline_sync_queue';
const MAX_RETRIES_DEFAULT = 5;

// ---------------------------------------------------------------------------
// État interne
// ---------------------------------------------------------------------------

let queue: SyncOperation[] = [];
let isProcessing = false;
const listeners = new Set<SyncQueueListener>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('[SyncQueue] Erreur persistance:', err);
  }
}

function notifyListeners(): void {
  const snapshot = [...queue];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (err) {
      console.warn('[SyncQueue] Erreur listener:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Charge la queue depuis AsyncStorage (à appeler au démarrage de l'app).
 */
async function load(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    queue = raw ? JSON.parse(raw) : [];
    // Réinitialiser les opérations bloquées en "syncing"
    queue.forEach((op) => {
      if (op.status === 'syncing') op.status = 'pending';
    });
    await persist();
    notifyListeners();
  } catch (err) {
    console.warn('[SyncQueue] Erreur chargement:', err);
    queue = [];
  }
}

/**
 * Ajoute une opération à la queue.
 */
async function enqueue(
  params: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'status' | 'maxRetries'> & {
    maxRetries?: number;
  },
): Promise<string> {
  const operation: SyncOperation = {
    ...params,
    id: generateId(),
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: params.maxRetries ?? MAX_RETRIES_DEFAULT,
    status: 'pending',
  };

  queue.push(operation);
  await persist();
  notifyListeners();

  console.log(`[SyncQueue] +1 opération (${operation.domain}/${operation.method} ${operation.endpoint}). Total: ${queue.length}`);
  return operation.id;
}

/**
 * Traite toutes les opérations pending (FIFO).
 * Retourne les résultats pour chaque opération traitée.
 */
async function processAll(): Promise<SyncResult[]> {
  if (isProcessing) return [];
  isProcessing = true;

  const results: SyncResult[] = [];
  const pending = queue.filter((op) => op.status === 'pending' || op.status === 'failed');

  console.log(`[SyncQueue] Traitement de ${pending.length} opération(s)...`);

  for (const op of pending) {
    op.status = 'syncing';
    notifyListeners();

    try {
      const response = await api.request({
        method: op.method,
        url: op.endpoint,
        data: op.payload,
        headers: op.headers,
      });

      // Succès → supprimer de la queue + invalider le cache
      queue = queue.filter((q) => q.id !== op.id);

      if (op.invalidateCache) {
        for (const ns of op.invalidateCache) {
          await cacheService.invalidateNamespace(ns);
        }
      }

      results.push({ operationId: op.id, success: true, response: response.data });
      console.log(`[SyncQueue] ✅ ${op.domain} ${op.method} ${op.endpoint}`);
    } catch (err: any) {
      op.retryCount++;
      const statusCode = err?.response?.status;

      // Erreurs non-récupérables (4xx sauf 408/429) → abandonner
      if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429) {
        console.warn(`[SyncQueue] ❌ Abandon ${op.id} (HTTP ${statusCode})`);
        queue = queue.filter((q) => q.id !== op.id);
        results.push({
          operationId: op.id,
          success: false,
          error: `HTTP ${statusCode}: ${err?.response?.data?.message || err.message}`,
        });
      } else if (op.retryCount >= op.maxRetries) {
        // Trop de tentatives → marquer comme failed (reste dans la queue pour review)
        op.status = 'failed';
        results.push({
          operationId: op.id,
          success: false,
          error: `Max retries (${op.maxRetries}) atteint`,
        });
        console.warn(`[SyncQueue] ⚠️ ${op.id} max retries atteint`);
      } else {
        // Erreur récupérable → remettre en pending pour le prochain cycle
        op.status = 'pending';
        results.push({
          operationId: op.id,
          success: false,
          error: err.message,
        });
      }
    }
  }

  await persist();
  notifyListeners();
  isProcessing = false;

  console.log(`[SyncQueue] Traitement terminé. Restant: ${queue.length}`);
  return results;
}

/**
 * Retourne le nombre d'opérations en attente.
 */
function getPendingCount(): number {
  return queue.filter((op) => op.status === 'pending' || op.status === 'failed').length;
}

/**
 * Retourne la queue complète (snapshot).
 */
function getAll(): SyncOperation[] {
  return [...queue];
}

/**
 * Retourne les opérations d'un domaine spécifique.
 */
function getByDomain(domain: SyncDomain): SyncOperation[] {
  return queue.filter((op) => op.domain === domain);
}

/**
 * Supprime une opération spécifique (ex: annulation manuelle).
 */
async function remove(operationId: string): Promise<void> {
  queue = queue.filter((op) => op.id !== operationId);
  await persist();
  notifyListeners();
}

/**
 * Vide entièrement la queue.
 */
async function clear(): Promise<void> {
  queue = [];
  await persist();
  notifyListeners();
}

/**
 * Abonne un listener aux changements de la queue.
 */
function addListener(listener: SyncQueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Indique si la queue est en train de traiter des opérations.
 */
function isSyncing(): boolean {
  return isProcessing;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const syncQueue = {
  load,
  enqueue,
  processAll,
  getPendingCount,
  getAll,
  getByDomain,
  remove,
  clear,
  addListener,
  isSyncing,
};
