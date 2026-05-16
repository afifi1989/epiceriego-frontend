import api from './api';

export interface HelpArticle {
  id: number;
  question: string;
  answer: string;
}

export interface HelpCategory {
  id: number;
  slug: string;
  icon: string;
  color: string;
  name: string;
  articles: HelpArticle[];
}

export interface ContactInfo {
  id: number;
  type: 'WHATSAPP' | 'PHONE' | 'EMAIL';
  value: string;
  icon: string;
  color: string;
}

export interface HelpPage {
  categories: HelpCategory[];
  contactInfo: ContactInfo[];
}

/** Public servi par /help/page — voir backend V92__help_audience.sql. */
export type HelpAudience = 'CLIENT' | 'EPICIER';

const helpSupportService = {
  /**
   * Charge la page Aide pour l'audience demandée. Sans paramètre, le backend
   * retombe sur 'CLIENT' (comportement historique pour le mobile client).
   */
  getHelpPage: async (audience?: HelpAudience): Promise<HelpPage> => {
    const response = await api.get<HelpPage>('/help/page', {
      params: audience ? { audience } : undefined,
    });
    return response.data;
  },
};

export default helpSupportService;
