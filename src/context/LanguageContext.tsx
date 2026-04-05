import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type Language } from '../i18n/translations';
import { profileService } from '../services/profileService';
import type { SupportedLanguage } from '../type';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [loading, setLoading] = useState(true);

  // Charger la langue sauvegardée au démarrage
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem('app_language');
        if (saved && (saved === 'fr' || saved === 'ar' || saved === 'en' || saved === 'tz')) {
          console.log('[LanguageContext] ✅ Langue chargée:', saved);
          setLanguageState(saved as Language);
        } else {
          console.log('[LanguageContext] 📝 Langue par défaut: fr');
          setLanguageState('fr');
        }
      } catch (error) {
        console.error('[LanguageContext] ❌ Erreur chargement langue:', error);
        setLanguageState('fr');
      } finally {
        setLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Fonction de traduction
  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      value = value?.[k];
    }

    if (!value) {
      console.warn(`[LanguageContext] ⚠️ Clé de traduction non trouvée: ${key} (${language})`);
      return key;
    }

    return value;
  }, [language]);

  // Changer la langue, la persister localement et synchroniser avec le backend
  const setLanguage = async (lang: Language) => {
    try {
      console.log('[LanguageContext] 🔄 Changement de langue:', lang);
      setLanguageState(lang);
      await AsyncStorage.setItem('app_language', lang);
      console.log('[LanguageContext] ✅ Langue sauvegardée localement:', lang);

      // Sync best-effort vers le backend (profil utilisateur).
      // En cas d'erreur (hors-ligne, non connecté), on continue silencieusement.
      profileService.updateLanguage(lang as SupportedLanguage).catch((err) => {
        console.warn('[LanguageContext] ⚠️ Sync langue backend échouée (ignorée):', err);
      });
    } catch (error) {
      console.error('[LanguageContext] ❌ Erreur sauvegarde langue:', error);
      // Revenir à la langue précédente en cas d'erreur locale
      setLanguageState(language);
    }
  };

  if (loading) {
    // Ne pas afficher rien pendant le chargement - le contexte sera bientôt prêt
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook pour utiliser le contexte de langue
 * Utilisation: const { t, language, setLanguage } = useLanguage();
 */
export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage doit être utilisé dans LanguageProvider');
  }
  return context;
}
