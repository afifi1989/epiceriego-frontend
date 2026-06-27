import { Colors } from '../../constants/colors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  supplierService,
  SUPPLIER_TYPE_EMOJI,
  SupplierAutocompleteResult,
  SupplierType,
} from '../../services/supplierService';

/**
 * Composant reutilisable de selection d'un fournisseur (V96).
 *
 * <p>Encapsule :
 * <ul>
 *   <li>Input texte + dropdown des suggestions debouncees (300ms)</li>
 *   <li>Bouton "+ Creer 'XXX'" inline si la chaine tapee n'existe pas</li>
 *   <li>Etat "applique" : pilule avec nom + bouton "X" (retirer)</li>
 *   <li>Tap dans la suggestion : on selectionne + le composant se replie</li>
 * </ul>
 *
 * <h2>Architecture</h2>
 * Le composant est <strong>controle</strong> par le parent via {@code value}.
 * Pattern miroir de {@code PromoCodeInput} pour homogeneite UX dans le
 * projet. Le parent recoit les events {@code onChange} et envoie le
 * {@code supplierId} dans la requete de reception de stock.
 *
 * <p>UI FR uniquement (UI epicier mobile).</p>
 *
 * @example
 * const [supplier, setSupplier] = useState<SupplierAutocompleteResult | null>(null);
 * <SupplierAutocomplete
 *   value={supplier}
 *   onChange={setSupplier}
 *   placeholder="Fournisseur" />
 */
export interface SupplierAutocompleteProps {
  /** Fournisseur applique courant ; null = aucun. */
  value: SupplierAutocompleteResult | null;

  /** Notifie le parent du changement. null = retire. */
  onChange: (supplier: SupplierAutocompleteResult | null) => void;

  placeholder?: string;
  disabled?: boolean;

  /**
   * Callback optionnel quand l'utilisateur veut creer un nouveau fournisseur
   * (action "+ Creer 'XXX'"). Si fourni, le composant appelle ce callback
   * avec le nom pre-rempli ; sinon il cree directement via le service avec
   * juste le nom (mode quick-create).
   */
  onRequestCreate?: (defaultName: string) => void;

  style?: ViewStyle;
}

/** Debounce de la recherche backend. */
const SEARCH_DEBOUNCE_MS = 300;

/** Limite max suggestions affichees. */
const MAX_SUGGESTIONS = 8;

export default function SupplierAutocomplete(props: SupplierAutocompleteProps) {
  const {
    value,
    onChange,
    placeholder = 'Fournisseur (tapez pour rechercher)',
    disabled = false,
    onRequestCreate,
    style,
  } = props;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SupplierAutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Recherche debouncee. Si la query est vide, vide les suggestions.
   * Refetch a chaque changement de query (cancel via clearTimeout).
   */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const list = await supplierService.search(q, MAX_SUGGESTIONS);
      setSuggestions(list);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Indique si une suggestion correspond exactement (case-insensitive) au
  // texte tape — auquel cas on ne propose PAS de creer pour eviter le doublon.
  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return suggestions.find(s => s.name.toLowerCase() === q) ?? null;
  }, [suggestions, query]);

  const handleSelect = useCallback(
    (s: SupplierAutocompleteResult) => {
      onChange(s);
      setQuery('');
      setSuggestions([]);
      setFocused(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setQuery('');
  }, [onChange]);

  const handleCreate = useCallback(async () => {
    const name = query.trim();
    if (!name) return;

    // Si le parent fournit un callback, deleguer (ouverture d'un modal complet).
    if (onRequestCreate) {
      onRequestCreate(name);
      setFocused(false);
      return;
    }

    // Sinon quick-create : juste le nom.
    setCreating(true);
    try {
      const created = await supplierService.create({ name });
      onChange({
        id: created.id,
        name: created.name,
        supplierType: created.supplierType ?? null,
        phone: created.phone ?? null,
      });
      setQuery('');
      setSuggestions([]);
      setFocused(false);
    } catch (e: any) {
      console.warn('[SupplierAutocomplete] quick-create failed', e);
    } finally {
      setCreating(false);
    }
  }, [query, onRequestCreate, onChange]);

  // ── Etat applique : pilule + bouton X ─────────────────────────────────
  if (value) {
    return (
      <View style={[styles.appliedBox, style]}>
        <View style={styles.appliedInfo}>
          {value.supplierType && (
            <Text style={styles.appliedEmoji}>
              {SUPPLIER_TYPE_EMOJI[value.supplierType as SupplierType]}
            </Text>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.appliedName} numberOfLines={1}>{value.name}</Text>
            {value.phone ? <Text style={styles.appliedMeta}>{value.phone}</Text> : null}
          </View>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClear}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Etat vierge : input + dropdown ────────────────────────────────────
  const showDropdown = focused && (loading || suggestions.length > 0 || query.trim().length > 0);
  const showCreateAction = focused
    && query.trim().length >= 2
    && !exactMatch
    && !loading;

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        // Delai sur blur pour permettre le tap sur les suggestions avant disparition
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        editable={!disabled && !creating}
        autoCorrect={false}
        autoCapitalize="words"
        maxLength={255}
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          {loading && (
            <View style={styles.dropdownLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.dropdownLoadingText}>Recherche...</Text>
            </View>
          )}

          {!loading && suggestions.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestion}
              onPress={() => handleSelect(s)}
              activeOpacity={0.7}
            >
              {s.supplierType && (
                <Text style={styles.suggestionEmoji}>
                  {SUPPLIER_TYPE_EMOJI[s.supplierType as SupplierType]}
                </Text>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionName} numberOfLines={1}>{s.name}</Text>
                {s.phone ? <Text style={styles.suggestionMeta}>{s.phone}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}

          {!loading && suggestions.length === 0 && query.trim().length >= 2 && (
            <Text style={styles.emptyText}>Aucun fournisseur trouve</Text>
          )}

          {showCreateAction && (
            <TouchableOpacity
              style={styles.createAction}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.7}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#2e7d32" />
              ) : (
                <Text style={styles.createActionText}>
                  ＋ Créer « {query.trim()} »
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },

  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 14,
    color: '#222',
  },

  dropdown: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 10,
    maxHeight: 260,
  },

  dropdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  dropdownLoadingText: { color: '#666', fontSize: 13 },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  suggestionEmoji: { fontSize: 18 },
  suggestionName: { fontSize: 14, color: '#222', fontWeight: '600' },
  suggestionMeta: { fontSize: 12, color: '#888', marginTop: 2 },

  emptyText: {
    padding: 12,
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
  },

  createAction: {
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderTopWidth: 1,
    borderTopColor: '#c8e6c9',
    alignItems: 'center',
  },
  createActionText: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 14,
  },

  appliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  appliedInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  appliedEmoji: { fontSize: 22 },
  appliedName: { fontSize: 14, fontWeight: '700', color: '#1565c0' },
  appliedMeta: { fontSize: 12, color: '#1976d2', marginTop: 1 },
  clearBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  clearBtnText: { fontSize: 14, color: '#555', fontWeight: '700' },
});
