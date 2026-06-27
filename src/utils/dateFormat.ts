import { Language } from '../i18n/translations';

/**
 * Formatage de dates/heures localisé selon la LANGUE DE L'APP (pas la locale
 * système). Avant ce module, plusieurs écrans client hardcodaient
 * `toLocaleDateString('fr-FR')` : un utilisateur en arabe voyait ses dates en
 * français.
 *
 * <p>Choix des locales :</p>
 * <ul>
 *   <li>ar → 'ar-MA' : arabe marocain (chiffres occidentaux, conventions MA) ;</li>
 *   <li>tz → 'fr-FR' : pas de locale Intl fiable pour le tamazight latin sur
 *       Hermes/JSC — on retombe sur le format français (chiffres identiques) ;</li>
 *   <li>fallback try/catch : si le moteur JS ne connaît pas la locale
 *       (vieux Hermes sans data Intl complète), on dégrade en 'fr-FR' plutôt
 *       que de crasher.</li>
 * </ul>
 */
const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  fr: 'fr-FR',
  ar: 'ar-MA',
  en: 'en-GB',
  tz: 'fr-FR',
};

export const localeFor = (language: Language): string =>
  LOCALE_BY_LANGUAGE[language] ?? 'fr-FR';

const toValidDate = (value: string | number | Date): Date | null => {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

/** Date localisée selon la langue de l'app. Chaîne vide si la valeur est invalide. */
export function formatDate(
  value: string | number | Date,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toValidDate(value);
  if (!d) return '';
  try {
    return d.toLocaleDateString(localeFor(language), options);
  } catch {
    return d.toLocaleDateString('fr-FR', options);
  }
}

/** Heure localisée selon la langue de l'app. Chaîne vide si la valeur est invalide. */
export function formatTime(
  value: string | number | Date,
  language: Language,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  const d = toValidDate(value);
  if (!d) return '';
  try {
    return d.toLocaleTimeString(localeFor(language), options);
  } catch {
    return d.toLocaleTimeString('fr-FR', options);
  }
}
