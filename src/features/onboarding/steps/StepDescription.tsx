/**
 * StepDescription — Étape "Description & Contact pro" du wizard.
 *
 * Champs :
 *  - Description publique de l'épicerie (textarea)
 *  - Téléphone professionnel — préfixe affiché en lecture seule depuis
 *    {@code country.phonePrefix}, l'épicier ne saisit que le numéro local.
 *
 * Adaptation pays :
 *  - Préfixe affiché en grisé devant l'input (lit `country.phonePrefix`).
 *  - Validation locale légère : numéro ≥ 6 chiffres (longueur exacte
 *    varie selon pays — on ne tente pas une validation par pays trop
 *    stricte ici, le backend fera le contrôle final).
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { epicerieService } from '../../../services/epicerieService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

const MAX_DESCRIPTION = 500;

export const StepDescription = forwardRef<StepHandle, StepProps>(
  function StepDescription({ epicerie, country, busy }, ref) {
    const [description, setDescription] = useState(epicerie.description ?? '');
    const [telephonePro, setTelephonePro] = useState(
      stripPhonePrefix(epicerie.telephonePro ?? '', country?.phonePrefix),
    );

    useImperativeHandle(ref, () => ({
      async submit() {
        const cleanedPhone = telephonePro.replace(/\D/g, '');
        // Validation souple — on accepte vide (utilisateur peut skip
        // l'étape, mais s'il a tapé quelque chose, qu'au moins ce soit
        // plausible).
        if (cleanedPhone.length > 0 && cleanedPhone.length < 6) {
          Alert.alert(
            'Numéro trop court',
            'Le numéro de téléphone doit contenir au moins 6 chiffres.',
          );
          return false;
        }
        const fullPhone = cleanedPhone.length > 0
          ? `${country?.phonePrefix ?? ''}${cleanedPhone}`
          : '';
        try {
          await epicerieService.updateMyEpicerie({
            description: description.trim(),
            telephonePro: fullPhone || undefined,
          });
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
          return false;
        }
      },
    }));

    const remaining = MAX_DESCRIPTION - description.length;

    return (
      <View>
        {/* ── Description ── */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Description de l'épicerie</Text>
            <Text style={[
              styles.counter,
              remaining < 50 && styles.counterWarn,
            ]}>
              {remaining}
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={(text) => {
              if (text.length <= MAX_DESCRIPTION) setDescription(text);
            }}
            placeholder="Présentez votre boutique en quelques mots — produits phares, ambiance, valeurs…"
            placeholderTextColor="#9aa3ad"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!busy}
          />
        </View>

        {/* ── Téléphone pro avec préfixe ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Téléphone professionnel</Text>
          <View style={styles.phoneRow}>
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>
                {country?.phonePrefix ?? '+'}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={telephonePro}
              onChangeText={setTelephonePro}
              placeholder={phonePlaceholder(country?.code)}
              placeholderTextColor="#9aa3ad"
              keyboardType="phone-pad"
              editable={!busy}
            />
          </View>
          {country?.phonePrefix && (
            <Text style={styles.hint}>
              Pays détecté : {country.name} ({country.phonePrefix})
            </Text>
          )}
        </View>
      </View>
    );
  }
);

/**
 * Si le numéro stocké inclut déjà le préfixe pays, le retire pour
 * l'afficher proprement dans l'input (qui n'affiche que la partie
 * locale). Robuste : si le préfixe n'est pas reconnu, on retourne le
 * numéro tel quel.
 */
function stripPhonePrefix(phone: string, prefix?: string): string {
  if (!phone || !prefix) return phone;
  const normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith(prefix)) {
    return normalized.slice(prefix.length);
  }
  return phone;
}

/**
 * Placeholder adapté au format national typique. Liste minimale —
 * le pays par défaut tombera sur un placeholder générique.
 */
function phonePlaceholder(code?: string): string {
  switch (code) {
    case 'MA': return '6XX XX XX XX';
    case 'FR': return '6 12 34 56 78';
    case 'ES': return '6XX XX XX XX';
    case 'DE': return '15X XXXX XXXX';
    default:   return 'Numéro local';
  }
}

const styles = StyleSheet.create({
  field: { marginBottom: space.lg + 2 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 2,
  },
  label: {
    ...typography.caption,
    color: colors.text,
  },
  counter: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  counterWarn: {
    color: colors.warning,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: {
    minHeight: 110,
    paddingTop: 12,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phonePrefix: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    minWidth: 70,
  },
  phonePrefixText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  phoneInput: {
    flex: 1,
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    marginLeft: 2,
  },
});
