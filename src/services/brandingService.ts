import api from './api';

/**
 * Catalogue d'un preset visuel d'épicerie (miroir du DTO backend).
 */
export interface BrandingPreset {
  code: 'DEFAULT' | 'WARM' | 'COOL' | 'MINIMAL' | 'VIBRANT';
  label: string;
  description?: string;
  primaryColor: string;
  primarySubtle: string;
  accentColor: string;
  onPrimaryColor: string;
  displayOrder: number;
}

/** Payload PUT /api/epiceries/my-epicerie/branding (mode preset). */
export interface BrandingUpdateRequest {
  themePresetCode?: BrandingPreset['code'];
  brandStatement?: string;
}

/** Réponse PUT — récap branding effectif après application. */
export interface BrandingState {
  themePreset: string | null;
  primaryColor: string | null;
  primarySubtle: string | null;
  accentColor: string | null;
  onPrimaryColor: string | null;
  brandStatement: string | null;
}

/**
 * Service mobile pour gérer le branding de l'épicerie (côté épicier
 * uniquement — le mobile client lit le branding via l'objet Epicerie).
 */
export const brandingService = {
  /** Liste publique des presets disponibles. */
  listPresets: async (): Promise<BrandingPreset[]> => {
    const response = await api.get<BrandingPreset[]>('/epiceries/branding/presets');
    return response.data;
  },

  /** Met à jour le branding de l'épicerie connectée. Requiert SETTINGS_EDIT. */
  updateBranding: async (payload: BrandingUpdateRequest): Promise<BrandingState> => {
    const response = await api.put<BrandingState>('/epiceries/my-epicerie/branding', payload);
    return response.data;
  },
};
