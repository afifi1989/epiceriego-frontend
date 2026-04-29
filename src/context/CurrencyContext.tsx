/**
 * CurrencyContext — devise courante propagée à l'arbre React.
 *
 * Pourquoi un contexte plutôt que de drilldown la prop `currency` partout :
 *   - Côté CLIENT : la devise dépend de l'épicerie en cours de visite (la
 *     même app peut afficher une épicerie en MAD puis une en EUR). Le
 *     layout (epicerie)/[id].tsx setCurrency() au mount, les enfants
 *     (produits, panier, fiche commande) consomment via useCurrency().
 *   - Côté EPICIER : la devise est celle de l'épicerie connectée et ne
 *     change pas pendant la session. On set une fois après login.
 *
 * Pas de persistance AsyncStorage volontairement : la devise vient
 * toujours de la donnée fraîche du serveur (epicerie.currency / order.currency).
 * Cacher en local risquerait de désynchroniser si l'épicerie change de
 * devise (rare mais possible).
 *
 * Le contexte exporte aussi un `format()` pré-bindé pour éviter d'avoir
 * à importer formatCurrency partout.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Currency } from '../type';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatCurrency';

interface CurrencyContextValue {
  /** Devise courante. null = pas encore définie (l'app retombera sur le fallback "DH"). */
  currency: Currency | null;
  setCurrency: (currency: Currency | null) => void;
  /** Helper formatage standard, déjà bindé sur la devise courante. */
  format: (amount: number) => string;
  /** Helper formatage compact, déjà bindé. */
  formatCompact: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency | null>(null);

  const format = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  const formatCompact = useCallback(
    (amount: number) => formatCurrencyCompact(amount, currency),
    [currency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, setCurrency, format, formatCompact }),
    [currency, format, formatCompact],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/**
 * Récupère la devise courante et les helpers de formatage.
 *
 * Si appelé hors d'un CurrencyProvider, retourne un état "neutre" plutôt
 * que de throw — beaucoup d'écrans peuvent être rendus avant que le
 * provider soit monté (splash, login). Le fallback "DH" de
 * {@link formatCurrency} prend alors le relais.
 */
export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;

  return {
    currency: null,
    setCurrency: () => {},
    format: (amount: number) => formatCurrency(amount, null),
    formatCompact: (amount: number) => formatCurrencyCompact(amount, null),
  };
}
