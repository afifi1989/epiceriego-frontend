/**
 * Utilitaires de calcul pour les units
 */

import { ProductUnit } from '../type';

/**
 * Calculer le prix total basé sur une unit et quantité
 */
export const calculateUnitPrice = (
  unit: ProductUnit,
  requestedQuantity: number
): number => {
  // requestedQuantity = nombre de formats que le client veut (ex: 2 paquets de 500g)
  // unit.prix = prix d'UN format — donc total = prix × quantité demandée
  return unit.prix * requestedQuantity;
};

/**
 * Vérifier si on peut commander cette quantité
 */
export const canOrder = (
  unit: ProductUnit,
  requestedQuantity: number
): boolean => {
  // requestedQuantity = nombre de formats commandés, stock = nombre de formats disponibles
  return unit.stock >= requestedQuantity && unit.isAvailable;
};

/**
 * Calculer le nombre d'unités nécessaires
 */
export const calculateUnitsNeeded = (
  unit: ProductUnit,
  requestedQuantity: number
): number => {
  return requestedQuantity;
};

/**
 * Formater le label de quantité
 */
export const formatQuantity = (
  unit: ProductUnit,
  quantity: number
): string => {
  return `${quantity} × ${unit.label}`;
};

/**
 * Obtenir le niveau de stock avec couleur
 */
export const getStockLevel = (
  stock: number
): { level: 'high' | 'medium' | 'low' | 'out'; label: string; color: string } => {
  if (stock > 20) {
    return { level: 'high', label: 'En stock', color: 'success' };
  } else if (stock > 5) {
    return { level: 'medium', label: 'Stock limité', color: 'warning' };
  } else if (stock > 0) {
    return { level: 'low', label: `Derniers ${stock}`, color: 'warning' };
  } else {
    return { level: 'out', label: 'Rupture', color: 'error' };
  }
};
