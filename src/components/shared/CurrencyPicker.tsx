/**
 * CurrencyPicker — sélecteur de devise.
 *
 * Le pattern d'usage par défaut au signup épicier :
 *   - Le pays choisi par défaut détermine `defaultCurrency` (côté backend).
 *   - L'utilisateur peut overrider ici si l'épicerie facture dans une
 *     autre devise (rare mais légitime — ex : épicerie marocaine en zone
 *     touristique facturant en EUR).
 *
 * En signup, on passe la `defaultCurrency` du pays comme valeur initiale
 * et on ne montre le picker que si l'utilisateur veut changer.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Currency } from '../../type';
import { currencyService } from '../../services/currencyService';
import { LookupPickerModal, LookupItem } from './LookupPickerModal';

interface CurrencyPickerProps {
  value: Currency | null;
  onChange: (currency: Currency | null) => void;
  /** Forcer le label affiché (défaut: "Devise"). */
  label?: string;
  /** Affiche le * du champ requis. */
  required?: boolean;
}

export const CurrencyPicker: React.FC<CurrencyPickerProps> = ({
  value,
  onChange,
  label = 'Devise',
  required = true,
}) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    currencyService.listCurrencies()
      .then(list => { if (!cancelled) setCurrencies(list); })
      .catch(() => { if (!cancelled) setCurrencies([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const items: LookupItem[] = currencies.map(c => ({
    id: c.code,
    label: c.name,
    sublabel: `${c.code} — ${c.symbol}`,
  }));

  const handleSelect = (item: LookupItem) => {
    const currency = currencies.find(c => c.code === item.id) || null;
    onChange(currency);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TouchableOpacity
        style={[styles.selectRow, value && styles.selectRowFilled]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        {loading && !value ? (
          <ActivityIndicator size="small" color="#4CAF50" style={{ flex: 1 }} />
        ) : value ? (
          <>
            {/* Badge symbole devise */}
            <View style={styles.symbolBadge}>
              <Text style={styles.symbolBadgeText}>{value.symbol}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.currencyName} numberOfLines={1}>{value.name}</Text>
              <Text style={styles.currencyCode}>{value.code}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.fieldIcon}>💰</Text>
            <Text style={[styles.selectText, styles.selectPlaceholder]}>
              Choisir une devise
            </Text>
          </>
        )}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <LookupPickerModal
        visible={open}
        items={items}
        selectedId={value?.code ?? null}
        onSelect={handleSelect}
        onClose={() => setOpen(false)}
        title="Choisir une devise"
        loading={loading}
        searchPlaceholder="Rechercher une devise…"
        emptyText="Aucune devise disponible"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginLeft: 2,
  },
  fieldIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  selectRowFilled: {
    borderColor: '#A5D6A7',
    backgroundColor: '#FAFFFB',
  },
  selectText: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  selectPlaceholder: { color: '#9aa3ad' },
  chevron: { fontSize: 24, color: '#cbd5e0', marginLeft: 8, lineHeight: 24 },
  // ── Aperçu devise sélectionnée ────────────────────────────────
  symbolBadge: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  symbolBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  currencyName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  currencyCode: {
    fontSize: 11,
    color: '#9aa3ad',
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
