import api from './api';
import type { Currency } from '../type';

/**
 * Lookup des devises supportées par la plateforme.
 *
 * Renvoie déjà les noms localisés selon Accept-Language. Caching 24h
 * comme le reste du référentiel geo (cf. cacheService namespace `geo`).
 */
export const currencyService = {
  async listCurrencies(): Promise<Currency[]> {
    const { data } = await api.get<Currency[]>('/currencies');
    return data;
  },
};
