/**
 * StepDelivery — Étape "Livraison" du wizard.
 *
 * 3 stratégies de calcul (Epicerie.deliveryMode) :
 *  - ZONES      : tableau de zones tarifaires basées sur la distance.
 *                 JSON Epicerie.deliveryZones :
 *                   [{ name, deliveryFee, maxDistance, isActive }, ...]
 *  - FLAT_RATE  : un montant fixe (Epicerie.flatDeliveryFee), peu importe la distance.
 *  - NONE       : pas de livraison du tout, retrait en boutique uniquement.
 *
 * Validation backend (mode ZONES) : tableau non vide, chaque zone a
 * name + deliveryFee + maxDistance, deliveryFee >= 0, maxDistance > 0,
 * et au moins une zone avec isActive=true.
 *
 * Migration : les anciens contenus `{mode: 'RADIUS', radiusKm}` ou
 * `{mode: 'NEIGHBORHOODS', ...}` sont convertis en zone unique au mount.
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLanguage } from '../../../context/LanguageContext';
import { epicerieService } from '../../../services/epicerieService';
import {
  GeocodingError,
  geocodingService,
  isValidLatitude,
  isValidLongitude,
} from '../../../services/geocodingService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

interface DeliveryZone {
  name: string;
  deliveryFee: number;
  maxDistance: number;
  isActive: boolean;
}

type DeliveryMode = 'ZONES' | 'FLAT_RATE' | 'NONE';

const STARTER_ZONES: DeliveryZone[] = [
  { name: 'Zone proche',   deliveryFee: 10, maxDistance: 3,  isActive: true },
  { name: 'Zone étendue',  deliveryFee: 20, maxDistance: 10, isActive: true },
];

export const StepDelivery = forwardRef<StepHandle, StepProps>(
  function StepDelivery({ epicerie, busy }, ref) {
    const { t } = useLanguage();
    const [mode, setMode] = useState<DeliveryMode>(
      () => (epicerie.deliveryMode as DeliveryMode | undefined) ?? 'ZONES',
    );
    const [flatDeliveryFee, setFlatDeliveryFee] = useState<number>(
      () => epicerie.flatDeliveryFee ?? 0,
    );
    const [zones, setZones] = useState<DeliveryZone[]>(
      () => parseZones(epicerie.deliveryZones) ?? [...STARTER_ZONES],
    );

    // ── Règle « coordonnées GPS obligatoires pour la livraison par zone » ──
    // La configuration des zones est masquée tant que l'épicerie n'a pas de
    // position valide. Capture hybride : GPS appareil, géocodage de l'adresse
    // (backend Google), ou saisie manuelle — les trois écrivent les mêmes
    // champs latitude/longitude puis sauvegardent immédiatement.
    const [shopLat, setShopLat] = useState<number | null>(
      () => (isValidLatitude(epicerie.latitude) ? epicerie.latitude! : null),
    );
    const [shopLng, setShopLng] = useState<number | null>(
      () => (isValidLongitude(epicerie.longitude) ? epicerie.longitude! : null),
    );
    const [locating, setLocating] = useState(false);
    const [geocoding, setGeocoding] = useState(false);
    const [addressText, setAddressText] = useState<string>(
      () => epicerie.adresse ?? '',
    );
    const [showManualCoords, setShowManualCoords] = useState(false);
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');

    const hasShopCoords = shopLat != null && shopLng != null;

    /** Persiste la position boutique puis débloque la config des zones. */
    const saveShopCoords = async (lat: number, lng: number): Promise<boolean> => {
      if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
        Alert.alert(t('shopLocation.invalidCoordsTitle'), t('shopLocation.invalidCoordsBody'));
        return false;
      }
      try {
        await epicerieService.updateMyEpicerie({ latitude: lat, longitude: lng });
        setShopLat(lat);
        setShopLng(lng);
        // Garde l'objet parent cohérent (le wizard/paramètres relisent
        // epicerie.latitude pour les badges de complétion).
        epicerie.latitude = lat;
        epicerie.longitude = lng;
        return true;
      } catch (err: any) {
        Alert.alert(t('common.error'), typeof err === 'string' ? err : t('shopLocation.saveFailed'));
        return false;
      }
    };

    /** Option 1 — GPS de l'appareil. */
    const detectShopPosition = async () => {
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('shopLocation.permissionDeniedTitle'), t('shopLocation.permissionDeniedBody'));
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await saveShopCoords(pos.coords.latitude, pos.coords.longitude);
      } catch (err) {
        console.warn('[StepDelivery] GPS detect failed:', err);
        Alert.alert(t('common.error'), t('shopLocation.detectFailed'));
      } finally {
        setLocating(false);
      }
    };

    /** Option 2 — géocodage de l'adresse tapée (backend Google). */
    const locateShopAddress = async () => {
      const address = addressText.trim();
      if (!address) {
        Alert.alert(t('common.error'), t('shopLocation.addressRequired'));
        return;
      }
      setGeocoding(true);
      try {
        const result = await geocodingService.geocode(address);
        await saveShopCoords(result.latitude, result.longitude);
      } catch (err: any) {
        const unavailable = err instanceof GeocodingError && err.code === 'UNAVAILABLE';
        Alert.alert(
          t('common.error'),
          unavailable ? t('shopLocation.geocodeUnavailable') : t('shopLocation.geocodeFailed'),
        );
      } finally {
        setGeocoding(false);
      }
    };

    /** Option 3 — saisie manuelle lat/lng. */
    const saveManualCoords = async () => {
      const lat = parseFloat(manualLat.replace(',', '.'));
      const lng = parseFloat(manualLng.replace(',', '.'));
      await saveShopCoords(lat, lng);
    };

    const currencySymbol = epicerie.currency?.symbol ?? '€';

    const updateZone = (index: number, patch: Partial<DeliveryZone>) => {
      setZones(prev => prev.map((z, i) => i === index ? { ...z, ...patch } : z));
    };

    const addZone = () => {
      const lastDistance = zones.length > 0
        ? Math.max(...zones.map(z => z.maxDistance))
        : 0;
      setZones(prev => [
        ...prev,
        {
          name: `Zone ${prev.length + 1}`,
          deliveryFee: 0,
          maxDistance: lastDistance + 5,
          isActive: true,
        },
      ]);
    };

    const removeZone = (index: number) => {
      if (zones.length <= 1) {
        Alert.alert('Suppression refusée', 'Au moins une zone est requise.');
        return;
      }
      setZones(prev => prev.filter((_, i) => i !== index));
    };

    useImperativeHandle(ref, () => ({
      async submit() {
        // Mode NONE : rien à valider, l'épicerie ne livre tout simplement pas.
        if (mode === 'NONE') {
          try {
            await epicerieService.updateMyEpicerie({ deliveryMode: 'NONE' });
            return true;
          } catch (err: any) {
            Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
            return false;
          }
        }

        // Mode FLAT_RATE : un seul montant à valider.
        if (mode === 'FLAT_RATE') {
          if (flatDeliveryFee == null || flatDeliveryFee < 0) {
            Alert.alert('Forfait invalide', 'Le forfait ne peut pas être négatif.');
            return false;
          }
          try {
            await epicerieService.updateMyEpicerie({
              deliveryMode: 'FLAT_RATE',
              flatDeliveryFee,
            });
            return true;
          } catch (err: any) {
            Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
            return false;
          }
        }

        // Mode ZONES : coordonnées GPS de la boutique OBLIGATOIRES
        // (aligné sur le backend, code stable SHOP_COORDINATES_REQUIRED).
        if (!hasShopCoords) {
          Alert.alert(
            t('shopLocation.blockerTitle'),
            t('shopLocation.zonesNeedCoords'),
          );
          return false;
        }

        // Mode ZONES : validation locale alignée sur le backend.
        if (zones.length === 0) {
          Alert.alert('Aucune zone', 'Ajoutez au moins une zone de livraison.');
          return false;
        }

        for (let i = 0; i < zones.length; i++) {
          const z = zones[i];
          const label = `Zone ${i + 1}`;
          if (!z.name?.trim()) {
            Alert.alert(label, 'Le nom de la zone est requis.');
            return false;
          }
          if (z.maxDistance == null || z.maxDistance <= 0) {
            Alert.alert(label, 'La distance max doit être > 0 km.');
            return false;
          }
          if (z.deliveryFee == null || z.deliveryFee < 0) {
            Alert.alert(label, 'Les frais de livraison ne peuvent pas être négatifs.');
            return false;
          }
        }

        if (!zones.some(z => z.isActive)) {
          Alert.alert(
            'Aucune zone active',
            'Activez au moins une zone (toggle "Active").',
          );
          return false;
        }

        const payload = zones.map(z => ({
          name: z.name.trim(),
          deliveryFee: z.deliveryFee,
          maxDistance: z.maxDistance,
          isActive: z.isActive,
        }));

        try {
          // latitude/longitude re-envoyées avec les zones : le backend
          // valide les deux dans le même payload (SHOP_COORDINATES_REQUIRED
          // sinon), et cela protège contre un état serveur divergent.
          await epicerieService.updateMyEpicerie({
            deliveryMode: 'ZONES',
            deliveryZones: JSON.stringify(payload),
            latitude: shopLat!,
            longitude: shopLng!,
          });
          return true;
        } catch (err: any) {
          Alert.alert('Erreur',
            (typeof err === 'string' ? err : err?.message) ?? 'Sauvegarde impossible');
          return false;
        }
      },
    }));

    return (
      <View>
        {/* Bannière intro */}
        <View style={styles.introBanner}>
          <MaterialIcons name="local-shipping" size={22} color={colors.primary} />
          <View style={styles.introText}>
            <Text style={styles.introTitle}>Mode de livraison</Text>
            <Text style={styles.introSubtitle}>
              Choisissez comment vous facturez la livraison à vos clients.
            </Text>
          </View>
        </View>

        {/* Sélecteur de mode (3 cartes) */}
        <View style={styles.modePicker}>
          <ModeCard
            active={mode === 'ZONES'}
            icon="map"
            title="Par zones"
            subtitle="Tarifs selon la distance"
            onPress={() => setMode('ZONES')}
            disabled={busy}
          />
          <ModeCard
            active={mode === 'FLAT_RATE'}
            icon="attach-money"
            title="Forfait unique"
            subtitle="Un montant fixe pour toute livraison"
            onPress={() => setMode('FLAT_RATE')}
            disabled={busy}
          />
          <ModeCard
            active={mode === 'NONE'}
            icon="block"
            title="Pas de livraison"
            subtitle="Retrait en boutique uniquement"
            onPress={() => setMode('NONE')}
            disabled={busy}
          />
        </View>

        {/* Mode FLAT_RATE : un seul champ */}
        {mode === 'FLAT_RATE' && (
          <View style={styles.flatSection}>
            <Text style={styles.fieldLabel}>💰 Forfait livraison</Text>
            <View style={styles.inputWithSuffix}>
              <TextInput
                style={styles.numericInput}
                value={flatDeliveryFee != null ? String(flatDeliveryFee) : ''}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^\d.]/g, '');
                  const n = parseFloat(cleaned);
                  setFlatDeliveryFee(Number.isNaN(n) ? 0 : n);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9aa3ad"
                editable={!busy}
              />
              <Text style={styles.suffix}>{currencySymbol}</Text>
            </View>
            <Text style={styles.hint}>
              Ce montant sera ajouté à toute commande livrée à domicile, peu importe la distance.
            </Text>
          </View>
        )}

        {/* Mode NONE : juste un message */}
        {mode === 'NONE' && (
          <View style={styles.noneSection}>
            <MaterialIcons name="info-outline" size={20} color="#F57C00" />
            <Text style={styles.noneText}>
              Vos clients ne pourront que <Text style={styles.noneTextStrong}>retirer leurs commandes en boutique</Text>.
              L'option "livraison à domicile" sera désactivée dans l'app mobile.
            </Text>
          </View>
        )}

        {/* Mode ZONES + coordonnées manquantes : BLOQUEUR.
            La config des zones est masquée tant que la boutique n'a pas de
            position GPS valide (règle « GPS obligatoire pour la livraison
            par zone », validée côté backend via SHOP_COORDINATES_REQUIRED). */}
        {mode === 'ZONES' && !hasShopCoords && (
          <View style={styles.blockerCard}>
            <View style={styles.blockerHead}>
              <MaterialIcons name="location-off" size={22} color="#D84315" />
              <View style={{ flex: 1 }}>
                <Text style={styles.blockerTitle}>{t('shopLocation.blockerTitle')}</Text>
                <Text style={styles.blockerBody}>{t('shopLocation.blockerBody')}</Text>
              </View>
            </View>

            {/* Option 1 : GPS appareil */}
            <TouchableOpacity
              style={[styles.captureBtn, (locating || busy) && styles.captureBtnDisabled]}
              onPress={detectShopPosition}
              disabled={locating || geocoding || busy}
              activeOpacity={0.8}
            >
              {locating
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <MaterialIcons name="my-location" size={18} color={colors.primary} />}
              <Text style={styles.captureBtnText}>{t('shopLocation.detectPosition')}</Text>
            </TouchableOpacity>

            {/* Option 2 : géocoder l'adresse tapée */}
            <TextInput
              style={styles.addressInput}
              value={addressText}
              onChangeText={setAddressText}
              placeholder={t('shopLocation.addressPlaceholder')}
              placeholderTextColor="#9aa3ad"
              editable={!busy && !geocoding}
            />
            <TouchableOpacity
              style={[styles.captureBtn, (geocoding || busy) && styles.captureBtnDisabled]}
              onPress={locateShopAddress}
              disabled={locating || geocoding || busy}
              activeOpacity={0.8}
            >
              {geocoding
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <MaterialIcons name="travel-explore" size={18} color={colors.primary} />}
              <Text style={styles.captureBtnText}>{t('shopLocation.locateAddress')}</Text>
            </TouchableOpacity>

            {/* Option 3 : saisie manuelle */}
            <TouchableOpacity
              onPress={() => setShowManualCoords(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.manualToggle}>
                {showManualCoords ? '▾ ' : '▸ '}{t('shopLocation.manualEntry')}
              </Text>
            </TouchableOpacity>
            {showManualCoords && (
              <View>
                <View style={styles.manualRow}>
                  <TextInput
                    style={[styles.addressInput, styles.manualInput]}
                    value={manualLat}
                    onChangeText={setManualLat}
                    placeholder="Latitude (ex : 33.5731)"
                    placeholderTextColor="#9aa3ad"
                    keyboardType="numbers-and-punctuation"
                    editable={!busy}
                  />
                  <TextInput
                    style={[styles.addressInput, styles.manualInput]}
                    value={manualLng}
                    onChangeText={setManualLng}
                    placeholder="Longitude (ex : -7.5898)"
                    placeholderTextColor="#9aa3ad"
                    keyboardType="numbers-and-punctuation"
                    editable={!busy}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.captureBtn, busy && styles.captureBtnDisabled]}
                  onPress={saveManualCoords}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="save" size={18} color={colors.primary} />
                  <Text style={styles.captureBtnText}>{t('shopLocation.saveCoords')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Mode ZONES : configuration multi-zones (uniquement si position OK) */}
        {mode === 'ZONES' && hasShopCoords && <>

        {/* Position confirmée — rappel discret */}
        <View style={styles.coordsOkRow}>
          <MaterialIcons name="check-circle" size={16} color={colors.success} />
          <Text style={styles.coordsOkText}>
            {t('shopLocation.coordsOk')} ({shopLat!.toFixed(4)}, {shopLng!.toFixed(4)})
          </Text>
        </View>

        {/* Liste des zones */}
        {zones.map((zone, index) => (
          <View
            key={index}
            style={[styles.zoneCard, !zone.isActive && styles.zoneCardInactive]}
          >
            <View style={styles.zoneHead}>
              <View style={styles.zoneIndex}>
                <Text style={styles.zoneIndexText}>{index + 1}</Text>
              </View>
              <TextInput
                style={styles.zoneNameInput}
                value={zone.name}
                onChangeText={(text) => updateZone(index, { name: text })}
                placeholder="Nom de la zone"
                placeholderTextColor="#9aa3ad"
                editable={!busy}
                maxLength={60}
              />
              <Switch
                value={zone.isActive}
                onValueChange={(v) => updateZone(index, { isActive: v })}
                trackColor={{ false: colors.border, true: '#A7F3D0' }}
                thumbColor={zone.isActive ? colors.success : '#f4f4f4'}
                disabled={busy}
              />
              <TouchableOpacity
                style={[
                  styles.deleteBtn,
                  (busy || zones.length <= 1) && styles.deleteBtnDisabled,
                ]}
                onPress={() => removeZone(index)}
                disabled={busy || zones.length <= 1}
                activeOpacity={0.6}
              >
                <MaterialIcons name="delete-outline" size={20} color={
                  busy || zones.length <= 1 ? colors.borderStrong : colors.danger
                } />
              </TouchableOpacity>
            </View>

            <View style={styles.zoneFields}>
              <View style={styles.zoneField}>
                <Text style={styles.fieldLabel}>📏 Distance max</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.numericInput}
                    value={zone.maxDistance != null ? String(zone.maxDistance) : ''}
                    onChangeText={(text) => {
                      const n = parseInt(text.replace(/\D/g, ''), 10);
                      updateZone(index, {
                        maxDistance: Number.isNaN(n) ? 0 : n,
                      });
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="5"
                    placeholderTextColor="#9aa3ad"
                    editable={!busy}
                  />
                  <Text style={styles.suffix}>km</Text>
                </View>
              </View>

              <View style={styles.zoneField}>
                <Text style={styles.fieldLabel}>💰 Frais</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.numericInput}
                    value={zone.deliveryFee != null ? String(zone.deliveryFee) : ''}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^\d.]/g, '');
                      const n = parseFloat(cleaned);
                      updateZone(index, {
                        deliveryFee: Number.isNaN(n) ? 0 : n,
                      });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#9aa3ad"
                    editable={!busy}
                  />
                  <Text style={styles.suffix}>{currencySymbol}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* Bouton d'ajout */}
        <TouchableOpacity
          style={[styles.addBtn, busy && styles.addBtnDisabled]}
          onPress={addZone}
          disabled={busy}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add" size={18} color={busy ? colors.textSubtle : colors.success} />
          <Text style={[styles.addBtnText, busy && styles.addBtnTextDisabled]}>
            Ajouter une zone
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Conseil : créez au moins 2 zones (proche / étendue) pour mieux refléter
          vos coûts. Les zones désactivées ne livreront pas mais sont conservées.
        </Text>
        </>}
      </View>
    );
  }
);

interface ModeCardProps {
  active: boolean;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}

function ModeCard({ active, icon, title, subtitle, onPress, disabled }: ModeCardProps) {
  return (
    <TouchableOpacity
      style={[styles.modeCard, active && styles.modeCardActive, disabled && styles.modeCardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={active ? colors.success : colors.textMuted}
      />
      <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]}>{title}</Text>
      <Text style={styles.modeCardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Décode `deliveryZones` :
 *  - Tableau de zones → renvoyé après normalisation.
 *  - Ancien format `{mode: 'RADIUS', radiusKm}` → migré en zone unique.
 *  - Ancien format `{mode: 'NEIGHBORHOODS', ...}` → migré en zone unique
 *    avec maxDistance par défaut (l'utilisateur ajustera).
 *  - Reste → null (caller utilisera STARTER_ZONES).
 */
function parseZones(json?: string): DeliveryZone[] | null {
  if (!json) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }

  if (Array.isArray(parsed)) {
    const zones = parsed
      .filter((z): z is Partial<DeliveryZone> => z != null && typeof z === 'object')
      .map(z => ({
        name: String(z.name ?? '').trim() || 'Zone',
        deliveryFee: Number(z.deliveryFee ?? 0),
        maxDistance: Number(z.maxDistance ?? 5),
        isActive: z.isActive !== false,
      }));
    return zones.length > 0 ? zones : null;
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as { mode?: string; radiusKm?: number };
    if (obj.mode === 'RADIUS') {
      return [{
        name: 'Zone principale',
        deliveryFee: 0,
        maxDistance: obj.radiusKm ?? 5,
        isActive: true,
      }];
    }
    if (obj.mode === 'NEIGHBORHOODS') {
      return [{
        name: 'Zone principale',
        deliveryFee: 0,
        maxDistance: 10,
        isActive: true,
      }];
    }
  }

  return null;
}

const styles = StyleSheet.create({
  // ── Bannière intro ────────────────────────────────────────────
  introBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm + 2,
    padding: space.md,
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.md,
    marginBottom: space.md + 2,
  },
  introText: { flex: 1 },
  introTitle: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  introSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.primary,
  },

  // ── Carte de zone ─────────────────────────────────────────────
  zoneCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    marginBottom: space.sm + 2,
  },
  zoneCardInactive: {
    backgroundColor: colors.bg,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  zoneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  zoneIndex: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  zoneNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnDisabled: {
    backgroundColor: 'transparent',
  },

  // ── Champs distance + frais ──────────────────────────────────
  zoneFields: {
    flexDirection: 'row',
    gap: space.sm + 2,
  },
  zoneField: { flex: 1 },
  fieldLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text,
    marginBottom: 6,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingRight: 12,
  },
  numericInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  suffix: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginLeft: 4,
  },

  // ── Bouton d'ajout ───────────────────────────────────────────
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    marginTop: 4,
    marginBottom: space.md,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.success,
  },
  addBtnTextDisabled: {
    color: colors.textSubtle,
  },

  // ── Hint ─────────────────────────────────────────────────────
  hint: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },

  // ── Bloqueur localisation (mode ZONES sans coordonnées) ─────
  blockerCard: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.md,
    gap: space.sm,
  },
  blockerHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginBottom: 4,
  },
  blockerTitle: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: '#BF360C',
    marginBottom: 2,
  },
  blockerBody: {
    ...typography.caption,
    fontSize: 12,
    color: '#6D4C41',
    lineHeight: 17,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 11,
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnText: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.primary,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  manualToggle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 4,
  },
  manualRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.sm,
  },
  manualInput: { flex: 1 },
  coordsOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.sm,
  },
  coordsOkText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.success,
  },

  // ── Mode picker (ZONES / FLAT_RATE / NONE) ──────────────────
  modePicker: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  modeCard: {
    flex: 1,
    padding: space.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
    gap: 4,
  },
  modeCardActive: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  modeCardDisabled: {
    opacity: 0.5,
  },
  modeCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  modeCardTitleActive: {
    color: colors.success,
  },
  modeCardSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
  },

  // ── Flat-rate section ────────────────────────────────────────
  flatSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.md,
  },

  // ── None section ─────────────────────────────────────────────
  noneSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: space.md,
  },
  noneText: {
    flex: 1,
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 18,
  },
  noneTextStrong: {
    fontWeight: '700',
  },
});
