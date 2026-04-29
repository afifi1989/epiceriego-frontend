/**
 * Service for managing WhatsApp Business settings per epicerie.
 * Uses the existing epicerie update endpoint with WhatsApp-specific fields.
 */

import api from './api';

export interface WhatsAppSettings {
  whatsappEnabled: boolean;
  whatsappWelcomeMessage: string;
  whatsappAutoAccept: boolean;
}

const whatsappSettingsService = {
  /**
   * Get current WhatsApp settings for the logged-in epicerie.
   */
  async getSettings(): Promise<WhatsAppSettings> {
    try {
      const response = await api.get('/epiceries/my-epicerie');
      const epicerie = response.data;
      return {
        whatsappEnabled: epicerie.whatsappEnabled ?? false,
        whatsappWelcomeMessage: epicerie.whatsappWelcomeMessage ?? '',
        whatsappAutoAccept: epicerie.whatsappAutoAccept ?? false,
      };
    } catch (error) {
      console.error('[WhatsAppSettings] Error fetching settings:', error);
      throw error;
    }
  },

  /**
   * Update WhatsApp settings for the logged-in epicerie.
   */
  async updateSettings(settings: Partial<WhatsAppSettings>): Promise<WhatsAppSettings> {
    try {
      const response = await api.put('/epiceries/my-epicerie', settings);
      const epicerie = response.data;
      return {
        whatsappEnabled: epicerie.whatsappEnabled ?? false,
        whatsappWelcomeMessage: epicerie.whatsappWelcomeMessage ?? '',
        whatsappAutoAccept: epicerie.whatsappAutoAccept ?? false,
      };
    } catch (error) {
      console.error('[WhatsAppSettings] Error updating settings:', error);
      throw error;
    }
  },
};

export default whatsappSettingsService;
