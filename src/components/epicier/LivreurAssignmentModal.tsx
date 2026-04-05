import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AssignedLivreur } from '../../services/epicierLivreurService';

interface LivreurAssignmentModalProps {
  visible: boolean;
  livreurs: AssignedLivreur[];
  selectedLivreurId: number | null;
  isLoading?: boolean;
  onSelect: (livreur: AssignedLivreur) => void;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export const LivreurAssignmentModal = ({
  visible,
  livreurs,
  selectedLivreurId,
  isLoading = false,
  onSelect,
  onConfirm,
  onCancel,
  title = 'Assigner un Livreur',
  description = 'Sélectionnez un livreur pour cette commande',
}: LivreurAssignmentModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Titre */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {/* Liste des livreurs */}
          <ScrollView style={styles.livreursList} showsVerticalScrollIndicator={false}>
            {livreurs.length > 0 ? (
              livreurs.map(livreur => {
                const isOffline = !livreur.isAvailable;
                const isSelected = selectedLivreurId === livreur.id;
                return (
                  <TouchableOpacity
                    key={livreur.id}
                    style={[
                      styles.livreurItem,
                      isSelected && styles.livreurItemSelected,
                      isOffline && styles.livreurItemDisabled,
                    ]}
                    onPress={() => !isOffline && onSelect(livreur)}
                    disabled={isLoading || isOffline}
                    activeOpacity={isOffline ? 1 : 0.7}
                  >
                    {/* Checkbox */}
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                        isOffline && styles.checkboxDisabled,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>

                    {/* Info du livreur */}
                    <View style={styles.livreurInfo}>
                      <Text style={[styles.livreurNom, isOffline && styles.textDisabled]}>
                        👤 {livreur.nom}
                      </Text>
                      <Text style={[styles.livreurDetails, isOffline && styles.textDisabled]}>
                        {livreur.telephone}
                      </Text>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: livreur.isAvailable ? '#4CAF50' : '#f44336' },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: livreur.isAvailable ? '#4CAF50' : '#f44336' }]}>
                          {livreur.isAvailable ? '🟢 En ligne' : '🔴 Hors ligne'}
                        </Text>
                      </View>
                    </View>

                    {isOffline && (
                      <Text style={styles.offlineTag}>Indisponible</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🚚</Text>
                <Text style={styles.emptyText}>
                  Aucun livreur assigné à votre épicerie
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Boutons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (!selectedLivreurId || isLoading) && styles.confirmButtonDisabled,
              ]}
              onPress={onConfirm}
              disabled={!selectedLivreurId || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  livreursList: {
    maxHeight: 350,
    marginBottom: 15,
  },
  livreurItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  livreurItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  livreurItemDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxDisabled: {
    backgroundColor: '#e0e0e0',
    borderColor: '#ccc',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  livreurInfo: {
    flex: 1,
  },
  livreurNom: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  livreurDetails: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
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
  textDisabled: {
    color: '#aaa',
  },
  offlineTag: {
    fontSize: 10,
    color: '#f44336',
    fontWeight: '600',
    backgroundColor: '#ffebee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
