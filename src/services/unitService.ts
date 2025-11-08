/**
 * Service pour gérer les Product Units via API
 */

import { ProductUnit, ProductUnitRequest } from '../type';
import api from './api';

const API_BASE = '/products';

export const unitService = {
  /**
   * Créer une nouvelle unit pour un produit
   */
  async createUnit(
    productId: number,
    request: ProductUnitRequest
  ): Promise<{ message: string }> {
    const response = await api.post(
      `${API_BASE}/${productId}/units`,
      request
    );
    return response.data;
  },

  /**
   * Récupérer toutes les units d'un produit
   */
  async getUnits(productId: number): Promise<ProductUnit[]> {
    const response = await api.get(`${API_BASE}/${productId}/units`);
    return response.data;
  },

  /**
   * Mettre à jour une unit
   */
  async updateUnit(
    productId: number,
    unitId: number,
    request: ProductUnitRequest
  ): Promise<{ message: string }> {
    const response = await api.put(
      `${API_BASE}/${productId}/units/${unitId}`,
      request
    );
    return response.data;
  },

  /**
   * Supprimer une unit (soft delete)
   */
  async deleteUnit(
    productId: number,
    unitId: number
  ): Promise<{ message: string }> {
    const response = await api.delete(
      `${API_BASE}/${productId}/units/${unitId}`
    );
    return response.data;
  },
};
