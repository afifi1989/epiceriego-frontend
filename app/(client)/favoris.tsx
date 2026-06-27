export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EpicerieLogo } from '../../src/components/client/EpicerieLogo';
import { Skeleton, useToast } from '../../src/components/feedback';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { favoritesService } from '../../src/services/favoritesService';
import { useTheme } from '../../src/theme';
import { Epicerie } from '../../src/type';

export default function FavorisScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const toast = useToast();

  const [favorites, setFavorites] = useState<Epicerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const loadFavorites = useCallback(async () => {
    try {
      const favoriteIds = await favoritesService.getFavoriteIds();

      if (favoriteIds.length === 0) {
        setFavorites([]);
        return;
      }

      // Charge les épiceries en parallèle (avant: boucle séquentielle = lent
      // dès 4-5 favoris). Promise.allSettled pour ne pas tomber globalement
      // si une seule épicerie est inaccessible.
      const results = await Promise.allSettled(
        favoriteIds.map(id => epicerieService.getEpicerieById(id))
      );

      const epiceriesData: Epicerie[] = results
        .filter((r): r is PromiseFulfilledResult<Epicerie> => r.status === 'fulfilled')
        .map(r => r.value);

      setFavorites(epiceriesData);
    } catch (error) {
      console.error('[FavorisScreen] loadFavorites failed:', error);
      toast.error(t('common.error'), t('favorites.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, toast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadFavorites();
    }, [loadFavorites])
  );

  /**
   * UI optimiste: on retire l'épicerie de la liste immédiatement, puis on
   * appelle l'API. Si elle échoue, on restaure et on toast l'erreur.
   * Bénéfice utilisateur: feedback instantané sur l'action, pas d'attente
   * réseau perceptible. Le pattern est sûr car la mutation est idempotente
   * (suppression d'un favori) et trivialement réversible côté UI.
   */
  const removeFavoriteOptimistic = useCallback(
    async (epicerieId: number) => {
      const snapshot = favorites;
      const removed = favorites.find(e => e.id === epicerieId);
      if (!removed) return;

      setFavorites(prev => prev.filter(e => e.id !== epicerieId));

      try {
        const success = await favoritesService.removeFavorite(epicerieId);
        if (!success) throw new Error('removeFavorite returned false');
        toast.success(t('favorites.removed'), removed.nomEpicerie);
      } catch (error) {
        console.error('[FavorisScreen] removeFavorite failed:', error);
        setFavorites(snapshot); // rollback
        toast.error(t('common.error'), t('favorites.removeError'));
      }
    },
    [favorites, t, toast]
  );

  const handleRemoveFavorite = useCallback(
    (epicerieId: number, epicerieName: string) => {
      // Confirmation native (Alert) conservée: c'est un standard a11y et
      // l'utilisateur attend ce dialog avant une action destructive.
      Alert.alert(
        t('favorites.removeFavorite'),
        `${t('favorites.confirmRemove')} "${epicerieName}" ${t('favorites.fromFavorites')}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => removeFavoriteOptimistic(epicerieId),
          },
        ]
      );
    },
    [removeFavoriteOptimistic, t]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFavorites();
  }, [loadFavorites]);

  const renderEpicerie = (item: Epicerie) => (
    <View key={item.id} style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => router.push(`/(client)/(epicerie)/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={item.nomEpicerie}
      >
        <View style={styles.cardHeader}>
          {/* Logo épicerie à gauche — tap pour agrandir, fallback emoji 🏪 sinon. */}
          <EpicerieLogo photoUrl={item.photoUrl} accessibilityLabel={item.nomEpicerie} />
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.nomEpicerie}</Text>
            <Text style={styles.cardAddress}>{item.adresse}</Text>
            {/* Note retirée : l'ancienne valeur "⭐ 4.5" était hardcodée (jamais
                la vraie note). À réintroduire quand le DTO favoris portera
                averageRating. */}
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveFavorite(item.id, item.nomEpicerie)}
        accessibilityRole="button"
        accessibilityLabel={`${t('favorites.remove')} ${item.nomEpicerie}`}
      >
        <Ionicons name="heart-dislike-outline" size={16} color={theme.colors.danger} />
        <Text style={styles.removeButtonText}>{t('favorites.remove')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⭐ {t('favorites.myFavorites')}</Text>
          <Text style={styles.headerSubtitle}>{t('favorites.loading')}</Text>
        </View>
        <View style={styles.resultsContainer}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  {/* Skeleton logo aligné sur la position réelle (à gauche, 64×64) */}
                  <Skeleton variant="rect" width={64} height={64} style={{ borderRadius: 12 }} />
                  <View style={styles.cardInfo}>
                    <Skeleton variant="text" width="70%" style={{ marginBottom: 8 }} />
                    <Skeleton variant="text" width="90%" style={{ marginBottom: 10 }} />
                    <Skeleton variant="text" width="40%" />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⭐ {t('favorites.myFavorites')}</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length}{' '}
          {favorites.length !== 1 ? t('favorites.epiceries') : t('favorites.epicerie')}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={favorites.length === 0 ? styles.scrollEmpty : undefined}
      >
        {favorites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💔</Text>
            <Text style={styles.emptyText}>{t('favorites.noFavorites')}</Text>
            <Text style={styles.emptySubtext}>{t('favorites.addFavoritesHint')}</Text>
            <TouchableOpacity
              style={styles.discoverButton}
              onPress={() => router.push('/(client)/epiceries')}
              accessibilityRole="button"
            >
              <Text style={styles.discoverButtonText}>🔍 {t('favorites.discoverEpiceries')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultsContainer}>{favorites.map(renderEpicerie)}</View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollEmpty: {
      flexGrow: 1,
    },
    header: {
      backgroundColor: theme.colors.brand,
      padding: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
    },
    headerTitle: {
      ...theme.typography.titleLg,
      color: theme.colors.onBrand,
      marginBottom: theme.spacing.xs,
    },
    headerSubtitle: {
      ...theme.typography.body,
      color: theme.colors.onBrand,
      opacity: 0.9,
    },
    resultsContainer: {
      padding: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing.lg,
      overflow: 'hidden',
      ...theme.shadows.sm,
    },
    cardContent: {
      padding: theme.spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    cardInfo: {
      flex: 1,
    },
    cardTitle: {
      ...theme.typography.titleSm,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    cardAddress: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    cardMeta: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
    },
    cardMetaText: {
      ...theme.typography.caption,
      color: theme.colors.brand,
      fontWeight: '600',
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.dangerSubtle,
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    removeButtonText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.danger,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxxl,
    },
    emptyEmoji: {
      fontSize: 80,
      marginBottom: theme.spacing.xl,
    },
    emptyText: {
      ...theme.typography.titleMd,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptySubtext: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
    },
    discoverButton: {
      backgroundColor: theme.colors.brand,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.md,
    },
    discoverButtonText: {
      ...theme.typography.titleSm,
      color: theme.colors.onBrand,
    },
  });
}
