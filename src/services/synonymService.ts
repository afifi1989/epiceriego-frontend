import api from './api';

/**
 * Service de gestion des synonymes de recherche (darija/arabe → fr).
 *
 * Chaque synonyme est un mapping (term → canonical) propre à l'épicerie :
 * quand le client tape `term`, la recherche produit inclut automatiquement
 * `canonical`. Gestion CRUD + restauration des défauts.
 *
 * Toutes les routes sont montées sous `/epiceries/{epicerieId}/synonyms`
 * côté backend, et protégées par la permission `SYNONYM_MANAGE`.
 */

export type SynonymLanguage = 'ary' | 'ar' | 'fr' | 'en' | 'tz';

export interface Synonym {
  id: number;
  term: string;
  canonical: string;
  language: SynonymLanguage;
  createdAt?: string;
  updatedAt?: string;
}

export interface SynonymRequest {
  term: string;
  canonical: string;
  language: SynonymLanguage;
}

export interface RestoreDefaultsResponse {
  restored: number;
  message: string;
}

export interface SynonymLanguageMeta {
  code: SynonymLanguage;
  label: string;
  labelShort: string;
  flag: string;
  color: string;
}

/** Métadonnées d'affichage pour chaque code langue (partagées par la page + la modale). */
export const SYNONYM_LANGUAGES: readonly SynonymLanguageMeta[] = [
  { code: 'ary', label: 'Darija (latin)', labelShort: 'Darija', flag: '🇲🇦', color: '#fb923c' },
  { code: 'ar',  label: 'Arabe',           labelShort: 'العربية', flag: '🇲🇦', color: '#10b981' },
  { code: 'fr',  label: 'Français',        labelShort: 'FR',      flag: '🇫🇷', color: '#3b82f6' },
  { code: 'en',  label: 'Anglais',         labelShort: 'EN',      flag: '🇬🇧', color: '#8b5cf6' },
  { code: 'tz',  label: 'Tamazight',       labelShort: 'TZ',      flag: 'ⵣ',   color: '#f59e0b' },
] as const;

export function getSynonymLanguageMeta(code: string | null | undefined): SynonymLanguageMeta {
  return SYNONYM_LANGUAGES.find(l => l.code === code) ?? SYNONYM_LANGUAGES[0];
}

export const synonymService = {
  list: async (epicerieId: number): Promise<Synonym[]> => {
    const res = await api.get<Synonym[]>(`/epiceries/${epicerieId}/synonyms`);
    return res.data;
  },

  create: async (epicerieId: number, request: SynonymRequest): Promise<Synonym> => {
    const res = await api.post<Synonym>(`/epiceries/${epicerieId}/synonyms`, request);
    return res.data;
  },

  update: async (
    epicerieId: number,
    synonymId: number,
    request: SynonymRequest
  ): Promise<Synonym> => {
    const res = await api.put<Synonym>(
      `/epiceries/${epicerieId}/synonyms/${synonymId}`,
      request
    );
    return res.data;
  },

  delete: async (epicerieId: number, synonymId: number): Promise<void> => {
    await api.delete(`/epiceries/${epicerieId}/synonyms/${synonymId}`);
  },

  restoreDefaults: async (epicerieId: number): Promise<RestoreDefaultsResponse> => {
    const res = await api.post<RestoreDefaultsResponse>(
      `/epiceries/${epicerieId}/synonyms/restore-defaults`,
      {}
    );
    return res.data;
  },
};
