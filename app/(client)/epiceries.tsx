import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { EpicerieLogo } from '../../src/components/client/EpicerieLogo';
import { Skeleton, useToast } from '../../src/components/feedback';
import { useLanguage } from '../../src/context/LanguageContext';
import { epicerieService } from '../../src/services/epicerieService';
import { favoritesService } from '../../src/services/favoritesService';
import { Epicerie } from '../../src/type';

type SearchMode = 'proximity' | 'name' | 'address' | 'combined';

export default function EpiceriesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const [epiceries, setEpiceries] = useState<Epicerie[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // Search parameters
  const [searchMode, setSearchMode] = useState<SearchMode>('proximity');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('5');
  const [searchName, setSearchName] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  useEffect(() => {
    checkLocationPermission();
    loadFavoriteIds();
    // Auto-trigger location detection on page load
    initializeAutoSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search effect - triggers ONLY when location coordinates are obtained
  useEffect(() => {
    if (hasAutoSearched) return; // Prevent multiple searches

    // Trigger search ONLY when we have valid latitude and longitude
    if (latitude && longitude) {
      setHasAutoSearched(true);
      console.log('[EpiceriesScreen] 📍 Localisation détectée, lancement recherche automatique:', { latitude, longitude });
      // Use async IIFE to allow await without making the effect async
      (async () => {
        // Small delay to ensure state updates are processed
        await new Promise(resolve => setTimeout(resolve, 100));
        await performAutoSearch();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  const loadFavoriteIds = async () => {
    try {
      const ids = await favoritesService.getFavoriteIds();
      setFavoriteIds(ids);
      console.log('[EpiceriesScreen] Favoris chargés:', ids);
    } catch (error) {
      console.error('[EpiceriesScreen] Erreur chargement favoris:', error);
    }
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationEnabled(status === 'granted');
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
    }
  };

  const initializeAutoSearch = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        // If permission already granted, get current location
        await getCurrentLocation();
      } else {
        // Request permission automatically
        await requestLocationPermission();
      }
    } catch {
      console.error('[EpiceriesScreen] Erreur initialisation auto-recherche');
      // Even if location fails, we can still search without location
      setLocationEnabled(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationEnabled(true);
        getCurrentLocation();
      } else {
        toast.warning(
          t('epiceries.permissionDenied'),
          t('epiceries.permissionMessage')
        );
      }
    } catch {
      toast.error(t('common.error'), t('epiceries.permissionRequestError'));
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        // Confirmation native conservée: prompt avec deux choix (Oui/Non)
        // qui déclenche éventuellement la requête de permission. Pattern
        // utilisateur attendu (système-natif) pour ce type de demande.
        Alert.alert(
          t('epiceries.locationDisabled'),
          t('epiceries.enableLocationMessage'),
          [
            { text: t('common.no'), style: 'cancel' },
            { text: t('common.yes'), onPress: requestLocationPermission }
          ]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLatitude(location.coords.latitude.toFixed(6));
      setLongitude(location.coords.longitude.toFixed(6));
    } catch {
      toast.error(t('common.error'), t('epiceries.gpsError'));
    } finally {
      setLocationLoading(false);
    }
  };

  const searchEpiceries = async () => {
    if (loading) return;

    try {
      setLoading(true);
      let data: Epicerie[] = [];

      switch (searchMode) {
        case 'proximity':
          if (!latitude || !longitude) {
            toast.warning(t('common.error'), t('epiceries.enterCoordinates'));
            return;
          }
          data = await epicerieService.searchByProximity(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(radius) || 5
          );
          break;

        case 'name':
          if (!searchName.trim()) {
            toast.warning(t('common.error'), t('epiceries.enterName'));
            return;
          }
          data = await epicerieService.searchByName(searchName.trim());
          break;

        case 'address':
          if (!searchAddress.trim()) {
            toast.warning(t('common.error'), t('epiceries.enterAddress'));
            return;
          }
          data = await epicerieService.searchByAddress(searchAddress.trim());
          break;

        case 'combined':
          if (!latitude || !longitude || !searchName.trim()) {
            toast.warning(t('common.error'), t('epiceries.fillAllFields'));
            return;
          }
          data = await epicerieService.searchByProximityAndName(
            parseFloat(latitude),
            parseFloat(longitude),
            searchName.trim(),
            parseFloat(radius) || 3
          );
          break;
      }

      setEpiceries(data);
      // Recharger les favoris après la recherche
      await loadFavoriteIds();

      // L'empty state inline du composant suffit — pas besoin d'un dialog
      // qui interrompt la lecture des résultats. (avant: Alert "0 résultat")
    } catch (error) {
      toast.error(t('common.error'), String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const performAutoSearch = async () => {
    try {
      setLoading(true);
      let data: Epicerie[] = [];

      console.log('[EpiceriesScreen] Auto-search lancée avec:', {
        latitude,
        longitude,
        locationEnabled,
        searchMode,
      });

      // If we have location coordinates, search by proximity
      if (latitude && longitude) {
        console.log('[EpiceriesScreen] Recherche par proximité avec coords:', latitude, longitude);
        data = await epicerieService.searchByProximity(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(radius) || 5
        );
        console.log('[EpiceriesScreen] Résultats proximité:', data.length);
      }
      // If location was denied, fall back to getting all epiceries by empty name search
      else if (!locationEnabled) {
        console.log('[EpiceriesScreen] Emplacement refusé, récupération de toutes les épiceries');
        data = await epicerieService.searchByName(''); // Empty search returns all
        console.log('[EpiceriesScreen] Résultats par défaut:', data.length);
      }

      setEpiceries(data);
      // Recharger les favoris après la recherche
      await loadFavoriteIds();

      // Auto-search silencieuse: on laisse l'empty state inline gérer le
      // "0 résultat". Pas de dialog ni de toast (auto-déclenché → l'utilisateur
      // n'a pas demandé d'action explicite).
    } catch (error) {
      console.error('[EpiceriesScreen] Erreur auto-recherche:', error);
      // Silently fail on auto-search to avoid annoying users
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    searchEpiceries();
  };

  const renderSearchMode = () => {
    return (
      <View style={styles.searchModeContainer}>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'proximity' && styles.modeButtonActive]}
          onPress={() => setSearchMode('proximity')}
        >
          <Text style={[styles.modeButtonText, searchMode === 'proximity' && styles.modeButtonTextActive]}>
            📍 {t('epiceries.proximity')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'name' && styles.modeButtonActive]}
          onPress={() => setSearchMode('name')}
        >
          <Text style={[styles.modeButtonText, searchMode === 'name' && styles.modeButtonTextActive]}>
            🔍 {t('epiceries.name')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'address' && styles.modeButtonActive]}
          onPress={() => setSearchMode('address')}
        >
          <Text style={[styles.modeButtonText, searchMode === 'address' && styles.modeButtonTextActive]}>
            🏘️ {t('epiceries.zone')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'combined' && styles.modeButtonActive]}
          onPress={() => setSearchMode('combined')}
        >
          <Text style={[styles.modeButtonText, searchMode === 'combined' && styles.modeButtonTextActive]}>
            ⚡ {t('epiceries.combined')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSearchForm = () => {
    return (
      <View style={styles.searchForm}>
        {/* Proximity Search */}
        {(searchMode === 'proximity' || searchMode === 'combined') && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>📍 {t('epiceries.geolocation')}</Text>
            
            {latitude && longitude ? (
              <View style={styles.locationDisplay}>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>📍 {t('epiceries.positionDetected')}</Text>
                  <Text style={styles.locationCoords}>
                    {t('epiceries.lat')}: {parseFloat(latitude).toFixed(4)} | {t('epiceries.lon')}: {parseFloat(longitude).toFixed(4)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.redetectButton}
                  onPress={getCurrentLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color="#4CAF50" />
                  ) : (
                    <Text style={styles.redetectButtonText}>🔄</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.locationButton}
                onPress={getCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <>
                    <Text style={styles.locationButtonIcon}>📍</Text>
                    <Text style={styles.locationButtonText}>
                      {t('epiceries.detectPosition')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('epiceries.searchRadius')}</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                value={radius}
                onChangeText={setRadius}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        )}

        {/* Name Search */}
        {(searchMode === 'name' || searchMode === 'combined') && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>🔍 {t('epiceries.epicerieName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('epiceries.namePlaceholder')}
              value={searchName}
              onChangeText={setSearchName}
              placeholderTextColor="#999"
            />
          </View>
        )}

        {/* Address Search */}
        {searchMode === 'address' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>🏘️ {t('epiceries.addressOrZone')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('epiceries.addressPlaceholder')}
              value={searchAddress}
              onChangeText={setSearchAddress}
              placeholderTextColor="#999"
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={searchEpiceries}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>🔎 {t('epiceries.search')}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * UI optimiste: toggle local immédiat (cœur réactif), persist API en
   * arrière-plan, rollback si échec. Le tap d'un cœur a un retour visuel
   * sans latence — différenciateur UX majeur sur ce type d'interaction.
   */
  const handleToggleFavorite = async (epicerieId: number, isCurrentlyFavorite: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Snapshot pour rollback éventuel
    const snapshot = favoriteIds;
    const optimistic = isCurrentlyFavorite
      ? favoriteIds.filter(id => id !== epicerieId)
      : [...favoriteIds, epicerieId];
    setFavoriteIds(optimistic);

    try {
      const success = await favoritesService.toggleFavorite(epicerieId, isCurrentlyFavorite);
      if (!success) throw new Error('toggleFavorite returned false');
    } catch (error) {
      console.error('[EpiceriesScreen] Erreur toggle favori:', error);
      setFavoriteIds(snapshot); // rollback
      toast.error(t('common.error'), t('epiceries.favoritesError'));
    }
  };

  const renderEpicerie = ({ item }: { item: Epicerie }) => {
    const isFavorite = favoriteIds.includes(item.id);

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/(client)/(epicerie)/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            {/* Logo épicerie à gauche — tap pour agrandir, fallback emoji si pas de photo. */}
            <EpicerieLogo photoUrl={item.photoUrl} accessibilityLabel={item.nomEpicerie} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.nomEpicerie}</Text>
              <Text style={styles.cardAddress}>{item.adresse}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardMetaText}>⭐ 4.5</Text>
                <Text style={styles.cardMetaText}>📦 {item.nombreProducts} produits</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Favorite Heart Button */}
        <TouchableOpacity
          style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
          onPress={() => handleToggleFavorite(item.id, isFavorite)}
        >
          <Text style={styles.favoriteIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('epiceries.searchEpiceries')}</Text>
        <Text style={styles.headerSubtitle}>{t('epiceries.findIdealShop')}</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderSearchMode()}
        {renderSearchForm()}

        <View style={styles.resultsContainer}>
          {epiceries.length > 0 && (
            <Text style={styles.resultsTitle}>
              📋 {epiceries.length} {t('epiceries.epiceriesFound')}
            </Text>
          )}
          {epiceries.map((item) => (
            <View key={item.id}>
              {renderEpicerie({ item })}
            </View>
          ))}
          {loading && epiceries.length === 0 && (
            // Skeleton cards pendant la 1ère recherche/auto-search.
            // Avant: rien ne s'affichait → utilisateur restait dans le doute
            // pendant 1-3s pendant que la requête tournait.
            <>
              {[0, 1, 2].map(i => (
                <View key={i} style={styles.cardContainer}>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      {/* Skeleton logo aligné sur la position réelle du logo (à gauche, 64×64) */}
                      <Skeleton variant="rect" width={64} height={64} style={{ borderRadius: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Skeleton variant="text" width="65%" style={{ marginBottom: 8 }} />
                        <Skeleton variant="text" width="85%" style={{ marginBottom: 10 }} />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Skeleton variant="text" width={50} />
                          <Skeleton variant="text" width={80} />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
          {!loading && epiceries.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>{t('epiceries.noEpiceriesFound')}</Text>
              <Text style={styles.emptySubtext}>{t('epiceries.startSearchMessage')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
  searchModeContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 8,
    flexWrap: 'wrap',
  },
  modeButton: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  modeButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  searchForm: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationButton: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginTop: 10,
  },
  locationButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  locationButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  locationDisplay: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginBottom: 15,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  redetectButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  redetectButtonText: {
    fontSize: 20,
  },
  resultsContainer: {
    padding: 15,
    paddingTop: 0,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  cardContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  favoriteButtonActive: {
    backgroundColor: '#ffebee',
  },
  favoriteIcon: {
    fontSize: 28,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 15,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
