import React, { createContext, useContext, useMemo } from 'react';
import { Epicerie } from '../../type';
import { EpicerieBranding, deriveBranding } from './deriveBranding';

/**
 * Context optionnel qui propage le branding d'une épicerie aux composants
 * descendants. À monter uniquement sur les écrans liés à une épicerie
 * spécifique (détail boutique, détail produit, panier d'une seule épicerie).
 *
 * <p>Pour les écrans neutres (liste épiceries, profil, notifications),
 * <strong>ne pas monter</strong> ce provider — le hook
 * {@link useEpicerieTheme} retourne {@code null} et les composants se
 * rabattent sur le thème AbridGO global.</p>
 *
 * <p><b>Perf</b> : le branding est mémoisé sur l'identité de l'épicerie. Pas
 * de re-render des consommateurs tant que l'épicerie ne change pas.</p>
 */

const EpicerieThemeContext = createContext<EpicerieBranding | null>(null);

interface EpicerieThemeProviderProps {
  epicerie: Epicerie | null | undefined;
  children: React.ReactNode;
}

export function EpicerieThemeProvider({ epicerie, children }: EpicerieThemeProviderProps) {
  // Memoize par epicerie.id pour éviter de recalculer + re-render à chaque
  // rendu parent. Tant que l'id et les champs de branding sont stables,
  // l'objet renvoyé reste référentiellement identique.
  const branding = useMemo(
    () => deriveBranding(epicerie),
    // Les dépendances cibles sont les champs réellement utilisés par
    // deriveBranding. Si l'épicerie est rechargée avec les mêmes valeurs
    // (cas typique d'un refetch), aucun re-render n'est déclenché.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      epicerie?.id,
      epicerie?.themePreset,
      epicerie?.primaryColor,
      epicerie?.primarySubtle,
      epicerie?.accentColor,
      epicerie?.onPrimaryColor,
      epicerie?.brandStatement,
      epicerie?.photoUrl,
      epicerie?.presentationPhotoUrl,
    ],
  );

  return (
    <EpicerieThemeContext.Provider value={branding}>
      {children}
    </EpicerieThemeContext.Provider>
  );
}

/**
 * Retourne le branding effectif de l'épicerie courante, ou {@code null}
 * si on est hors contexte épicerie OU si l'épicerie est sur le thème
 * AbridGO par défaut.
 *
 * <p>Usage typique :</p>
 * <pre>
 *   const branding = useEpicerieTheme();
 *   const bg = branding?.primary ?? theme.colors.brand;
 * </pre>
 */
export function useEpicerieTheme(): EpicerieBranding | null {
  return useContext(EpicerieThemeContext);
}
