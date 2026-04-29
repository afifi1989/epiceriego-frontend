/**
 * AddressPicker — wizard d'adresse structurée pays → ville → quartier
 * + champs libres rue / code postal.
 *
 * Pourquoi cette forme cascade :
 *  - Évite les fautes de frappe sur les noms de villes (qui devenaient
 *    impossibles à requêter en agrégat / proximité).
 *  - Permet de pré-charger la devise du pays sélectionné.
 *  - Le quartier est OPTIONNEL : toutes les villes n'en ont pas seedé.
 *
 * Le composant est contrôlé : le parent gère l'état (`value`/`onChange`).
 * Le parent reçoit l'objet complet — pays, ville, quartier sélectionnés
 * (pas seulement les IDs), pour pouvoir afficher des libellés et
 * synchroniser la devise.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { City, Country, Neighborhood } from '../../type';
import { geoService } from '../../services/geoService';
import { LookupPickerModal, LookupItem } from './LookupPickerModal';

export interface AddressPickerValue {
  country: Country | null;
  city: City | null;
  neighborhood: Neighborhood | null;
  streetAddress: string;
  postalCode: string;
}

export const EMPTY_ADDRESS: AddressPickerValue = {
  country: null,
  city: null,
  neighborhood: null,
  streetAddress: '',
  postalCode: '',
};

interface AddressPickerProps {
  value: AddressPickerValue;
  onChange: (value: AddressPickerValue) => void;
  /** Affiche les astérisques * sur les champs requis. */
  required?: boolean;
}

