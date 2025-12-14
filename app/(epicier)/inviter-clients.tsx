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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [epicerieId, setEpicerieId] = useState<number | null>(null);

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
   * Send invitation
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

      Alert.alert(
        'Invitation envoyée',
        `Une invitation a été envoyée à ${emailInput}`
      );

      setEmailInput('');
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
                <Text style={styles.sendButtonText}>
                  Envoyer invitation
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Le client recevra un email avec un lien d'acceptation de
              l'invitation. Une fois acceptée, vous pourrez gérer son
              crédit et voir ses commandes.
            </Text>
          </View>
        </View>

        {/* Invitations History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Historique des invitations
          </Text>

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
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
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
