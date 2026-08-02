import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, type Language } from '../i18n/translations';
import { profileService } from '../services/profileService';
import { categoryService } from '../services/categoryService';
import type { SupportedLanguage } from '../type';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  /**
   * Traduit une clé pointée. Délègue à `translate()` : interpolation
   * `{{param}}` + fallback FR puis clé brute. `params` optionnel, la
   * signature reste rétro-compatible avec les appels `t('a.b')`.
   */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * NOTE — direction de mise en page (RTL/LTR).
 *
 * Ce contexte ne touche PLUS à `I18nManager`. L'app est verrouillée en LTR pour
 * toutes les langues par `src/i18n/layoutDirection.ts` (effet de bord importé en
 * premier dans `app/_layout.tsx`).
 *
 * Raison : `I18nManager` est un flag natif GLOBAL, PERSISTANT et à effet DIFFÉRÉ
 * (redémarrage natif requis). Le piloter ici faisait fuiter le RTL de l'arabe sur
 * toutes les autres langues : une fois `forceRTL(true)` posé, le retour au
 * français ne pouvait pas s'appliquer sans redémarrage — et aucun mécanisme de
 * reload n'existe (`expo-updates` absent). Le changement de langue est donc
 * désormais instantané et sans redémarrage.
 *
 * Le texte arabe reste correctement rendu de droite à gauche (algorithme bidi
 * d'Unicode) : seul le miroir de la mise en page est abandonné.
 */
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [loading, setLoading] = useState(true);

  // Charger la langue sauvegardée au démarrage
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem('app_language');
        const initial: Language =
          saved === 'fr' || saved === 'ar' || saved === 'en' || saved === 'tz'
            ? (saved as Language)
            : 'fr';
        console.log(
          saved ? '[LanguageContext] ✅ Langue chargée:' : '[LanguageContext] 📝 Langue par défaut:',
          initial,
        );
        setLanguageState(initial);
      } catch (error) {
        console.error('[LanguageContext] ❌ Erreur chargement langue:', error);
        setLanguageState('fr');
      } finally {
        setLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Fonction de traduction — délègue à `translate()` (source unique) :
  // interpolation `{{param}}`, fallback FR puis clé brute. Une chaîne vide
  // reste une traduction LEGITIME (ex: en.common.daysAgoPrefix='').
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string =>
      translate(language, key, params),
    [language],
  );

  // Changer la langue, la persister localement et synchroniser avec le backend
  const setLanguage = async (lang: Language) => {
    try {
      console.log('[LanguageContext] 🔄 Changement de langue:', lang);
      setLanguageState(lang);
      await AsyncStorage.setItem('app_language', lang);
      console.log('[LanguageContext] ✅ Langue sauvegardée localement:', lang);

      // Vider le cache mémoire des catégories : leurs noms/descriptions sont
      // traduits côté backend selon Accept-Language. Le cache offline est déjà
      // namespacé par langue dans api.ts donc pas besoin de le vider.
      categoryService.invalidateCache();

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
