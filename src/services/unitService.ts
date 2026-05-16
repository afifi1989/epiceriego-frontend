/**
 * Service pour gérer les Product Units via API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProductUnit, ProductUnitRequest } from '../type';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
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

  /**
   * Upload (or replace) the photo of a single variant.
   *
   * <p>Uses {@code fetch} + {@code FormData} (not axios) for the same SSL
   * workaround the InfoTab uses for product photos — multipart through
   * RN's axios layer is fragile on some Android builds. Returns the new
   * photo URL.
   */
  async setUnitPhoto(
    productId: number,
    unitId: number,
    fileUri: string,
  ): Promise<{ photoUrl: string }> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    const formData = new FormData();
    formData.append('image', {
      uri: fileUri,
      type: 'image/jpeg',
      name: `unit-${unitId}-${Date.now()}.jpg`,
    } as any);

    const url = `${API_CONFIG.BASE_URL}/products/${productId}/units/${unitId}/photo`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Upload échoué (HTTP ${resp.status})${txt ? ` : ${txt}` : ''}`);
    }
    return resp.json();
  },

  /**
   * Remove the variant photo (deletes the file on disk too).
   * After this call, the variant falls back to the product's main photo.
   */
  async clearUnitPhoto(
    productId: number,
    unitId: number,
  ): Promise<{ message: string }> {
    const response = await api.delete(
      `${API_BASE}/${productId}/units/${unitId}/photo`,
    );
    return response.data;
  },
};
