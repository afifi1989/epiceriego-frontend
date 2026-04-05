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

const helpSupportService = {
  getHelpPage: async (): Promise<HelpPage> => {
    const response = await api.get<HelpPage>('/help/page');
    return response.data;
  },
};

export default helpSupportService;
