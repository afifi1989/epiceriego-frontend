/**
 * Modal de rattachement manuel d'un client virtuel a un compte mobile reel.
 *
 * <p>Use case : l'epicier a un client en carnet (User.isVirtual=true) avec
 * un telephone "0612345678". Le client s'est inscrit avec "+212612345678".
 * Le auto-claim a echoue (formats differents), donc deux Users existent et
 * les factures restent invisibles cote client.</p>
 *
 * <p>Ce modal :</p>
 * <ol>
 *   <li>Au mount : appelle <code>GET /clients/{id}/link-candidates</code> qui
 *       retourne les comptes mobile dont le tel normalise correspond.</li>
 *   <li>Si candidats : l'epicier les voit dans une liste et tape sur un pour
 *       confirmer. Un POST /link declenche la fusion.</li>
 *   <li>Si aucun candidat : message explicite (le client doit d'abord
 *       s'inscrire sur l'app).</li>
 * </ol>
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  clientManagementService,
  LinkCandidate,
} from '../../services/clientManagementService';

type Props = {
  visible: boolean;
  epicerieId: number;
  clientId: number;
  clientName?: string;
  onClose: () => void;
  /** Appele apres link reussi : utile pour recharger l'ecran parent. */
  onLinked?: () => void;
};

export const LinkVirtualClientModal: React.FC<Props> = ({
  visible,
  epicerieId,
  clientId,
  clientName,
  onClose,
  onLinked,
}) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCandidates(null);
    clientManagementService
      .getLinkCandidates(epicerieId, clientId)
      .then(list => { if (!cancelled) setCandidates(list); })
      .catch((err: any) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, epicerieId, clientId]);

  const confirmLink = (candidate: LinkCandidate) => {
    Alert.alert(
      'Confirmer le rattachement',
      `Rattacher « ${clientName ?? 'ce client'} » au compte mobile de ${candidate.nom} (${candidate.email}) ?\n\nToutes les factures, avances et commandes seront transferees sur ce compte.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rattacher',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await clientManagementService.linkVirtualToReal(epicerieId, clientId, candidate.userId);
              Alert.alert('Succes', 'Client rattache. Les factures sont desormais visibles cote client.');
              onLinked?.();
              onClose();
            } catch (err: any) {
              Alert.alert('Erreur', String(err));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

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
          <Text style={styles.title}>🔗 Rattacher au compte mobile</Text>
          <Text style={styles.subtitle}>
            Si le client s'est inscrit sur l'app avec un format de telephone
            different, ses factures restent invisibles. Choisissez son compte
            ci-dessous pour les rattacher.
          </Text>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Recherche des comptes...</Text>
            </View>
          )}

          {error && (
            <View style={styles.center}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && candidates && candidates.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📱</Text>
              <Text style={styles.emptyTitle}>Aucun compte trouve</Text>
              <Text style={styles.emptyText}>
                Aucun compte mobile n'a un telephone correspondant. Demandez au
                client de s'inscrire sur l'app avec son numero, puis revenez ici.
              </Text>
            </View>
          )}

          {!loading && !error && candidates && candidates.length > 0 && (
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 16 }}>
              {candidates.map(c => (
                <TouchableOpacity
                  key={c.userId}
                  style={styles.candidate}
                  onPress={() => confirmLink(c)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(c.nom || c.email || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.candidateInfo}>
                    <Text style={styles.candidateName}>{c.nom || 'Sans nom'}</Text>
                    <Text style={styles.candidateMeta}>{c.email}</Text>
                    {!!c.telephone && <Text style={styles.candidateMeta}>📞 {c.telephone}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
            <Text style={styles.cancelText}>Fermer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 14 },
  center: { alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 10, color: '#6b7280', fontSize: 13 },
  errorIcon: { fontSize: 36, marginBottom: 8 },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
  list: { maxHeight: 340 },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2196F3',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  candidateInfo: { flex: 1 },
  candidateName: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  candidateMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chevron: { fontSize: 22, color: '#9ca3af', marginLeft: 6 },
  cancelBtn: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelText: { color: '#374151', fontSize: 14, fontWeight: '600' },
});
