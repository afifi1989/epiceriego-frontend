/**
 * SettingsSectionModal — Modal mobile qui héberge un step component
 * en mode "édition Settings" (pas en mode wizard).
 *
 * Différences avec le wizard :
 *  - Pas de stepper, pas de "Continuer" qui avance.
 *  - Bouton "Enregistrer" qui appelle step.submit() puis ferme la modal.
 *  - Bouton "Annuler" qui ferme sans rien faire.
 *
 * Le step component reste 100 % réutilisable — il ne sait pas si on
 * l'affiche dans un wizard ou une modal de settings, son contrat
 * (forwardRef + submit()) est le même.
 */

import React, { ReactNode, RefObject, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StepHandle } from '../steps/stepProps';

interface SettingsSectionModalProps {
  visible: boolean;
  title: string;
  icon: string;
  subtitle?: string;
  /** Référence vers le step component (forwardRef). */
  stepRef: RefObject<StepHandle>;
  /** Le step component à rendre. */
  children: ReactNode;
  onClose: () => void;
  /** Callback succès — typiquement reload de l'épicerie côté parent. */
  onSaved: () => void | Promise<void>;
}

export function SettingsSectionModal({
  visible, title, icon, subtitle,
  stepRef, children,
  onClose, onSaved,
}: SettingsSectionModalProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await stepRef.current?.submit();
      if (!ok) return;
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            disabled={saving}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerIcon}>{icon}</Text>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}

        {/* ── Body scrollable ── */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {/* ── Footer fixe ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const PRIMARY = '#2196F3';
const PRIMARY_DARK = '#1976D2';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: '#4b5563', fontWeight: '600' },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  headerIcon: { fontSize: 20 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 13,
    color: '#9aa3ad',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    lineHeight: 18,
  },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 24 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#cbd5e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
