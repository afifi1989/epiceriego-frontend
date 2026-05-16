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
  | 'promotions:manage'
  | 'promoCodes:manage'
  | 'suppliers:manage'
  | 'synonyms:manage';

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
    'promoCodes:manage',
    'suppliers:manage',
    'synonyms:manage',
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
    'promoCodes:manage',
    'suppliers:manage',
    'synonyms:manage',
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
    'promoCodes:manage',
    'suppliers:manage',
    'synonyms:manage',
  ],
  caissier: [
    'products:view',
    'orders:view', 'orders:process',
    'dashboard:view',
    'clients:invite',
  ],
};

/**
 * Correspondance Feature (côté front) ↔ EpicierPermission (enum backend).
 *
 * Permet à {@link usePermissions} de consommer directement la liste
 * `permissions[]` renvoyée par le backend (login/refresh/me/permissions)
 * sans dupliquer la matrice : on vérifie que le nom backend est dans la liste.
 * Une Feature sans équivalent backend dédié (ex: 'stock:history') est mappée
 * sur le permission proche (STOCK_VIEW) — c'est cohérent avec l'enforcement.
 */
export const FEATURE_TO_BACKEND: Record<Feature, string> = {
  'products:view':         'PRODUCT_VIEW',
  'products:create':       'PRODUCT_CREATE',
  'products:edit':         'PRODUCT_EDIT',
  'products:delete':       'PRODUCT_DELETE',
  'variants:view':         'VARIANT_VIEW',
  'variants:create':       'VARIANT_CREATE',
  'variants:edit':         'VARIANT_EDIT',
  'variants:delete':       'VARIANT_DELETE',
  'stock:view':            'STOCK_VIEW',
  'stock:adjust':          'STOCK_ADJUST',
  'stock:history':         'STOCK_VIEW',
  'barcodes:view':         'BARCODE_VIEW',
  'barcodes:manage':       'BARCODE_MANAGE',
  'orders:view':           'ORDER_VIEW',
  'orders:process':        'ORDER_PROCESS',
  'dashboard:view':        'DASHBOARD_VIEW',
  'collaborateurs:view':   'COLLABORATEUR_VIEW',
  'collaborateurs:manage': 'COLLABORATEUR_MANAGE',
  'settings:edit':         'SETTINGS_EDIT',
  'clients:invite':        'CLIENT_INVITE',
  'clients:credit':        'CLIENT_CREDIT_MANAGE',
  'livreurs:manage':       'LIVREUR_MANAGE',
  'invoices:view':         'INVOICE_VIEW',
  'stats:view':            'STATS_VIEW',
  'promotions:manage':     'PROMOTION_MANAGE',
  'promoCodes:manage':     'PROMO_CODE_MANAGE',
  'suppliers:manage':      'SUPPLIER_MANAGE',
  'synonyms:manage':       'SYNONYM_MANAGE',
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

/**
 * Hook de permissions.
 *
 * <p><b>Source de vérité : le backend.</b> Si {@code user.permissions} est présent
 * (renvoyé par login/refresh/me/permissions depuis V97+), on consulte cette liste
 * — c'est la même que celle utilisée côté serveur pour autoriser/refuser.</p>
 *
 * <p>Fallback : si la liste backend est absente (ancienne API, mode dégradé),
 * on retombe sur {@link PROFILE_PERMISSIONS} dérivée du collaboratorRole.</p>
 */
export function usePermissions(user: LoginResponse | null) {
  const profile = useMemo(() => getUserProfile(user), [user]);
  const fallback = PROFILE_PERMISSIONS[profile];
  const backendList = user?.permissions;

  const can = (feature: Feature) => {
    if (Array.isArray(backendList)) {
      return backendList.includes(FEATURE_TO_BACKEND[feature]);
    }
    return fallback.includes(feature);
  };
  const canAny = (...features: Feature[]) => features.some(f => can(f));
  const canAll = (...features: Feature[]) => features.every(f => can(f));

  return { profile, can, canAny, canAll };
}
