import { Colors } from '../../constants/colors';
/**
 * Modal de choix de session POS à reprendre — Axe POS / S6.
 *
 * <p>S'affiche au démarrage de {@code vente-directe.tsx} quand plusieurs
 * sessions ACTIVE/PARKED existent côté serveur (scénario multi-device).</p>
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { PosSessionResponse } from '../../services/posSessionService';

interface Props {
  visible: boolean;
  sessions: PosSessionResponse[];
  currentDeviceId?: string | null;
  /** Appelé quand l'épicier choisit de reprendre une session existante. */
  onResume: (session: PosSessionResponse) => void;
  /** Appelé pour démarrer une nouvelle session vierge (ignorer l'existant). */
  onNew: () => void;
  /** Appelé pour abandonner toutes les sessions (nettoyage). */
  onAbandonAll?: () => void;
  onClose: () => void;
}

export const PosSessionPicker: React.FC<Props> = ({
  visible, sessions, currentDeviceId, onResume, onNew, onAbandonAll, onClose
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Reprendre un panier ?</Text>
              <Text style={styles.subtitle}>
                {sessions.length} session(s) ouverte(s) — choisissez d'en reprendre
                une ou d'en démarrer une nouvelle.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {sessions.map(s => {
              let cartCount = 0;
              let total = 0;
              try {
                const cart = JSON.parse(s.cartJson || '[]');
                cartCount = Array.isArray(cart) ? cart.length : 0;
              } catch { /* ignore */ }
              total = s.totalAmount ?? 0;

              const isSameDevice = s.deviceId && s.deviceId === currentDeviceId;
              const updated = new Date(s.updatedAt);

              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.sessionCard}
                  onPress={() => onResume(s)}
                >
                  <View style={styles.sessionTop}>
                    <Text style={styles.sessionName}>
                      {s.name || `Session #${s.id}`}
                    </Text>
                    <View style={[
                      styles.deviceBadge,
                      { backgroundColor: isSameDevice ? '#e8f5e9' : '#fff3e0' }
                    ]}>
                      <Ionicons
                        name={isSameDevice ? 'phone-portrait' : 'tablet-landscape'}
                        size={11}
                        color={isSameDevice ? '#2e7d32' : '#e65100'}
                      />
                      <Text style={[
                        styles.deviceBadgeText,
                        { color: isSameDevice ? '#2e7d32' : '#e65100' }
                      ]}>
                        {isSameDevice ? 'Ce device' : 'Autre device'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sessionMeta}>
                    <Text style={styles.sessionMetaText}>
                      🛒 {cartCount} article{cartCount > 1 ? 's' : ''}
                    </Text>
                    {total > 0 && (
                      <Text style={styles.sessionMetaText}>
                        · {total.toFixed(2)} DH
                      </Text>
                    )}
                    <Text style={styles.sessionMetaText}>
                      · {formatRelative(updated)}
                    </Text>
                  </View>

                  {s.notes ? (
                    <Text style={styles.sessionNotes} numberOfLines={1}>
                      {s.notes}
                    </Text>
                  ) : null}

                  <View style={styles.resumeHint}>
                    <Ionicons name="arrow-forward-circle" size={16} color={Colors.primary} />
                    <Text style={styles.resumeHintText}>Reprendre ce panier</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footerActions}>
            {onAbandonAll && (
              <TouchableOpacity onPress={onAbandonAll} style={styles.abandonBtn}>
                <Text style={styles.abandonBtnText}>Abandonner tout</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onNew} style={styles.newBtn}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.newBtnText}>Nouvelle vente vierge</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 18, maxHeight: '80%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 8 }
    })
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12
  },
  title: { fontSize: 18, fontWeight: '800', color: '#333' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 4 },
  iconBtn: { padding: 4 },

  sessionCard: {
    backgroundColor: '#f5f7fa', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1.5, borderColor: '#e0e0e0'
  },
  sessionTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  sessionName: { fontSize: 15, fontWeight: '800', color: '#333', flex: 1 },
  deviceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10
  },
  deviceBadgeText: { fontSize: 10, fontWeight: '800' },

  sessionMeta: {
    flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap'
  },
  sessionMetaText: { fontSize: 12, color: '#666' },

  sessionNotes: {
    fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 4
  },

  resumeHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8
  },
  resumeHintText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },

  footerActions: {
    flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center'
  },
  abandonBtn: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#ef9a9a'
  },
  abandonBtnText: { color: '#c62828', fontWeight: '700', fontSize: 13 },

  newBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.primary,
    paddingVertical: 14, borderRadius: 10
  },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 }
});
