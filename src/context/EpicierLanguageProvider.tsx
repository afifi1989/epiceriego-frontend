import React, { useMemo } from 'react';
import { LanguageContext } from './LanguageContext';
import { translations, type Language } from '../i18n/translations';

/**
 * Forces the épicier UI to French regardless of the global app language
 * preference (which is owned by the client-side {@link LanguageProvider}).
 *
 * <p><strong>Why</strong>. The épicier interface is FR-only by policy — same
 * as the web Angular console (which sends {@code Accept-Language: fr}
 * unconditionally). The épicier and their staff (collaborators, caissiers)
 * always read French; switching them to Arabic or Tamazight would surprise
 * them and complicate training.
 *
 * <p>The client mobile app shares the same React Native bundle as the épicier
 * mobile app, so the global {@link LanguageProvider} ends up serving both —
 * but its locale is appropriate for the client only. By overriding
 * {@link LanguageContext} on the épicier sub-tree, every {@code useLanguage()}
 * call inside {@code (epicier)/} returns French translations without
 * touching the client-side preference.
 *
 * <p><strong>What is NOT impacted</strong>. The product search inside
 * vente-directe accepts darija / arabic input through the synonym map
 * (helper {@code expandAndFilter}, pure function, not connected to this
 * context). So a caissier can still type "zit" / "matisha" — only the
 * surrounding UI labels stay in French.
 */
export function EpicierLanguageProvider({ children }: { children: React.ReactNode }) {
  // Memoised so the value reference stays stable across re-renders;
  // otherwise every consumer of useLanguage() would re-render needlessly.
  const value = useMemo(() => ({
    language: 'fr' as Language,
    /** No-op: switching language from inside the épicier zone is forbidden. */
    setLanguage: async (_lang: Language) => {
      console.warn('[EpicierLanguage] setLanguage ignoré: l\'interface épicier est en français uniquement.');
    },
    t: (key: string): string => {
      const parts = key.split('.');
      let v: any = translations.fr;
      for (const k of parts) v = v?.[k];
      if (v === undefined || v === null) {
        console.warn('[EpicierLanguage] Clé de traduction manquante:', key);
        return key;
      }
      return typeof v === 'string' ? v : key;
    },
  }), []);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
