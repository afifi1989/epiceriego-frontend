/**
 * PriceText — Composant standard pour afficher un montant.
 *
 * Remplace les écritures manuelles `${price.toFixed(2)} DH` éparpillées
 * dans l'app. Quand la devise n'est pas fournie, le composant retombe
 * gracieusement sur le format MAD (compatibilité historique).
 *
 * Usage typique :
 *   <PriceText amount={order.total} currency={order.currency} />
 *   <PriceText amount={item.prix} currency={epicerie.currency} bold />
 *
 * <p>Pour formatter une chaîne (titre de bouton, message), utiliser
 * directement {@link formatCurrency} de utils/formatCurrency.</p>
 */

import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import type { Currency } from '../../type';
import { formatCurrency, formatCurrencyCompact } from '../../utils/formatCurrency';

export interface PriceTextProps {
  amount: number;
  currency?: Currency | null;
  /** Format compact sans espace entre montant et symbole. */
  compact?: boolean;
  /** Style additionnel propagé au <Text>. */
  style?: StyleProp<TextStyle>;
  /** Raccourci pour `style={{ fontWeight: 'bold' }}`. */
  bold?: boolean;
  /** Couleur custom. Court-circuite la couleur du style si présent. */
  color?: string;
  /** Pour les tests / accessibility. */
  testID?: string;
}

export function PriceText({
  amount,
  currency,
  compact = false,
  style,
  bold,
  color,
  testID,
}: PriceTextProps) {
  const formatted = compact
    ? formatCurrencyCompact(amount, currency)
    : formatCurrency(amount, currency);

  const composedStyle: StyleProp<TextStyle> = [
    bold ? { fontWeight: 'bold' as const } : undefined,
    color ? { color } : undefined,
    style,
  ];

  return (
    <Text style={composedStyle} testID={testID}>
      {formatted}
    </Text>
  );
}
