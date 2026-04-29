/**
 * StepDelivery — Étape "Zones de livraison" du wizard.
 *
 * Format JSON serialisé sur Epicerie.deliveryZones (cf.
 * EpicerieController.validateDeliveryZones backend) :
 *   [
 *     { "name": "Zone proche",  "deliveryFee": 10, "maxDistance": 3,  "isActive": true },
 *     { "name": "Zone étendue", "deliveryFee": 20, "maxDistance": 10, "isActive": true }
 *   ]
 *
 * Validation backend : tableau non vide, chaque zone a name + deliveryFee + maxDistance,
 * deliveryFee >= 0, maxDistance > 0, et au moins une zone avec isActive=true.
 *
 * Migration : les anciens contenus `{mode: 'RADIUS', radiusKm}` ou
 * `{mode: 'NEIGHBORHOODS', ...}` sont convertis en zone unique au mount.
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { epicerieService } from '../../../services/epicerieService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

interface DeliveryZone {
  name: string;
  deliveryFee: number;
  maxDistance: number;
  isActive: boolean;
}

const STARTER_ZONES: DeliveryZone[] = [
  { name: 'Zone proche',   deliveryFee: 10, maxDistance: 3,  isActive: true },
  { name: 'Zone étendue',  deliveryFee: 20, maxDistance: 10, isActive: true },
];

export const StepDelivery = forwardRef<StepHandle, StepProps>(
  function StepDelivery({ epicerie, busy }, ref) {
    const [zones, setZones] = useState<DeliveryZone[]>(
      () => parseZones(epicerie.deliveryZones) ?? [...STARTER_ZONES],
    );

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
          await epicerieService.updateMyEpicerie({
            deliveryZones: JSON.stringify(payload),
          });
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
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
            <Text style={styles.introTitle}>Vos zones de livraison</Text>
            <Text style={styles.introSubtitle}>
              Définissez plusieurs zones tarifaires (proche, étendue) avec un
              rayon max et des frais propres. Le client paiera selon la distance.
            </Text>
          </View>
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
      </View>
    );
  }
);

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
});
