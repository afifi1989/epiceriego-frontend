import type { Currency } from '../type';

/**
 * Formate un montant selon la devise donnée — symbole, position et
 * nombre de décimales viennent du backend (CurrencyDTO snapshot sur
 * l'order/invoice/payment).
 *
 * Exemples :
 *   formatCurrency(1234.5,  MAD) → "1 234,50 DH"   (AFTER, 2 decimals)
 *   formatCurrency(1234.5,  EUR) → "1 234,50 €"
 *   formatCurrency(1234.5,  USD) → "$ 1,234.50"    (BEFORE)
 *   formatCurrency(1234.5,  null) → "1 234,50 DH"  (fallback rétrocompat)
 *
 * <p>Le fallback "DH" est intentionnel : pendant la transition vers le
 * snapshot devise, certains anciens enregistrements n'ont pas de
 * `currency` et la quasi-totalité des données existantes sont en MAD.
 * Une fois la migration côté front terminée, le fallback peut être
 * remplacé par un throw — voir Sprint 7.</p>
 */
export function formatCurrency(amount: number, currency?: Currency | null): string {
  const symbol = currency?.symbol ?? 'DH';
  const decimals = currency?.decimals ?? 2;
  const position = currency?.symbolPosition ?? 'AFTER';

  // Fallback propre : un montant undefined/null/NaN ne doit jamais produire
  // la chaîne « NaN » à l'écran — on retombe sur 0.
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  // Intl.NumberFormat gère séparateurs milliers/décimaux selon la locale.
  // On force fr-* pour rester cohérent avec le reste du formatage de
  // l'app (dates, etc.). Quand l'utilisateur change de langue, on
  // pourra brancher la locale du contexte i18n ici.
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeAmount);

  return position === 'BEFORE' ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
}

/**
 * Variante "compacte" pour affichages contraints (tableaux, liste produits)
 * — pas d'espace entre symbole et montant.
 */
export function formatCurrencyCompact(amount: number, currency?: Currency | null): string {
  const symbol = currency?.symbol ?? 'DH';
  const decimals = currency?.decimals ?? 2;
  const position = currency?.symbolPosition ?? 'AFTER';

  const safeAmount = Number.isFinite(amount) ? amount : 0;

  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeAmount);

  return position === 'BEFORE' ? `${symbol}${formatted}` : `${formatted}${symbol}`;
}
