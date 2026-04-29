/**
 * StepWhatsapp — Étape "WhatsApp Business" du wizard.
 *
 * Trois réglages sur Epicerie :
 *  - whatsappEnabled       : active la réception de commandes WhatsApp
 *  - whatsappWelcomeMessage: message d'accueil envoyé au client
 *  - whatsappAutoAccept    : acceptation automatique des commandes valides
 *
 * Note : whatsappPhone est le numéro de la plateforme (mêmes pour
 * toutes les épiceries), géré côté backend. L'épicier ne le configure
 * pas — d'où son absence du formulaire.
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { epicerieService } from '../../../services/epicerieService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

const MAX_WELCOME = 300;
const DEFAULT_WELCOME_FR =
  'Bonjour 👋 Bienvenue dans notre épicerie ! ' +
  'Vous pouvez commander vos produits en m\'envoyant la liste de ce dont vous avez besoin.';

export const StepWhatsapp = forwardRef<StepHandle, StepProps>(
  function StepWhatsapp({ epicerie, busy }, ref) {
    const [enabled, setEnabled] = useState(epicerie.whatsappEnabled ?? false);
    const [welcome, setWelcome] = useState(
      epicerie.whatsappWelcomeMessage ?? DEFAULT_WELCOME_FR,
    );
    const [autoAccept, setAutoAccept] = useState(epicerie.whatsappAutoAccept ?? false);

    useImperativeHandle(ref, () => ({
      async submit() {
        if (enabled && welcome.trim().length === 0) {
          Alert.alert('Message d\'accueil requis',
            'Personnalisez le message envoyé à vos clients quand WhatsApp est activé.');
          return false;
        }
        try {
          await epicerieService.updateMyEpicerie({
            whatsappEnabled: enabled,
            whatsappWelcomeMessage: welcome.trim(),
            whatsappAutoAccept: autoAccept,
          });
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
          return false;
        }
      },
    }));

    const remaining = MAX_WELCOME - welcome.length;

    return (
      <View>
        {/* ── Toggle activation ── */}
        <View style={[styles.card, enabled && styles.cardActive]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {enabled ? '✅ WhatsApp activé' : '💬 Activer WhatsApp Business'}
              </Text>
              <Text style={styles.cardSubtitle}>
                Recevez des commandes directement par WhatsApp
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: '#A7F3D0' }}
              thumbColor={enabled ? '#25D366' : '#f4f4f4'}
              disabled={busy}
            />
          </View>
        </View>

        {/* ── Réglages — masqués si désactivé ── */}
        {enabled && (
          <>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Message d'accueil</Text>
                <Text style={[
                  styles.counter,
                  remaining < 30 && styles.counterWarn,
                ]}>
                  {remaining}
                </Text>
              </View>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={welcome}
                onChangeText={(text) => {
                  if (text.length <= MAX_WELCOME) setWelcome(text);
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Bonjour ! Bienvenue dans notre épicerie…"
                placeholderTextColor="#9aa3ad"
                editable={!busy}
              />
              <Text style={styles.hint}>
                Premier message envoyé à un client qui vous contacte sur WhatsApp.
              </Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Acceptation automatique</Text>
                <Text style={styles.toggleSubtitle}>
                  Les commandes valides sont acceptées sans intervention manuelle.
                </Text>
              </View>
              <Switch
                value={autoAccept}
                onValueChange={setAutoAccept}
                trackColor={{ false: colors.border, true: '#A7F3D0' }}
                thumbColor={autoAccept ? '#25D366' : '#f4f4f4'}
                disabled={busy}
              />
            </View>

            <View style={styles.hintBox}>
              <Text style={styles.hintIcon}>ℹ️</Text>
              <Text style={styles.hintText}>
                L'acceptation automatique est utile en heures de pointe.
                Vous pouvez la désactiver à tout moment depuis les réglages.
              </Text>
            </View>
          </>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  // ── Carte toggle principal ──
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md + 2,
    marginBottom: space.lg,
  },
  cardActive: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    borderWidth: 1.5,
    padding: space.md + 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cardTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  // ── Field ──
  field: { marginBottom: space.lg },
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
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    marginLeft: 2,
  },
  // ── Toggle secondaire ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.md,
    gap: space.md,
  },
  toggleTitle: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  toggleSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  // ── Hint box ──
  hintBox: {
    flexDirection: 'row',
    gap: space.sm + 2,
    backgroundColor: colors.bg,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radii.sm,
    padding: space.md,
  },
  hintIcon: { fontSize: 16 },
  hintText: {
    flex: 1,
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
});
