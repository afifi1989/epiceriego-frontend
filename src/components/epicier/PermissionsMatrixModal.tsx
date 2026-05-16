/**
 * Modale matrice des permissions par role (mobile).
 *
 * <p>Pendant du PermissionsMatrixComponent cote web. Affiche une grille
 * Action x Role avec ✓/✗ pour permettre a l'epicier de comprendre ce
 * qu'un role autorise. Groupe par categorie metier.</p>
 *
 * <p>Si {@code highlightProfile} est fourni, la colonne correspondante
 * est surlignee — utile depuis la fiche d'un collaborateur.</p>
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  PROFILE_PERMISSIONS,
  UserProfile,
  Feature,
} from '../../hooks/usePermissions';
import {
  FEATURE_CATEGORIES,
  PROFILE_SHORT_LABELS,
} from '../../constants/permissionLabels';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Met en evidence la colonne d'un role precis. */
  highlightProfile?: UserProfile;
};

const ROLES: UserProfile[] = ['owner', 'manager', 'gestionnaire', 'caissier'];

export const PermissionsMatrixModal: React.FC<Props> = ({
  visible,
  onClose,
  highlightProfile,
}) => {
  const hasFeature = (role: UserProfile, feature: Feature): boolean =>
    PROFILE_PERMISSIONS[role].includes(feature);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>🛡️ Permissions par rôle</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Vue d'ensemble de ce que chaque rôle peut faire dans l'épicerie.
          </Text>

          <ScrollView
            style={styles.scrollArea}
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator={false}
          >
            {/* En-tete sticky : 1 col Action + 4 cols Roles */}
            <View style={styles.headerRow}>
              <View style={[styles.headCell, styles.headAction]}>
                <Text style={styles.headText}>Action</Text>
              </View>
              {ROLES.map(role => (
                <View
                  key={role}
                  style={[
                    styles.headCell,
                    styles.headRole,
                    highlightProfile === role && styles.headHighlighted,
                  ]}
                >
                  <Text
                    style={[
                      styles.headText,
                      highlightProfile === role && styles.headTextHighlighted,
                    ]}
                  >
                    {PROFILE_SHORT_LABELS[role] ?? role}
                  </Text>
                </View>
              ))}
            </View>

            {/* Categories + lignes */}
            {FEATURE_CATEGORIES.map(cat => (
              <View key={cat.key}>
                <View style={styles.categoryRow}>
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                </View>
                {cat.features.map(f => (
                  <View key={f.feature} style={styles.featureRow}>
                    <View style={[styles.cell, styles.actionCell]}>
                      <Text style={styles.actionLabel}>{f.label}</Text>
                      <Text style={styles.actionDesc}>{f.description}</Text>
                    </View>
                    {ROLES.map(role => {
                      const granted = hasFeature(role, f.feature);
                      return (
                        <View
                          key={role}
                          style={[
                            styles.cell,
                            styles.roleCell,
                            highlightProfile === role && styles.cellHighlighted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.checkmark,
                              granted ? styles.granted : styles.denied,
                              highlightProfile === role && granted && styles.grantedHighlighted,
                            ]}
                          >
                            {granted ? '✓' : '✗'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}

            <View style={{ height: 24 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 0,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  closeBtn: { padding: 6 },
  closeIcon: { fontSize: 20, color: '#6b7280', fontWeight: '700' },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 17,
  },
  scrollArea: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  headCell: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headAction: {
    flex: 2.5,
    alignItems: 'flex-start',
    paddingLeft: 14,
  },
  headRole: { flex: 1 },
  headHighlighted: {
    backgroundColor: '#eff6ff',
  },
  headText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  headTextHighlighted: { color: '#1d4ed8' },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fafbfc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  catIcon: { fontSize: 14 },
  catLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  featureRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCell: {
    flex: 2.5,
    alignItems: 'flex-start',
    paddingLeft: 14,
  },
  roleCell: { flex: 1 },
  cellHighlighted: { backgroundColor: 'rgba(59, 130, 246, 0.06)' },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 14,
  },
  checkmark: { fontSize: 16, fontWeight: '700' },
  granted: { color: '#16a34a' },
  grantedHighlighted: { color: '#1d4ed8' },
  denied: { color: '#d1d5db' },
});
