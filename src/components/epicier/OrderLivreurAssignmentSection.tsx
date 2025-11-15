import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AssignedLivreur } from '../../services/epicierLivreurService';

interface OrderLivreurAssignmentSectionProps {
  currentLivreur?: AssignedLivreur | null;
  availableLivreurs: AssignedLivreur[];
  isLoading?: boolean;
  onAssignClick: () => void;
  status?: string;
}

export const OrderLivreurAssignmentSection = ({
  currentLivreur,
  availableLivreurs,
  isLoading = false,
  onAssignClick,
  status = 'PRÊT',
}: OrderLivreurAssignmentSectionProps) => {
  const canAssign = status === 'PRÊT' || status === 'READY';

  if (!canAssign) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚚 Assignation Livreur</Text>
      </View>

      {currentLivreur ? (
        <View style={styles.assignedContainer}>
          <View style={styles.assignedInfo}>
            <Text style={styles.assignedLabel}>Livreur Assigné:</Text>
            <Text style={styles.assignedName}>{currentLivreur.nom}</Text>
            <Text style={styles.assignedPhone}>{currentLivreur.telephone}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: currentLivreur.isAvailable ? '#4CAF50' : '#999',
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {currentLivreur.isAvailable ? '🟢 Disponible' : '🔴 Occupé'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.changeButton, isLoading && styles.changeButtonDisabled]}
            onPress={onAssignClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.changeButtonText}>Modifier</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : availableLivreurs.length > 0 ? (
        <View style={styles.unassignedContainer}>
          <Text style={styles.unassignedMessage}>
            Aucun livreur assigné à cette commande
          </Text>
          <TouchableOpacity
            style={[styles.assignButton, isLoading && styles.assignButtonDisabled]}
            onPress={onAssignClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.assignButtonText}>Assigner un Livreur</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noLivreursContainer}>
          <Text style={styles.noLivreursIcon}>🚚</Text>
          <Text style={styles.noLivreursMessage}>
            Aucun livreur disponible pour cette épicerie
          </Text>
          <Text style={styles.noLivreursHint}>
            Assignez des livreurs dans la section "Gestion des Livreurs"
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  assignedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  assignedInfo: {
    flex: 1,
  },
  assignedLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  assignedName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  assignedPhone: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  changeButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 10,
  },
  changeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  changeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  unassignedContainer: {
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  unassignedMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  assignButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  assignButtonDisabled: {
    backgroundColor: '#ccc',
  },
  assignButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noLivreursContainer: {
    paddingVertical: 25,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  noLivreursIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  noLivreursMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  noLivreursHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
