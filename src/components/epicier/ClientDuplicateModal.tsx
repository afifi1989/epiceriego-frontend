/**
 * ClientDuplicateModal — Résolution du conflit 409 CLIENT_DUPLICATE.
 *
 * Affichée quand le backend détecte qu'un client correspondant existe déjà,
 * soit lors de la création d'un client carnet (confirmAction MERGE), soit lors
 * de l'invitation d'un compte (confirmAction LINK).
 *
 * Compare la fiche déjà présente (`existing`) et la saisie de l'épicier
 * (`incoming`) + le motif de correspondance, puis propose de confirmer la
 * fusion/le rattachement (rejoue le MÊME endpoint avec confirmMerge:true côté
 * appelant) ou d'annuler. Le serveur reste autoritaire : on ne renvoie aucun id.
 *
 * L'état `confirming` (loader) est contrôlé par l'écran appelant, qui rejoue
 * l'appel et ferme la modal en cas de succès.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { ClientDuplicateResponse } from '../../type';

interface ClientDuplicateModalProps {
  visible: boolean;
  data: ClientDuplicateResponse | null;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClientDuplicateModal({
  visible,
  data,
  confirming = false,
  onCancel,
  onConfirm,
}: ClientDuplicateModalProps) {
  const { t } = useLanguage();

  if (!data) return null;

  const isMerge = data.confirmAction === 'MERGE';

  const matchLabel =
    data.matchReason === 'EMAIL_PHONE'
      ? t('clientDuplicate.matchEmailPhone')
      : data.matchReason === 'PHONE'
        ? t('clientDuplicate.matchPhone')
        : t('clientDuplicate.matchEmail');

  const title = isMerge
    ? t('clientDuplicate.titleMerge')
    : t('clientDuplicate.titleLink');

  const confirmLabel = isMerge
    ? t('clientDuplicate.confirmMerge')
    : t('clientDuplicate.confirmLink');

  const none = t('clientDuplicate.none');
  const existing = data.existing;
  const incoming = data.incoming;

  const hasCredit =
    existing.allowCredit != null || existing.creditBalance != null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={confirming ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={26} color="#EF6C00" />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{data.message}</Text>

          {/* Motif de correspondance */}
          <View style={styles.matchRow}>
            <Ionicons name="git-compare-outline" size={14} color="#B45309" />
            <Text style={styles.matchText}>
              {t('clientDuplicate.matchLabel')} : {matchLabel}
            </Text>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Fiche existante */}
            <View style={[styles.fiche, styles.ficheExisting]}>
              <View style={styles.ficheHeader}>
                <Text style={styles.ficheTitle}>{t('clientDuplicate.existingTitle')}</Text>
                <View
                  style={[
                    styles.badge,
                    existing.hasAccount ? styles.badgeAccount : styles.badgeVirtual,
                  ]}
                >
                  <Ionicons
                    name={existing.hasAccount ? 'phone-portrait-outline' : 'book-outline'}
                    size={11}
                    color="#fff"
                  />
                  <Text style={styles.badgeText}>
                    {existing.hasAccount
                      ? t('clientDuplicate.hasAccount')
                      : t('clientDuplicate.virtualCard')}
                  </Text>
                </View>
              </View>

              <Row label={t('clientDuplicate.fieldName')} value={existing.name || none} />
              <Row label={t('clientDuplicate.fieldEmail')} value={existing.email || none} />
              <Row label={t('clientDuplicate.fieldPhone')} value={existing.phone || none} />
              {existing.status ? (
                <Row label={t('clientDuplicate.statusLabel')} value={existing.status} />
              ) : null}
              {hasCredit ? (
                <Row
                  label={t('clientDuplicate.creditLabel')}
                  value={
                    (existing.allowCredit
                      ? t('clientDuplicate.creditAllowed')
                      : t('clientDuplicate.creditNotAllowed')) +
                    (existing.creditBalance != null
                      ? `  ·  ${t('clientDuplicate.creditBalance')} ${existing.creditBalance.toFixed(2)} DH`
                      : '')
                  }
                />
              ) : null}
            </View>

            {/* Saisie de l'épicier */}
            <View style={[styles.fiche, styles.ficheIncoming]}>
              <Text style={styles.ficheTitle}>{t('clientDuplicate.incomingTitle')}</Text>
              <Row label={t('clientDuplicate.fieldName')} value={incoming.name || none} />
              <Row label={t('clientDuplicate.fieldEmail')} value={incoming.email || none} />
              <Row label={t('clientDuplicate.fieldPhone')} value={incoming.phone || none} />
            </View>
          </ScrollView>

          {/* Actions */}
          <Pressable
            onPress={onConfirm}
            disabled={confirming}
            style={({ pressed }) => [
              styles.cta,
              pressed && !confirming && { opacity: 0.85 },
              confirming && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>{confirmLabel}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onCancel}
            disabled={confirming}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t('clientDuplicate.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  scroll: {
    width: '100%',
    alignSelf: 'stretch',
  },
  fiche: {
    width: '100%',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  ficheExisting: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  ficheIncoming: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  ficheHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ficheTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeAccount: { backgroundColor: '#16A34A' },
  badgeVirtual: { backgroundColor: '#F59E0B' },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 3,
  },
  rowLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'right',
  },
  cta: {
    width: '100%',
    backgroundColor: '#EA580C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancel: {
    marginTop: 4,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
