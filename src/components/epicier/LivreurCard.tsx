import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Livreur } from '../../services/epicierLivreurService';

interface LivreurCardProps {
  livreur: Livreur;
  onAssign?: () => void;
  onUnassign?: () => void;
  isAssigned?: boolean;
  isLoading?: boolean;
}

export const LivreurCard = ({
  livreur,
  onAssign,
  onUnassign,
  isAssigned = false,
  isLoading = false,
}: LivreurCardProps) => {
  return (
    <View style={styles.card}>
      {/* En-tête avec statut */}
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={styles.nom}>👤 {livreur.nom}</Text>
          <Text style={styles.id}>ID: {livreur.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: livreur.isAvailable ? '#4CAF50' : '#999' }]}>
          <Text style={styles.statusText}>
            {livreur.isAvailable ? '🟢 Disponible' : '🔴 Occupé'}
          </Text>
        </View>
      </View>

      {/* Infos de contact */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>📞 Téléphone:</Text>
          <Text style={styles.value}>{livreur.telephone}</Text>
        </View>
        {livreur.currentLatitude && livreur.currentLongitude && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>📍 Position:</Text>
            <Text style={styles.value}>
              {livreur.currentLatitude.toFixed(4)}, {livreur.currentLongitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      {/* Statut d'assignation */}
      {isAssigned && (
        <View style={styles.assignedBadge}>
          <Text style={styles.assignedText}>✅ Assigné à votre épicerie</Text>
        </View>
      )}

      {/* Boutons d'action */}
      <View style={styles.actionsRow}>
        {!isAssigned && onAssign && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.assignBtn,
              isLoading && styles.actionBtnDisabled,
            ]}
            onPress={() => {
              console.log('[LivreurCard] ✅ Button pressed for:', livreur.nom);
              onAssign();
            }}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnText}>
              {isLoading ? '⏳ Assignation...' : 'Assigner'}
            </Text>
          </TouchableOpacity>
        )}
        {isAssigned && onUnassign && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.unassignBtn,
              isLoading && styles.actionBtnDisabled,
            ]}
            onPress={() => {
              console.log('[LivreurCard] ✅ Unassign button pressed for:', livreur.nom);
              onUnassign();
            }}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnText}>
              {isLoading ? '⏳ Suppression...' : 'Retirer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  info: {
    flex: 1,
  },
  nom: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  id: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 90,
  },
  value: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  assignedBadge: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  assignedText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  assignBtn: {
    backgroundColor: '#2196F3',
  },
  unassignBtn: {
    backgroundColor: '#f44336',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
