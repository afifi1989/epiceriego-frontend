/**
 * Service de gestion des mouvements de stock.
 *
 * Phase 1 : delta appliqué via updateUnit, historique en mémoire (session).
 * Phase 2 : appeler POST /products/{id}/stock-movements quand l'API sera prête.
 */

import { ProductUnit, ProductUnitRequest } from '../type';
import { unitService } from './unitService';

export type StockMovementType = 'ENTREE' | 'SORTIE';

export type StockAdjustmentReason =
  | 'RECEPTION'
  | 'INVENTAIRE'
  | 'CASSE'
  | 'EXPIRATION'
  | 'PERTE'
  | 'RETOUR'
  | 'AUTRE';

export const STOCK_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  RECEPTION:  'Réception marchandise',
  INVENTAIRE: 'Correction inventaire',
  CASSE:      'Casse / Détérioration',
  EXPIRATION: 'Produit expiré',
  PERTE:      'Perte',
  RETOUR:     'Retour client',
  AUTRE:      'Autre'
};

export interface StockMovement {
  id: string;
  productId: number;
  unitId: number;
  unitLabel: string;
  type: StockMovementType;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: StockAdjustmentReason;
  notes?: string;
  date: Date;
}

// Historique en mémoire pour la session
let sessionHistory: StockMovement[] = [];

export const stockService = {
  /**
   * Applique un ajustement de stock sur une variante.
   * @param productId  ID du produit parent
   * @param unit       Variante concernée
   * @param delta      Quantité à ajouter (>0) ou retirer (<0)
   * @param reason     Raison du mouvement
   * @param notes      Remarques optionnelles
   * @returns          Nouveau stock
   */
  async adjustStock(
    productId: number,
    unit: ProductUnit,
    delta: number,
    reason: StockAdjustmentReason,
    notes?: string
  ): Promise<number> {
    const previousStock = unit.stock;
    const newStock = Math.max(0, previousStock + delta);

    const payload: ProductUnitRequest = {
      unitType:     unit.unitType,
      quantity:     unit.quantity,
      label:        unit.label,
      prix:         unit.prix,
      stock:        newStock,
      isAvailable:  unit.isAvailable,
      displayOrder: unit.displayOrder
    };

    await unitService.updateUnit(productId, unit.id, payload);

    const movement: StockMovement = {
      id:            Math.random().toString(36).slice(2),
      productId,
      unitId:        unit.id,
      unitLabel:     unit.label,
      type:          delta >= 0 ? 'ENTREE' : 'SORTIE',
      delta,
      previousStock,
      newStock,
      reason,
      notes,
      date:          new Date()
    };

    sessionHistory = [movement, ...sessionHistory];
    return newStock;
  },

  getHistory(unitId?: number): StockMovement[] {
    if (unitId !== undefined) return sessionHistory.filter(m => m.unitId === unitId);
    return sessionHistory;
  },

  getProductHistory(productId: number): StockMovement[] {
    return sessionHistory.filter(m => m.productId === productId);
  },

  clearHistory(): void {
    sessionHistory = [];
  }
};
