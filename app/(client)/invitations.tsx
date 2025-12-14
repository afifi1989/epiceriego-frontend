import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { clientManagementService } from '../../src/services/clientManagementService';
import { ClientInvitation } from '../../src/type';
import { Colors, FontSizes, Spacing } from '../../src/constants/colors';

export default function ClientInvitationsScreen() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  /**
   * Get user ID from storage
   */
  useEffect(() => {
    const getUserId = async () => {
      const user = await AsyncStorage.getItem('@epiceriego_user');
      if (user) {
        const userData = JSON.parse(user);
        if (userData.id) {
          setUserId(userData.id);
        }
      }
    };
    getUserId();
  }, []);

  /**
   * Load invitations when screen is focused
   */
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadInvitations();
      }
    }, [userId])
  );

  /**
   * Load all pending invitations
   */
  const loadInvitations = async () => {
    try {
      setLoading(true);
      const data = await clientManagementService.getMyInvitations();
      setInvitations(data);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      Alert.alert('Erreur', 'Impossible de charger les invitations');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInvitations();
    setRefreshing(false);
  };

  /**
   * Accept invitation
   */
  const handleAcceptInvitation = async (invitation: ClientInvitation) => {
    if (!userId) {
      Alert.alert('Erreur', 'ID utilisateur non trouvé');
      return;
    }

    Alert.alert(
      'Accepter l\'invitation',
      `Voulez-vous devenir client de ${invitation.epicerieName} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Accepter',
          onPress: async () => {
            try {
              setProcessingId(invitation.epicerieId);

              await clientManagementService.acceptInvitation(
                invitation.epicerieId,
                userId
              );

              Alert.alert(
                '✅ Invitation acceptée',
                `Vous êtes maintenant client de ${invitation.epicerieName} !\n\n` +
                'Vous pouvez maintenant commander des produits et profiter de leurs services.'
              );

              await loadInvitations();
            } catch (error: any) {
              console.error('Error accepting invitation:', error);
              Alert.alert(
                'Erreur',
                error.message || error || 'Impossible d\'accepter l\'invitation'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Reject invitation
   */
  const handleRejectInvitation = async (invitation: ClientInvitation) => {
    if (!userId) {
      Alert.alert('Erreur', 'ID utilisateur non trouvé');
      return;
    }

    Alert.alert(
      'Refuser l\'invitation',
      `Êtes-vous sûr de vouloir refuser l'invitation de ${invitation.epicerieName} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(invitation.epicerieId);

              await clientManagementService.rejectInvitation(
                invitation.epicerieId,
                userId
              );

              Alert.alert(
                'Invitation refusée',
                `Vous avez refusé l'invitation de ${invitation.epicerieName}.`
              );

              await loadInvitations();
            } catch (error: any) {
              console.error('Error rejecting invitation:', error);
              Alert.alert(
                'Erreur',
                error.message || error || 'Impossible de refuser l\'invitation'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Render invitation item
   */
  const renderInvitationItem = ({ item }: { item: ClientInvitation }) => {
    const isProcessing = processingId === item.epicerieId;

    return (
      <View style={styles.invitationCard}>
        <View style={styles.invitationHeader}>
          <View style={styles.storeIcon}>
            <Text style={styles.storeIconText}>🏪</Text>
          </View>
          <View style={styles.invitationInfo}>
            <Text style={styles.storeName}>{item.epicerieName}</Text>
            <Text style={styles.invitationDate}>
              Invité le {new Date(item.createdAt).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </View>

        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            Vous invite à devenir client et à profiter de leurs services.
          </Text>
        </View>

        <View style={styles.benefitsBox}>
          <Text style={styles.benefitsTitle}>🎁 Avantages :</Text>
          <Text style={styles.benefitItem}>• Commander des produits facilement</Text>
          <Text style={styles.benefitItem}>• Suivre vos commandes en temps réel</Text>
          <Text style={styles.benefitItem}>• Gérer vos paiements et crédits</Text>
          <Text style={styles.benefitItem}>• Recevoir des promotions exclusives</Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleRejectInvitation(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#F44336" />
            ) : (
              <>
                <Text style={styles.rejectButtonIcon}>❌</Text>
                <Text style={styles.rejectButtonText}>Refuser</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleAcceptInvitation(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.acceptButtonIcon}>✅</Text>
                <Text style={styles.acceptButtonText}>Accepter</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && invitations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des invitations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {invitations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>📭</Text>
          <Text style={styles.emptyStateTitle}>Aucune invitation</Text>
          <Text style={styles.emptyStateText}>
            Vous n'avez pas d'invitation en attente pour le moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => `${item.epicerieId}-${item.clientId}`}
          renderItem={renderInvitationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  storeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeIconText: {
    fontSize: 28,
  },
  invitationInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  invitationDate: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  messageBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  messageText: {
    fontSize: FontSizes.sm,
    color: '#1565C0',
    lineHeight: 20,
  },
  benefitsBox: {
    backgroundColor: '#F1F8E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#558B2F',
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: FontSizes.xs,
    color: '#689F38',
    marginBottom: 4,
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  acceptButtonIcon: {
    fontSize: 18,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F44336',
    gap: 8,
  },
  rejectButtonIcon: {
    fontSize: 18,
  },
  rejectButtonText: {
    color: '#F44336',
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
