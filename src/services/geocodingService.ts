import api from './api';

/**
 * geocodingService — adresse tapée → coordonnées GPS via le backend
 * (`POST /api/geocode`, qui appelle l'API Google Geocoding avec biais
 * région Maroc).
 *
 * Pilier « adresse » de l'approche hybride imposée par la règle
 * « coordonnées GPS obligatoires pour la livraison par zone » : quand le
 * GPS de l'appareil n'est pas disponible (permission refusée, indoor,
 * émulateur), l'utilisateur peut localiser son adresse tapée. Les deux
 * chemins alimentent exactement les mêmes champs `latitude`/`longitude`.
 *
 * Codes d'erreur stables (champ `code` de GeocodingError) :
 *  - 'UNAVAILABLE' : service non configuré côté serveur (HTTP 503) —
 *    masquer/dégrader le bouton, proposer GPS ou saisie manuelle.
 *  - 'NOT_FOUND'   : adresse introuvable (HTTP 400) — demander plus de
 *    précision (ville, quartier) ou proposer le GPS.
 */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
  valid: boolean;
}

export type GeocodingErrorCode = 'UNAVAILABLE' | 'NOT_FOUND';

export class GeocodingError extends Error {
  code: GeocodingErrorCode;

  constructor(code: GeocodingErrorCode, message: string) {
    super(message);
    this.name = 'GeocodingError';
    this.code = code;
  }
}

/** Bornes valides — alignées sur la validation backend. */
export function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === 'number' && !Number.isNaN(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: unknown): lng is number {
  return typeof lng === 'number' && !Number.isNaN(lng) && lng >= -180 && lng <= 180;
}

export const geocodingService = {
  /**
   * Géocode une adresse libre. Résout avec des coordonnées garanties
   * valides (bornes vérifiées serveur ET client), rejette avec une
   * {@link GeocodingError} sinon.
   */
  geocode: async (address: string): Promise<GeocodeResult> => {
    let response;
    try {
      response = await api.post<GeocodeResult>('/geocode', { address });
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;
      if (status === 503) {
        throw new GeocodingError('UNAVAILABLE', message ?? 'Service de géocodage indisponible.');
      }
      throw new GeocodingError('NOT_FOUND', message ?? 'Adresse introuvable.');
    }
    const data = response.data;
    if (!data?.valid || !isValidLatitude(data.latitude) || !isValidLongitude(data.longitude)) {
      throw new GeocodingError('NOT_FOUND', 'Adresse introuvable.');
    }
    return data;
  },
};
