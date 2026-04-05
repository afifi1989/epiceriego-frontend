/**
 * Hook de gestion des permissions par fonctionnalité.
 * Les collaborateurs sont des utilisateurs EPICIER avec un collaboratorRole
 * (MANAGER | GESTIONNAIRE | CAISSIER). Sans collaboratorRole = propriétaire.
 */

import { useMemo } from 'react';
import { LoginResponse } from '../type';

export type Feature =
  | 'products:view' | 'products:create' | 'products:edit' | 'products:delete'
  | 'variants:view' | 'variants:create' | 'variants:edit' | 'variants:delete'
  | 'stock:view' | 'stock:adjust' | 'stock:history'
  | 'barcodes:view' | 'barcodes:manage'
  | 'orders:view' | 'orders:process'
  | 'dashboard:view'
  | 'collaborateurs:view' | 'collaborateurs:manage'
  | 'settings:edit'
  | 'clients:invite' | 'clients:credit'
  | 'livreurs:manage'
  | 'invoices:view'
  | 'stats:view'
  | 'promotions:manage';

export type UserProfile = 'owner' | 'manager' | 'gestionnaire' | 'caissier';

export const PROFILE_PERMISSIONS: Record<UserProfile, Feature[]> = {
  owner: [
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'variants:view', 'variants:create', 'variants:edit', 'variants:delete',
    'stock:view', 'stock:adjust', 'stock:history',
    'barcodes:view', 'barcodes:manage',
    'orders:view', 'orders:process',
    'dashboard:view',
    'collaborateurs:view', 'collaborateurs:manage',
    'settings:edit',
    'clients:invite', 'clients:credit',
    'livreurs:manage',
    'invoices:view',
    'stats:view',
    'promotions:manage',
  ],
  manager: [
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'variants:view', 'variants:create', 'variants:edit', 'variants:delete',
    'stock:view', 'stock:adjust', 'stock:history',
    'barcodes:view', 'barcodes:manage',
    'orders:view', 'orders:process',
    'dashboard:view',
    'collaborateurs:view',
    'settings:edit',
    'clients:invite', 'clients:credit',
    'livreurs:manage',
    'invoices:view',
    'stats:view',
    'promotions:manage',
  ],
  gestionnaire: [
    'products:view', 'products:create', 'products:edit',
    'variants:view', 'variants:create', 'variants:edit',
    'stock:view', 'stock:adjust', 'stock:history',
    'barcodes:view',
    'orders:view', 'orders:process',
    'dashboard:view',
    'clients:invite', 'clients:credit',
    'invoices:view',
    'stats:view',
    'promotions:manage',
  ],
  caissier: [
    'products:view',
    'orders:view', 'orders:process',
    'dashboard:view',
    'clients:invite',
  ],
};

/** Dérive le profil de permissions à partir des données utilisateur stockées */
export function getUserProfile(user: LoginResponse | null): UserProfile {
  if (!user || user.role !== 'EPICIER') return 'caissier';

  if (user.collaboratorRole) {
    switch (user.collaboratorRole) {
      case 'MANAGER':      return 'manager';
      case 'GESTIONNAIRE': return 'gestionnaire';
      case 'CAISSIER':     return 'caissier';
    }
  }
  return 'owner';
}

export function usePermissions(user: LoginResponse | null) {
  const profile = useMemo(() => getUserProfile(user), [user]);
  const permissions = PROFILE_PERMISSIONS[profile];

  const can = (feature: Feature) => permissions.includes(feature);
  const canAny = (...features: Feature[]) => features.some(f => can(f));
  const canAll = (...features: Feature[]) => features.every(f => can(f));

  return { profile, can, canAny, canAll };
}
