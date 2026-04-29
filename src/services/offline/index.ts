/**
 * Module Offline — Point d'entrée
 *
 * Exporte la façade principale et les sous-modules pour les cas avancés.
 * Les services métier ne devraient utiliser que `offlineService`.
 */

export { offlineService } from './offlineService';
export { cacheService } from './cacheService';
export { networkService } from './networkService';
export { syncQueue } from './syncQueue';

// Types
export type { CacheEntry, CacheOptions, CacheNamespace } from './cacheService';
export type { ConnectivityStatus, NetworkState, NetworkListener } from './networkService';
export type { SyncOperation, SyncResult, SyncDomain, SyncOperationStatus } from './syncQueue';
export type { FetchOptions, WriteOptions, OfflineEvent, OfflineEventType } from './offlineService';