export const AddressPicker: React.FC<AddressPickerProps> = ({
  value,
  onChange,
  required = true,
}) => {
  // ── Listes chargées au moment de l'ouverture du picker correspondant.
  // Pas de pré-fetch global : on ne charge les villes qu'après le choix
  // du pays. Cela évite un round-trip inutile pour l'utilisateur qui
  // garde le pays par défaut.
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);

  const [showCountry, setShowCountry] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [showNeighborhood, setShowNeighborhood] = useState(false);

  // Pré-fetch pays au mount — ils sont en cache 24h donc pas coûteux.
  useEffect(() => {
    let cancelled = false;
    setLoadingCountries(true);
    geoService.listCountries()
      .then(list => { if (!cancelled) setCountries(list); })
      .catch(() => { if (!cancelled) setCountries([]); })
      .finally(() => { if (!cancelled) setLoadingCountries(false); });
    return () => { cancelled = true; };
  }, []);

  // Charger villes dès qu'un pays est sélectionné. Le useEffect réagit à
  // value.country.id pour gérer aussi la (re)sélection externe (si le
  // parent change le country programmatiquement).
  useEffect(() => {
    if (!value.country) { setCities([]); return; }
    let cancelled = false;
    setLoadingCities(true);
    geoService.listCitiesByCountry(value.country.id)
      .then(list => { if (!cancelled) setCities(list); })
      .catch(() => { if (!cancelled) setCities([]); })
      .finally(() => { if (!cancelled) setLoadingCities(false); });
    return () => { cancelled = true; };
  }, [value.country?.id]);

  // Idem pour les quartiers : charger après choix de la ville.
  useEffect(() => {
    if (!value.city) { setNeighborhoods([]); return; }
    let cancelled = false;
    setLoadingNeighborhoods(true);
    geoService.listNeighborhoodsByCity(value.city.id)
      .then(list => { if (!cancelled) setNeighborhoods(list); })
      .catch(() => { if (!cancelled) setNeighborhoods([]); })
      .finally(() => { if (!cancelled) setLoadingNeighborhoods(false); });
    return () => { cancelled = true; };
  }, [value.city?.id]);

  // ── Handlers : mise à jour de l'état + reset des cascades.
  const handleSelectCountry = (item: LookupItem) => {
    const country = countries.find(c => c.id === item.id) || null;
    onChange({
      ...value,
      country,
      // Reset cascade : changer de pays invalide la ville et le quartier.
      city: null,
      neighborhood: null,
    });
    setShowCountry(false);
  };

  const handleSelectCity = (item: LookupItem) => {
    const city = cities.find(c => c.id === item.id) || null;
    onChange({
      ...value,
      city,
      neighborhood: null,
    });
    setShowCity(false);
  };

  const handleSelectNeighborhood = (item: LookupItem) => {
    const neighborhood = neighborhoods.find(n => n.id === item.id) || null;
    onChange({ ...value, neighborhood });
    setShowNeighborhood(false);
  };

  // ── Mappers Country/City/Neighborhood → LookupItem pour la modale.
  const countryItems = useMemo<LookupItem[]>(
    () => countries.map(c => ({
      id: c.id,
      label: c.name,
      sublabel: c.code,
    })),
    [countries],
  );

  const cityItems = useMemo<LookupItem[]>(
    () => cities.map(c => ({ id: c.id, label: c.name })),
    [cities],
  );

  const neighborhoodItems = useMemo<LookupItem[]>(
    () => neighborhoods.map(n => ({ id: n.id, label: n.name })),
    [neighborhoods],
  );

  const star = required ? ' *' : '';

  // Helper pour rendre une ligne picker uniforme avec icône à gauche.
  const renderPicker = (
    icon: string,
    label: string,
    placeholder: string,
    value$: string | null,
    onPress: () => void,
    enabled: boolean,
    loading: boolean,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectRow, !enabled && styles.selectRowDisabled, value$ && styles.selectRowFilled]}
        onPress={enabled ? onPress : undefined}
        activeOpacity={enabled ? 0.7 : 1}
      >
        <Text style={styles.fieldIcon}>{icon}</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#4CAF50" style={{ flex: 1 }} />
        ) : (
          <Text
            style={[styles.selectText, !value$ && styles.selectPlaceholder]}
            numberOfLines={1}
          >
            {value$ ?? placeholder}
          </Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View>
      {/* ── En-tête de section ─────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderIcon}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionHeaderTitle}>Adresse de l'épicerie</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Cette adresse sera utilisée pour la livraison et l'affichage public
          </Text>
        </View>
      </View>

      {/* ── Pays ────────────────────────────────────────────────── */}
      {renderPicker(
        '🌍',
        `Pays${star}`,
        'Choisir un pays',
        value.country?.name ?? null,
        () => setShowCountry(true),
        true,
        loadingCountries && !value.country,
      )}

      {/* ── Ville ───────────────────────────────────────────────── */}
      {renderPicker(
        '🏙️',
        `Ville${star}`,
        value.country ? 'Choisir une ville' : 'Choisissez d\'abord un pays',
        value.city?.name ?? null,
        () => setShowCity(true),
        !!value.country,
        loadingCities,
      )}

      {/* ── Quartier (optionnel) ────────────────────────────────── */}
      {renderPicker(
        '🗺️',
        'Quartier (optionnel)',
        !value.city
          ? 'Choisissez d\'abord une ville'
          : neighborhoods.length === 0 && !loadingNeighborhoods
            ? 'Aucun quartier référencé'
            : 'Choisir un quartier',
        value.neighborhood?.name ?? null,
        () => setShowNeighborhood(true),
        !!value.city && (loadingNeighborhoods || neighborhoods.length > 0),
        loadingNeighborhoods,
      )}

      {/* ── Rue + numéro ────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>N° et rue{star}</Text>
        <View style={[styles.inputWrapper, !!value.streetAddress && styles.selectRowFilled]}>
          <Text style={styles.fieldIcon}>🏠</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : 12 rue de la Liberté"
            placeholderTextColor="#9aa3ad"
            value={value.streetAddress}
            onChangeText={(text) => onChange({ ...value, streetAddress: text })}
          />
        </View>
      </View>

      {/* ── Code postal ─────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Code postal (optionnel)</Text>
        <View style={[styles.inputWrapper, !!value.postalCode && styles.selectRowFilled]}>
          <Text style={styles.fieldIcon}>✉️</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : 20000"
            placeholderTextColor="#9aa3ad"
            value={value.postalCode}
            onChangeText={(text) => onChange({ ...value, postalCode: text })}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {/* ── Modales ─────────────────────────────────────────────── */}
      <LookupPickerModal
        visible={showCountry}
        items={countryItems}
        selectedId={value.country?.id ?? null}
        onSelect={handleSelectCountry}
        onClose={() => setShowCountry(false)}
        title="Choisir un pays"
        loading={loadingCountries}
        searchPlaceholder="Rechercher un pays…"
        emptyText="Aucun pays disponible"
      />

      <LookupPickerModal
        visible={showCity}
        items={cityItems}
        selectedId={value.city?.id ?? null}
        onSelect={handleSelectCity}
        onClose={() => setShowCity(false)}
        title="Choisir une ville"
        loading={loadingCities}
        searchPlaceholder="Rechercher une ville…"
        emptyText="Aucune ville référencée pour ce pays"
      />

      <LookupPickerModal
        visible={showNeighborhood}
        items={neighborhoodItems}
        selectedId={value.neighborhood?.id ?? null}
        onSelect={handleSelectNeighborhood}
        onClose={() => setShowNeighborhood(false)}
        title="Choisir un quartier"
        loading={loadingNeighborhoods}
        searchPlaceholder="Rechercher un quartier…"
        emptyText="Aucun quartier référencé pour cette ville"
      />
    </View>
  );
};

/**
 * Construit une chaîne d'adresse libre à partir d'une AddressPickerValue.
 * Utile pour remplir le champ legacy `adresse` du backend (qui attend une
 * string libre, gardée pour rétrocompatibilité).
 */
export function flattenAddress(addr: AddressPickerValue): string {
  const parts: string[] = [];
  if (addr.streetAddress?.trim()) parts.push(addr.streetAddress.trim());
  if (addr.neighborhood) parts.push(addr.neighborhood.name);
  if (addr.city) parts.push(addr.city.name);
  if (addr.postalCode?.trim()) parts.push(addr.postalCode.trim());
  if (addr.country) parts.push(addr.country.name);
  return parts.join(', ');
}

const styles = StyleSheet.create({
  // ── En-tête de section ────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F1F8F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  sectionHeaderIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 2,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: '#558B2F',
    lineHeight: 16,
  },
  // ── Champ ─────────────────────────────────────────────────────
  field: {
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
  // ── Picker (TouchableOpacity) ─────────────────────────────────
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  selectRowFilled: {
    borderColor: '#A5D6A7',
    backgroundColor: '#FAFFFB',
  },
  selectRowDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  selectText: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  selectPlaceholder: { color: '#9aa3ad', fontWeight: '400' },
  chevron: { fontSize: 24, color: '#cbd5e0', marginLeft: 8, lineHeight: 24 },
  // ── Input texte ───────────────────────────────────────────────
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
});
