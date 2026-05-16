/**
 * Libelles FR pour chaque permission backend (EpicierPermission).
 *
 * <p>Utilises par l'intercepteur 403 d'{@code api.ts} pour transformer
 * un nom enum ("PRODUCT_CREATE") en phrase contextualisee
 * ("Creation de produits").</p>
 */
export const PERMISSION_LABELS_FR: Record<string, string> = {
  PRODUCT_VIEW:          'Consultation des produits',
  PRODUCT_CREATE:        'Création de produits',
  PRODUCT_EDIT:          'Modification de produits',
  PRODUCT_DELETE:        'Suppression de produits',
  VARIANT_VIEW:          'Consultation des variantes',
  VARIANT_CREATE:        'Création de variantes',
  VARIANT_EDIT:          'Modification de variantes',
  VARIANT_DELETE:        'Suppression de variantes',
  STOCK_VIEW:            'Consultation du stock',
  STOCK_ADJUST:          'Ajustement du stock',
  BARCODE_VIEW:          'Consultation des codes-barres',
  BARCODE_MANAGE:        'Gestion des codes-barres',
  ORDER_VIEW:            'Consultation des commandes',
  ORDER_PROCESS:         'Traitement des commandes',
  DASHBOARD_VIEW:        'Tableau de bord',
  CLIENT_VIEW:           'Consultation des clients',
  CLIENT_INVITE:         'Invitation de clients',
  CLIENT_CREDIT_MANAGE:  'Gestion du crédit clients',
  LIVREUR_MANAGE:        'Gestion des livreurs',
  INVOICE_VIEW:          'Consultation des factures',
  STATS_VIEW:            'Statistiques',
  PROMOTION_MANAGE:      'Gestion des promotions',
  PROMO_CODE_MANAGE:     'Gestion des codes promos',
  SUPPLIER_MANAGE:       'Gestion des fournisseurs',
  COLLABORATEUR_VIEW:    'Consultation des collaborateurs',
  COLLABORATEUR_MANAGE:  'Gestion des collaborateurs',
  TAG_MANAGE:            'Gestion des tags',
  SYNONYM_MANAGE:        'Gestion des synonymes',
  SETTINGS_EDIT:         "Paramètres de l'épicerie",
};

export const COLLABORATOR_ROLE_LABELS_FR: Record<string, string> = {
  MANAGER:       'Manager',
  GESTIONNAIRE:  'Gestionnaire',
  CAISSIER:      'Caissier',
};

export function labelForPermission(name: string | null | undefined): string {
  if (!name) return '';
  return PERMISSION_LABELS_FR[name] ?? name;
}

import type { Feature } from '../hooks/usePermissions';

/**
 * Categorisation des Features pour la matrice de permissions.
 * Pendant exact du fichier core/models/permission-labels.ts cote web.
 */
export interface FeatureMeta {
  feature: Feature;
  label: string;
  description: string;
}

export interface FeatureCategory {
  key: string;
  label: string;
  icon: string;
  features: FeatureMeta[];
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    key: 'products', label: 'Catalogue', icon: '📦',
    features: [
      { feature: 'products:view',   label: 'Consulter les produits',  description: 'Voir le catalogue.' },
      { feature: 'products:create', label: 'Ajouter un produit',      description: 'Créer un nouveau produit.' },
      { feature: 'products:edit',   label: 'Modifier un produit',     description: 'Éditer nom, prix, photo.' },
      { feature: 'products:delete', label: 'Supprimer un produit',    description: 'Retirer du catalogue.' },
      { feature: 'variants:view',   label: 'Consulter les variantes', description: 'Voir les unités de vente.' },
      { feature: 'variants:create', label: 'Ajouter une variante',    description: 'Créer une unité de vente.' },
      { feature: 'variants:edit',   label: 'Modifier une variante',   description: 'Éditer prix, stock min.' },
      { feature: 'variants:delete', label: 'Supprimer une variante',  description: 'Retirer une unité.' },
      { feature: 'barcodes:view',   label: 'Consulter codes-barres',  description: 'Voir les codes-barres.' },
      { feature: 'barcodes:manage', label: 'Gérer les codes-barres',  description: 'Ajouter / retirer.' },
    ],
  },
  {
    key: 'stock', label: 'Stock', icon: '📊',
    features: [
      { feature: 'stock:view',    label: 'Consulter le stock',  description: 'Niveaux et alertes.' },
      { feature: 'stock:adjust',  label: 'Ajuster le stock',    description: 'Approvisionner, inventaire.' },
      { feature: 'stock:history', label: 'Historique du stock', description: 'Mouvements passés.' },
    ],
  },
  {
    key: 'orders', label: 'Commandes', icon: '🛒',
    features: [
      { feature: 'orders:view',    label: 'Consulter les commandes', description: 'Liste et détails.' },
      { feature: 'orders:process', label: 'Traiter les commandes',   description: 'Accepter, préparer, livrer.' },
    ],
  },
  {
    key: 'clients', label: 'Clients', icon: '👥',
    features: [
      { feature: 'clients:invite', label: 'Inviter un client',      description: 'Ajouter au carnet.' },
      { feature: 'clients:credit', label: 'Gérer le crédit client', description: 'Avances et factures.' },
    ],
  },
  {
    key: 'sales', label: 'Ventes & promos', icon: '🎉',
    features: [
      { feature: 'promotions:manage', label: 'Gérer les promotions', description: 'Promos sur produits.' },
      { feature: 'promoCodes:manage', label: 'Codes promo',          description: 'Codes au checkout.' },
    ],
  },
  {
    key: 'operations', label: 'Opérations', icon: '🚚',
    features: [
      { feature: 'livreurs:manage',  label: 'Gérer les livreurs',     description: 'Inviter, assigner.' },
      { feature: 'suppliers:manage', label: 'Gérer les fournisseurs', description: 'Carnet et réceptions.' },
      { feature: 'synonyms:manage',  label: 'Mots-clés recherche',    description: 'Synonymes darija/fr.' },
    ],
  },
  {
    key: 'finance', label: 'Finance', icon: '💰',
    features: [
      { feature: 'invoices:view',  label: 'Consulter les factures', description: 'Encours et paiements.' },
      { feature: 'stats:view',     label: 'Statistiques',           description: 'Ventes et performances.' },
      { feature: 'dashboard:view', label: 'Tableau de bord',        description: 'Vue du jour.' },
    ],
  },
  {
    key: 'admin', label: 'Administration', icon: '⚙️',
    features: [
      { feature: 'collaborateurs:view',   label: 'Voir l\'équipe',      description: 'Liste collaborateurs.' },
      { feature: 'collaborateurs:manage', label: 'Gérer l\'équipe',     description: 'Inviter, révoquer.' },
      { feature: 'settings:edit',         label: 'Paramètres épicerie', description: 'Horaires, livraison.' },
    ],
  },
];

export const PROFILE_SHORT_LABELS: Record<string, string> = {
  owner:        'Propriétaire',
  manager:      'Manager',
  gestionnaire: 'Gestionnaire',
  caissier:     'Caissier',
};
