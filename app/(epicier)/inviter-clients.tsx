import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors, FontSizes } from '../../src/constants/colors';
import { useLanguage } from '../../src/context/LanguageContext';
import { clientManagementService } from '../../src/services/clientManagementService';
import { ClientInvitation } from '../../src/type';

export default function InviterClientsScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [emailInput, setEmailInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);
  const [useClientId, setUseClientId] = useState(false);

  /**
   * Get epicerie ID from storage
   */
  useEffect(() => {
    const getEpicerieId = async () => {
      const user = await AsyncStorage.getItem('@epiceriego_user');

      if (user) {
        const userData = JSON.parse(user);
        if (userData.epicerieId) {
          setEpicerieId(userData.epicerieId);
        }
      }
    };

    getEpicerieId();
  }, []);

  /**
   * Load invitations when epicerie ID is available
   */
  useFocusEffect(
    useCallback(() => {
      if (epicerieId) {
        loadInvitations();
      }
    }, [epicerieId])
  );

  /**
   * Load all invitations
   */
  const loadInvitations = async () => {
    if (!epicerieId) return;

    try {
      const invitationList =
        await clientManagementService.getClientInvitations(epicerieId);
      setInvitations(invitationList);
    } catch (error) {
      console.error('Error loading invitations:', error);
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
   * Validate email
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Send invitation by client ID
   */
  const handleSendInvitationById = async () => {
    const clientId = parseInt(clientIdInput);

    if (!clientIdInput.trim() || isNaN(clientId)) {
      Alert.alert('Erreur', 'Veuillez entrer un ID client valide');
      return;
    }

    if (!epicerieId) {
      Alert.alert('Erreur', 'ID épicerie non trouvé');
      return;
    }

    try {
      setLoading(true);

      // Call the actual API to send invitation
      await clientManagementService.sendClientInvitation(epicerieId, clientId);

      Alert.alert(
        'Succès',
        `Invitation envoyée au client #${clientId}`
      );

      setClientIdInput('');
      await loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      Alert.alert(
        'Erreur',
        error.message || "Impossible d'envoyer l'invitation"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Send invitation by email
   */
  const handleSendInvitation = async () => {
    if (!emailInput.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un email');
      return;
    }

    if (!isValidEmail(emailInput)) {
      Alert.alert('Erreur', 'Email invalide');
      return;
    }

    if (!epicerieId) {
      Alert.alert('Erreur', 'ID épicerie non trouvé');
      return;
    }

    try {
      setLoading(true);

      // Extract name from email if possible (before @)
      const clientName = emailInput.split('@')[0];

      // Call the API to send invitation by email
      await clientManagementService.sendClientInvitationByEmail(
        epicerieId,
        emailInput.trim(),
        clientName
      );

      Alert.alert(
        'Succès',
        `Invitation envoyée à ${emailInput}`
      );

      setEmailInput('');
      await loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);

      // Check if it's a "client doesn't exist" error
      if (error.includes("n'existe pas") || error.includes("not found")) {
        Alert.alert(
          'Client non trouvé',
          `Aucun utilisateur avec l'email ${emailInput} n'existe dans le système.\n\nLe client doit d'abord créer un compte sur l'application.`,
          [
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert(
          'Erreur',
          error.message || error || "Impossible d'envoyer l'invitation"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Render invitation item
   */
  const renderInvitationItem = ({
    item,
  }: {
    item: ClientInvitation;
  }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'PENDING':
          return '#FF9800';
        case 'ACCEPTED':
          return '#4CAF50';
        case 'REJECTED':
          return '#F44336';
        default:
          return Colors.primary;
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'PENDING':
          return 'En attente';
        case 'ACCEPTED':
          return 'Acceptée';
        case 'REJECTED':
          return 'Rejetée';
        default:
          return status;
      }
    };

    const canResend = item.status === 'PENDING';

    return (
      <View
        style={[
          styles.invitationCard,
          { borderLeftColor: getStatusColor(item.status) },
        ]}
      >
        <View style={styles.invitationHeader}>
          <View style={styles.invitationInfo}>
            <Text style={styles.clientName}>{item.clientName}</Text>
            <Text style={styles.clientEmail}>{item.clientEmail}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(item.status) + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.statusLabel,
                { color: getStatusColor(item.status) },
              ]}
            >
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.invitationDate}>
          <Text style={styles.dateLabel}>
            Invitée le{' '}
            {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {canResend && (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => {
              Alert.alert(
                "Renvoyer l'invitation",
                `Êtes-vous sûr de vouloir renvoyer l'invitation à ${item.clientEmail} ?`,
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Renvoyer',
                    onPress: async () => {
                      try {
                        Alert.alert('Succès', 'Invitation renvoyée');
                      } catch (error) {
                        Alert.alert(
                          'Erreur',
                          "Impossible de renvoyer l'invitation"
                        );
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.resendButtonText}>Renvoyer</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Send Invitation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Inviter un nouveau client
          </Text>

          {/* Toggle between email and ID */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !useClientId && styles.toggleButtonActive,
              ]}
              onPress={() => setUseClientId(false)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  !useClientId && styles.toggleButtonTextActive,
                ]}
              >
                Par Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                useClientId && styles.toggleButtonActive,
              ]}
              onPress={() => setUseClientId(true)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  useClientId && styles.toggleButtonTextActive,
                ]}
              >
                Par ID Client
              </Text>
            </TouchableOpacity>
          </View>

          {useClientId ? (
            // Client ID input
            <View style={styles.inputSection}>
              <TextInput
                style={styles.input}
                placeholder="ID du client (ex: 123)"
                placeholderTextColor="#999"
                value={clientIdInput}
                onChangeText={setClientIdInput}
                keyboardType="number-pad"
                editable={!loading}
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (loading || !clientIdInput.trim()) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={handleSendInvitationById}
                disabled={loading || !clientIdInput.trim()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Email input
            <View style={styles.inputSection}>
              <TextInput
                style={styles.input}
                placeholder="Email du client"
                placeholderTextColor="#999"
                value={emailInput}
                onChangeText={setEmailInput}
                keyboardType="email-address"
                editable={!loading}
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (loading || !emailInput.trim()) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={handleSendInvitation}
                disabled={loading || !emailInput.trim()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {useClientId
                ? '💡 Entrez l\'ID du client à inviter. Une fois l\'invitation acceptée, vous pourrez gérer son crédit et voir ses commandes.'
                : '💡 Entrez l\'email du client. Le client doit déjà avoir un compte enregistré dans l\'application. Une fois l\'invitation acceptée, vous pourrez gérer son crédit et voir ses commandes.'}
            </Text>
          </View>
        </View>

        {/* Invitations History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Historique des invitations
            </Text>

            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/(epicier)/historique-invitations')}
            >
              <Text style={styles.viewAllButtonText}>Voir tout</Text>
              <Text style={styles.viewAllIcon}>→</Text>
            </TouchableOpacity>
          </View>

          {invitations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>📧</Text>
              <Text style={styles.emptyStateText}>
                Aucune invitation envoyée
              </Text>
            </View>
          ) : (
            <FlatList
              data={invitations}
              keyExtractor={(item) =>
                item.id?.toString() || item.clientEmail
              }
              renderItem={renderInvitationItem}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  section: {
    paddingHorizontal: 15,
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  viewAllButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 4,
  },
  viewAllIcon: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  inputSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: FontSizes.sm,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  sendButtonDisabled: {
    backgroundColor: '#bbb',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: 12,
    borderRadius: 6,
  },
  infoText: {
    fontSize: FontSizes.xs,
    color: '#1565C0',
    lineHeight: 18,
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invitationInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  invitationDate: {
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  resendButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resendButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
