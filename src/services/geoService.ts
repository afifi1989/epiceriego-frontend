import api from './api';
import type { City, Country, Neighborhood } from '../type';

/**
 * Lookup du référentiel geo (pays, villes, quartiers).
 *
 * Le caching offline est géré par l'intercepteur axios via le namespace
 * `geo` (TTL 24h dans cacheService.ts) — les listes pays/villes ne
 * changent quasi jamais, et un signup épicier hors-ligne reste capable
 * d'afficher les sélecteurs.
 *
 * <p>Pour les usages en signup wizard où l'on n'a pas encore d'auth, ces
 * routes sont marquées `permitAll()` côté SecurityConfig.</p>
 */
export const geoService = {
  /** Liste les pays actifs (triés par nom FR). */
  async listCountries(): Promise<Country[]> {
    const { data } = await api.get<Country[]>('/geo/countries');
    return data;
  },

  /** Récupère un pays par son code ISO 3166-1 (ex: "MA"). */
  async getCountryByCode(code: string): Promise<Country> {
    const { data } = await api.get<Country>(`/geo/countries/${code}`);
    return data;
  },

  /** Liste les villes actives d'un pays (cascade ville). */
  async listCitiesByCountry(countryId: number): Promise<City[]> {
    const { data } = await api.get<City[]>(`/geo/countries/${countryId}/cities`);
    return data;
  },

  /**
   * Liste les quartiers actifs d'une ville (cascade quartier).
   * Toutes les villes n'ont pas forcément de quartiers — la liste peut
   * légitimement revenir vide. Le wizard doit traiter ce cas comme
   * "aucun quartier à choisir".
   */
  async listNeighborhoodsByCity(cityId: number): Promise<Neighborhood[]> {
    const { data } = await api.get<Neighborhood[]>(`/geo/cities/${cityId}/neighborhoods`);
    return data;
  },
};
