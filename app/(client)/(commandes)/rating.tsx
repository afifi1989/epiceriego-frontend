import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ratingService, RatingNotificationInfo } from '../../../src/services/ratingService';
import { useLanguage } from '../../../src/context/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../../src/constants/config';

const STAR_SIZE = 50;

export default function RatingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ratingInfo, setRatingInfo] = useState<RatingNotificationInfo | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);

  useEffect(() => {
    loadUserAndRatingInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const loadUserAndRatingInfo = async () => {
    try {
      setLoading(true);
      console.log('[RatingScreen] Chargement des infos, orderId:', orderId);

      // Récupérer l'ID du client
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      console.log('[RatingScreen] userJson from AsyncStorage:', userJson);
      if (userJson) {
        const user = JSON.parse(userJson);
        console.log('[RatingScreen] Utilisateur parsé:', user);
        console.log('[RatingScreen] user.id:', user.id);
        console.log('[RatingScreen] user properties:', Object.keys(user));

        // Essayer différentes façons de récupérer l'ID
        const clientIdValue = user.id || user.userId || (user.user && user.user.id);
        console.log('[RatingScreen] clientIdValue détecté:', clientIdValue);

        if (clientIdValue) {
          setClientId(clientIdValue);
          console.log('[RatingScreen] Client ID chargé avec succès:', clientIdValue);
        } else {
          console.error('[RatingScreen] Impossible de trouver l\'ID du client dans l\'objet utilisateur');
        }
      } else {
        console.error('[RatingScreen] Aucun utilisateur trouvé dans AsyncStorage');
      }

      // Récupérer les infos de notation
      if (orderId) {
        console.log('[RatingScreen] Récupération infos notation pour orderId:', orderId);
        const info = await ratingService.getRatingInfoFromNotification(parseInt(orderId));
        console.log('[RatingScreen] Infos notation reçues:', info);
        setRatingInfo(info);

        // Si l'utilisateur a déjà noté, pré-remplir le formulaire
        if (info.hasRated && info.existingRating) {
          setSelectedRating(info.existingRating.rating);
          setComment(info.existingRating.comment || '');
        }
      } else {
        console.error('[RatingScreen] orderId non trouvé dans les paramètres:', orderId);
      }
    } catch (error) {
      console.error('[RatingScreen] Erreur:', error);
      Alert.alert(
        t('common.error'),
        typeof error === 'string' ? error : 'Une erreur est survenue'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    console.log('[RatingScreen] Soumission notation:', {
      selectedRating,
      ratingInfo: !!ratingInfo,
      clientId,
      comment
    });

    if (!selectedRating) {
      Alert.alert(t('common.warning'), 'Veuillez sélectionner une note');
      return;
    }

    if (!ratingInfo || !clientId) {
      console.error('[RatingScreen] Informations manquantes:', { ratingInfo: !!ratingInfo, clientId });
      Alert.alert(t('common.error'), 'Informations manquantes');
      return;
    }

    try {
      setSubmitting(true);
      const ratingData = {
        clientId,
        epicerieId: ratingInfo.epicerieId,
        rating: selectedRating,
        comment: comment.trim() || undefined,
      };
      console.log('[RatingScreen] Envoi des données:', ratingData);

      await ratingService.addOrUpdateRating(ratingData);

      Alert.alert(
        t('common.success'),
        ratingInfo.hasRated ? 'Votre notation a été modifiée avec succès' : 'Merci pour votre notation !',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('[RatingScreen] Erreur soumission:', error);
      Alert.alert(
        t('common.error'),
        typeof error === 'string' ? error : 'Erreur lors de l\'enregistrement'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!ratingInfo) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Impossible de charger les informations</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête avec la photo de l'épicerie */}
        <View style={styles.header}>
          {ratingInfo.epiceriePhotoUrl ? (
            <Image
              source={{ uri: ratingInfo.epiceriePhotoUrl }}
              style={styles.epiceriePhoto}
            />
          ) : (
            <View style={[styles.epiceriePhoto, styles.noPhotoPlaceholder]}>
              <Text style={styles.noPhotoText}>🏪</Text>
            </View>
          )}
        </View>

        {/* Informations épicerie */}
        <View style={styles.epicerieInfo}>
          <Text style={styles.epicerieName}>{ratingInfo.epicerieName}</Text>
          {ratingInfo.epicerieDescription && (
            <Text style={styles.epicerieDescription}>{ratingInfo.epicerieDescription}</Text>
          )}
        </View>

        {/* Message personnalisé */}
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{ratingInfo.message}</Text>
        </View>

        {/* Stats actuelles */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Note moyenne</Text>
            <View style={styles.statValue}>
              <Text style={styles.statNumber}>{ratingInfo.stats.averageRating.toFixed(1)}</Text>
              <Text style={styles.stars}>{'⭐'}</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Nombre d'avis</Text>
            <Text style={styles.statNumber}>{ratingInfo.stats.totalRatings}</Text>
          </View>
        </View>

        {/* Sélecteur d'étoiles */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>Votre avis</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setSelectedRating(star)}
                style={styles.starButton}
                activeOpacity={0.7}
              >
                <Text style={styles.star}>
                  {star <= selectedRating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedRating > 0 && (
            <Text style={styles.ratingLabel}>
              {selectedRating === 1 && 'Très mauvais'}
              {selectedRating === 2 && 'Mauvais'}
              {selectedRating === 3 && 'Correct'}
              {selectedRating === 4 && 'Bon'}
              {selectedRating === 5 && 'Excellent'}
            </Text>
          )}
        </View>

        {/* Commentaire */}
        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Partagez votre expérience..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={comment}
            onChangeText={setComment}
            editable={!submitting}
          />
          <Text style={styles.charCount}>
            {comment.length}/1000
          </Text>
        </View>

        {/* Décomposition des votes */}
        <View style={styles.breakdownSection}>
          <Text style={styles.sectionTitle}>Répartition des votes</Text>
          {[5, 4, 3, 2, 1].map((star) => (
            <View key={star} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{star} ⭐</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${ratingInfo.stats.totalRatings > 0
                        ? (star === 5 ? ratingInfo.stats.fiveStarCount
                          : star === 4 ? ratingInfo.stats.fourStarCount
                          : star === 3 ? ratingInfo.stats.threeStarCount
                          : star === 2 ? ratingInfo.stats.twoStarCount
                          : ratingInfo.stats.oneStarCount) / ratingInfo.stats.totalRatings * 100
                        : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownCount}>
                {star === 5 ? ratingInfo.stats.fiveStarCount
                  : star === 4 ? ratingInfo.stats.fourStarCount
                  : star === 3 ? ratingInfo.stats.threeStarCount
                  : star === 2 ? ratingInfo.stats.twoStarCount
                  : ratingInfo.stats.oneStarCount}
              </Text>
            </View>
          ))}
          <Text style={styles.recommendationText}>
            💡 {ratingInfo.stats.recommendationPercentage.toFixed(0)}% des clients recommandent cette épicerie
          </Text>
        </View>

        {/* Boutons d'action */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, !selectedRating && styles.submitButtonDisabled]}
            onPress={handleSubmitRating}
            disabled={!selectedRating || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {ratingInfo.hasRated ? 'Modifier ma notation' : 'Envoyer mon avis'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Espacement en bas */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  epiceriePhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e0e0e0',
  },
  noPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    fontSize: 60,
  },

  // Infos épicerie
  epicerieInfo: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  epicerieName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  epicerieDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // Message box
  messageBox: {
    marginHorizontal: 15,
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  messageText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
  },
  statItem: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  stars: {
    fontSize: 18,
  },

  // Rating section
  ratingSection: {
    marginHorizontal: 15,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 10,
  },
  starButton: {
    padding: 5,
  },
  star: {
    fontSize: STAR_SIZE,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },

  // Comment section
  commentSection: {
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    marginVertical: 10,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },

  // Breakdown section
  breakdownSection: {
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    width: 40,
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    width: 30,
    textAlign: 'right',
  },
  recommendationText: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 10,
    fontWeight: '500',
  },

  // Buttons
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 15,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 15,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 30,
  },
});
