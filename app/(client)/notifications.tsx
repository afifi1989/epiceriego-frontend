import { useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { Notification, notificationService } from '../../src/services/notificationService';
import { clientManagementService } from '../../src/services/clientManagementService';
import { authService } from '../../src/services/authService';

type NotificationType = 'ORDER' | 'PROMOTION' | 'DELIVERY' | 'ALERT' | 'INFO' | 'INVITATION';

interface GroupedNotifications {
  [date: string]: Notification[];
}

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<GroupedNotifications>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processedInvitations, setProcessedInvitations] = useState<Set<number>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    try {
      setLoading(true);
      console.log('[NotificationsScreen] Chargement des notifications...');

      const grouped = await notificationService.getNotificationsGroupedByDate();
      setNotifications(grouped);

      // Marquer les non lues comme lues après affichage
      const unread = await notificationService.getUnreadNotifications();
      if (unread.length > 0) {
        await notificationService.markAllAsRead();
      }

      console.log('[NotificationsScreen] Notifications chargées:', Object.keys(grouped).length, 'dates');
    } catch (error) {
      console.error('[NotificationsScreen] Erreur chargement:', error);
      Alert.alert(t('common.error'), t('notifications.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteNotification = (notificationId: number, titre: string) => {
    Alert.alert(
      t('notifications.deleteNotification'),
      `${t('notifications.confirmDelete')} "${titre}" ?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await notificationService.deleteNotification(notificationId);
              if (success) {
                await loadNotifications();
                Alert.alert(t('common.success'), t('notifications.deleted'));
              } else {
                Alert.alert(t('common.error'), t('notifications.deleteError'));
              }
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert(t('common.error'), t('notifications.errorOccurred'));
            }
          },
        },
      ]
    );
  };

  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'ORDER':
        return '📦';
      case 'PROMOTION':
        return '🎉';
      case 'DELIVERY':
        return '🚚';
      case 'ALERT':
        return '⚠️';
      case 'INFO':
        return 'ℹ️';
      case 'INVITATION':
        return '✉️';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
      case 'ORDER':
        return '#2196F3';
      case 'PROMOTION':
        return '#FF9800';
      case 'DELIVERY':
        return '#4CAF50';
      case 'ALERT':
        return '#F44336';
      case 'INFO':
        return '#9C27B0';
      case 'INVITATION':
        return '#FF5722';
      default:
        return '#757575';
    }
  };

  const handleAcceptInvitation = async (notificationId: number) => {
    try {
      // Trouver la notification pour extraire les données
      const notification = Object.values(notifications)
        .flat()
        .find(n => n.id === notificationId);

      console.log('[AcceptInvitation] Notification trouvée:', notification);
      console.log('[AcceptInvitation] Notification.data (brut):', notification?.data);

      if (!notification) {
        throw new Error('Notification introuvable');
      }

      if (!notification.data) {
        console.error('[AcceptInvitation] notification.data est undefined/null');
        throw new Error('Données de notification manquantes');
      }

      // Parser les données JSON si c'est une chaîne
      let notificationData: any;
      if (typeof notification.data === 'string') {
        try {
          notificationData = JSON.parse(notification.data);
          console.log('[AcceptInvitation] Notification.data parsé:', notificationData);
        } catch (parseError) {
          console.error('[AcceptInvitation] Erreur parsing JSON:', parseError);
          throw new Error('Format de données invalide');
        }
      } else {
        notificationData = notification.data;
      }

      const epicerieId = notificationData.epicerieId;
      const currentUser = await authService.getCurrentUser();

      console.log('[AcceptInvitation] epicerieId:', epicerieId);
      console.log('[AcceptInvitation] currentUser:', currentUser);
      console.log('[AcceptInvitation] currentUser.userId:', currentUser?.userId);

      if (!epicerieId || !currentUser?.userId) {
        console.error('[AcceptInvitation] Données manquantes - epicerieId:', epicerieId, 'userId:', currentUser?.userId);
        throw new Error(`Informations manquantes pour accepter l'invitation (epicerieId: ${epicerieId}, userId: ${currentUser?.userId})`);
      }

      console.log('[AcceptInvitation] Appel API avec epicerieId:', epicerieId, 'clientId:', currentUser.userId);

      // Appeler le service pour accepter l'invitation
      await clientManagementService.acceptInvitation(epicerieId, currentUser.userId);

      // Supprimer la notification après acceptation
      try {
        await notificationService.deleteNotification(notificationId);
      } catch (deleteError) {
        console.warn('[AcceptInvitation] Erreur lors de la suppression de la notification:', deleteError);
      }

      Alert.alert(t('common.success'), t('notifications.invitationAccepted'));

      // Recharger les notifications pour mettre à jour l'affichage
      await loadNotifications();
    } catch (error: any) {
      console.error('Erreur acceptation invitation:', error);

      // Message d'erreur personnalisé si l'invitation n'est plus en attente
      let errorMessage = error.message || t('notifications.invitationError');
      if (error.message && error.message.includes("n'est pas en attente")) {
        errorMessage = "Cette invitation a déjà été traitée. Veuillez la supprimer ou demander à l'épicier de vous renvoyer une nouvelle invitation.";
      }

      Alert.alert(t('common.error'), errorMessage);
    }
  };

  const handleRejectInvitation = async (notificationId: number) => {
    Alert.alert(
      t('notifications.rejectInvitation'),
      t('notifications.confirmReject'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reject'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Trouver la notification pour extraire les données
              const notification = Object.values(notifications)
                .flat()
                .find(n => n.id === notificationId);

              if (!notification || !notification.data) {
                throw new Error('Données de notification manquantes');
              }

              // Parser les données JSON si c'est une chaîne
              let notificationData: any;
              if (typeof notification.data === 'string') {
                try {
                  notificationData = JSON.parse(notification.data);
                } catch (parseError) {
                  console.error('[RejectInvitation] Erreur parsing JSON:', parseError);
                  throw new Error('Format de données invalide');
                }
              } else {
                notificationData = notification.data;
              }

              const epicerieId = notificationData.epicerieId;
              const currentUser = await authService.getCurrentUser();

              if (!epicerieId || !currentUser?.userId) {
                throw new Error('Informations manquantes pour refuser l\'invitation');
              }

              // Appeler le service pour refuser l'invitation
              await clientManagementService.rejectInvitation(epicerieId, currentUser.userId);

              // Supprimer la notification après refus
              try {
                await notificationService.deleteNotification(notificationId);
              } catch (deleteError) {
                console.warn('[RejectInvitation] Erreur lors de la suppression de la notification:', deleteError);
              }

              Alert.alert(t('common.success'), t('notifications.invitationRejected'));

              // Recharger les notifications pour mettre à jour l'affichage
              await loadNotifications();
            } catch (error: any) {
              console.error('Erreur refus invitation:', error);

              // Message d'erreur personnalisé si l'invitation n'est plus en attente
              let errorMessage = error.message || t('notifications.invitationError');
              if (error.message && error.message.includes("n'est pas en attente")) {
                errorMessage = "Cette invitation a déjà été traitée. Veuillez la supprimer ou demander à l'épicier de vous renvoyer une nouvelle invitation.";
              }

              Alert.alert(t('common.error'), errorMessage);
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const renderNotificationCard = (notification: Notification) => {
    const isInvitation = notification.type === 'INVITATION';
    const isProcessed = processedInvitations.has(notification.id);

    // Vérifier le statut de l'invitation dans les données
    let invitationStatus = null;
    if (isInvitation && notification.data) {
      try {
        const notificationData = typeof notification.data === 'string'
          ? JSON.parse(notification.data)
          : notification.data;
        invitationStatus = notificationData.status;
      } catch (e) {
        console.error('Erreur parsing notification data:', e);
      }
    }

    // Afficher les boutons seulement si l'invitation est en attente ET non traitée localement
    const isPending = !invitationStatus || invitationStatus === 'PENDING' || invitationStatus === 'EN_ATTENTE';
    const showInvitationActions = isInvitation && !isProcessed && isPending;

    return (
      <View key={notification.id} style={styles.notificationCard}>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationIconContainer}>
              <Text style={styles.notificationIcon}>
                {getNotificationIcon(notification.type as NotificationType)}
              </Text>
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>{notification.titre}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              <Text style={styles.notificationTime}>
                {new Date(notification.dateCreated).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View
              style={[
                styles.notificationBadge,
                {
                  backgroundColor: getNotificationColor(notification.type as NotificationType),
                },
              ]}
            >
              <Text style={styles.notificationBadgeText}>{notification.type[0]}</Text>
            </View>
          </View>

          {showInvitationActions ? (
            <View style={styles.invitationActions}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptInvitation(notification.id)}
              >
                <Text style={styles.acceptButtonText}>✓ {t('notifications.accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleRejectInvitation(notification.id)}
              >
                <Text style={styles.rejectButtonText}>✕ {t('notifications.reject')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(notification.id, notification.titre)}
            >
              <Text style={styles.deleteButtonText}>🗑️ {t('notifications.delete')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('notifications.loading')}</Text>
      </View>
    );
  }

  const notificationCount = Object.values(notifications).reduce((total, arr) => total + arr.length, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📢 {t('notifications.myNotifications')}</Text>
        <Text style={styles.headerSubtitle}>
          {notificationCount} {notificationCount !== 1 ? t('notifications.notifications') : t('notifications.notification')}
        </Text>
      </View>

      {notificationCount === 0 ? (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>{t('notifications.noNotifications')}</Text>
            <Text style={styles.emptySubtext}>
              {t('notifications.historyMessage')}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.notificationsContainer}>
            {Object.entries(notifications).map(([date, dateNotifications]) => (
              <View key={date}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{date}</Text>
                </View>
                {dateNotifications.map(notification => renderNotificationCard(notification))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  notificationsContainer: {
    padding: 15,
  },
  dateHeader: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  dateHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  notificationContent: {
    padding: 15,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  notificationIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  notificationBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  notificationBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  deleteButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  invitationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  acceptButtonText: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ffebee',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef9a9a',
  },
  rejectButtonText: {
    color: '#c62828',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
});
