export { LivreurErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
  Vibration,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { DeliveryCard } from '../../src/components/livreur/DeliveryCard';
import { DailyStatsCard } from '../../src/components/livreur/DailyStatsCard';
import { AvailabilityToggle } from '../../src/components/livreur/AvailabilityToggle';
import { livreurService, DELIVERY_FAILURE_REASONS } from '../../src/services/livreurService';
import { useLivreurLocationTracking } from '../../src/hooks/useLivreurLocationTracking';
import { Delivery } from '../../src/type';
import {
  isAwaitingPickup,
  isDelivered,
  isInDelivery,
} from '../../src/utils/deliveryStatus';

export default function LivreurDeliveriesScreen() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  /** Verrou synchrone anti double-tap sur les changements de statut. */
  const processingRef = useRef(false);
  /** Commande en cours de traitement — pilote l'état visuel de SA card. */
  const [processingId, setProcessingId] = useState<number | null>(null);
  /** IDs connus — sert à détecter les NOUVELLES livraisons au refresh. */
  const knownDeliveryIdsRef = useRef<Set<number>>(new Set());
  // V116 — signalement d'échec de livraison
  const [failTarget, setFailTarget] = useState<Delivery | null>(null);
  const [failReason, setFailReason] = useState<string>(DELIVERY_FAILURE_REASONS[0].code);
  const [failNote, setFailNote] = useState('');
  const [failProcessing, setFailProcessing] = useState(false);

  // Tracking GPS continu tant que le livreur est EN LIGNE : position
  // poussée au serveur tous les 30 m / 15 s (throttling natif expo-location).
  // C'est cette position que le client voit sur son écran de suivi.
  useLivreurLocationTracking(isAvailable);

  /**
   * Acquisition de position best-effort (permission au premier besoin,
   * précision équilibrée = économie batterie). Avant ce correctif,
   * `userLocation` n'était JAMAIS assigné : le toggle "en ligne" envoyait
   * systématiquement undefined au serveur et le livreur restait invisible
   * sur la carte. Retourne null si refus/échec — jamais bloquant.
   */
  const acquireLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLocation(coords);
      return coords;
    } catch {
      return null;
    }
  }, []);

  // Charger les livraisons
  const loadDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await livreurService.getMyDeliveries();
      const list = data || [];

      // Signal sensoriel si une NOUVELLE livraison apparaît (diff d'IDs,
      // skip 1er chargement) : le téléphone est dans la poche du livreur,
      // le changement visuel de liste seul passait inaperçu.
      const currentIds = new Set(list.map(d => d.orderId));
      if (knownDeliveryIdsRef.current.size > 0) {
        const fresh = [...currentIds].some(id => !knownDeliveryIdsRef.current.has(id));
        if (fresh) {
          Vibration.vibrate([0, 300, 150, 300]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
      knownDeliveryIdsRef.current = currentIds;

      setDeliveries(list);
    } catch (error: any) {
      console.error('Erreur chargement livraisons:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger les livraisons');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les livraisons + position au montage
  useEffect(() => {
    loadDeliveries();
    acquireLocation();
  }, [loadDeliveries, acquireLocation]);

  // Rafraîchir quand l'écran est activé
  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  // Rafraîchissement manuel
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDeliveries();
    setIsRefreshing(false);
  };

  // Gérer la disponibilité. Le Switch est CONTRÔLÉ par `isAvailable`, mis à
  // jour seulement après confirmation serveur — en cas d'échec, il revient
  // naturellement à sa position (pas d'état optimiste fantôme).
  const handleAvailabilityToggle = async (value: boolean) => {
    try {
      setAvailabilityLoading(true);
      // Passage en ligne → position FRAÎCHE (sinon dernière connue) pour que
      // le serveur place le livreur correctement sur la carte.
      const coords = value ? ((await acquireLocation()) ?? userLocation) : userLocation;
      await livreurService.updateAvailability(value, coords?.latitude, coords?.longitude);
      setIsAvailable(value);
      // Le changement visuel du toggle EST le feedback — l'ancienne Alert
      // "Succès" exigeait un tap OK à chaque bascule. Haptic en renfort.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: any) {
      console.error('Erreur disponibilité:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la disponibilité');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  /**
   * Exécution protégée d'un changement de statut : verrou ref SYNCHRONE
   * (un 2e tap très rapide passe avant le re-render d'un simple state) +
   * `processingId` pour le feedback visuel de la card concernée.
   */
  const runStatusChange = async (orderId: number, action: () => Promise<Delivery>) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessingId(orderId);
    try {
      const result = await action();
      // Fusion (et non remplacement brut) : les endpoints start/complete du
      // backend ne renvoient pas forcément le DTO complet (champ `orderId`
      // parfois absent). On garde l'item existant comme base et on force
      // `orderId` — sinon la card se retrouve avec orderId=undefined et le
      // keyExtractor du FlatList crashe au render suivant (écran rouge).
      setDeliveries(prev =>
        prev.map(d =>
          d.orderId === orderId
            ? { ...d, ...(result ?? {}), orderId: result?.orderId ?? d.orderId }
            : d
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la livraison');
    } finally {
      processingRef.current = false;
      setProcessingId(null);
    }
  };

  // Démarrer une livraison à domicile (READY → IN_DELIVERY)
  const handleStartDelivery = (orderId: number) =>
    runStatusChange(orderId, () => livreurService.startDelivery(orderId));

  /**
   * Compléter une commande. Le backend expose deux endpoints distincts :
   * - PICKUP        → /livreurs/pickup/{id}/complete   (READY → DELIVERED)
   * - HOME_DELIVERY → /livreurs/delivery/{id}/complete (IN_DELIVERY → DELIVERED)
   * Appeler le mauvais endpoint est rejeté par le serveur.
   */
  const handleCompleteDelivery = (orderId: number) => {
    const delivery = deliveries.find(d => d.orderId === orderId);
    const isPickupOrder = delivery?.deliveryType === 'PICKUP';

    // V114 — Commande espèces non encore payée : le livreur DOIT confirmer
    // explicitement l'encaissement avant de clôturer. Le backend rejette la
    // clôture sans ce flag.
    const cashToCollect =
      delivery?.paymentMethod === 'CASH' && delivery?.paymentStatus !== 'PAID';
    const amount = `${(delivery?.total ?? 0).toFixed(2)} DH`;

    const complete = () =>
      runStatusChange(orderId, () =>
        isPickupOrder
          ? livreurService.completePickup(orderId, cashToCollect || undefined)
          : livreurService.completeDelivery(orderId, cashToCollect || undefined)
      );

    if (cashToCollect) {
      Alert.alert(
        '💵 Encaissement espèces',
        `Confirmez-vous avoir reçu ${amount} en espèces ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Oui, encaissé', onPress: complete },
        ]
      );
      return;
    }

    Alert.alert(
      'Confirmation',
      isPickupOrder
        ? 'Confirmer la remise de la commande au client (retrait en épicerie) ?'
        : 'Êtes-vous sûr de vouloir marquer cette livraison comme complétée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: isPickupOrder ? 'Remettre' : 'Compléter',
          onPress: complete,
        },
      ]
    );
  };

  // V116 — Signaler un problème de livraison (ouvre la modale motif + note)
  const handleReportProblem = (orderId: number) => {
    const delivery = deliveries.find(d => d.orderId === orderId);
    if (!delivery) return;
    setFailReason(DELIVERY_FAILURE_REASONS[0].code);
    setFailNote('');
    setFailTarget(delivery);
  };

  const confirmReportProblem = async () => {
    if (!failTarget || failProcessing) return;
    const orderId = failTarget.orderId;
    try {
      setFailProcessing(true);
      await livreurService.reportDeliveryFailure(
        orderId,
        failReason,
        failNote.trim() || undefined,
        userLocation?.latitude,
        userLocation?.longitude
      );
      // La commande est détachée du livreur → la retirer de sa liste.
      setDeliveries(prev => prev.filter(d => d.orderId !== orderId));
      setFailTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Problème signalé', "L'épicerie a été prévenue et va réassigner la commande.");
    } catch (error: any) {
      Alert.alert('Erreur', typeof error === 'string' ? error : error?.message || 'Action impossible');
    } finally {
      setFailProcessing(false);
    }
  };

  // Calculer les statistiques (statuts normalisés : le backend renvoie
  // DELIVERED/IN_DELIVERY/READY..., pas 'completed'/'in_progress')
  const stats = {
    completed: deliveries.filter(d => isDelivered(d.status)).length,
    inProgress: deliveries.filter(d => isInDelivery(d.status)).length,
    pending: deliveries.filter(d => isAwaitingPickup(d.status)).length,
    totalAmount: deliveries.reduce((sum, d) => sum + d.total, 0),
  };

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <DeliveryCard
      delivery={item}
      onPress={() => {
        /* Naviguer vers détail si besoin */
      }}
      onStartPress={() => handleStartDelivery(item.orderId)}
      onCompletePress={() => handleCompleteDelivery(item.orderId)}
      onReportProblem={() => handleReportProblem(item.orderId)}
      isLoading={processingId === item.orderId}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎉</Text>
      <Text style={styles.emptyTitle}>Aucune livraison</Text>
      <Text style={styles.emptySubtitle}>
        Vous n'avez pas de livraisons en attente pour le moment
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Chargement des livraisons...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bouton scanner QR flottant */}
      <TouchableOpacity
        style={styles.scanFab}
        onPress={() => router.push('/(livreur)/scan-qr')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Scanner le QR code d'un client"
      >
        <MaterialCommunityIcons name="qrcode-scan" size={26} color="#fff" />
      </TouchableOpacity>

      <FlatList
        data={deliveries}
        renderItem={renderDelivery}
        keyExtractor={(item, index) =>
          item?.orderId != null ? item.orderId.toString() : `delivery-${index}`
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#9C27B0']}
          />
        }
        ListHeaderComponent={
          <>
            <AvailabilityToggle
              isAvailable={isAvailable}
              onToggle={handleAvailabilityToggle}
              isLoading={availabilityLoading}
              location={userLocation}
            />
            <DailyStatsCard
              completed={stats.completed}
              inProgress={stats.inProgress}
              pending={stats.pending}
              totalAmount={stats.totalAmount}
            />
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
      />

      {/* V116 — Signaler un problème de livraison */}
      <Modal
        visible={!!failTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setFailTarget(null)}
      >
        <View style={styles.failOverlay}>
          <View style={styles.failSheet}>
            <Text style={styles.failTitle}>Signaler un problème</Text>
            <Text style={styles.failSubtitle}>
              Commande #{failTarget?.orderId} — {failTarget?.clientNom ?? ''}
            </Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {DELIVERY_FAILURE_REASONS.map(r => {
                const selected = failReason === r.code;
                return (
                  <TouchableOpacity
                    key={r.code}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                    onPress={() => setFailReason(r.code)}
                    disabled={failProcessing}
                  >
                    <MaterialCommunityIcons
                      name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={selected ? '#E65100' : '#999'}
                    />
                    <Text style={styles.reasonLabel}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={styles.failNoteInput}
              placeholder="Précision (optionnel)"
              placeholderTextColor="#999"
              value={failNote}
              onChangeText={setFailNote}
              multiline
              maxLength={500}
              editable={!failProcessing}
            />

            <View style={styles.failActions}>
              <TouchableOpacity
                style={styles.failCancelBtn}
                onPress={() => setFailTarget(null)}
                disabled={failProcessing}
              >
                <Text style={styles.failCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.failConfirmBtn, failProcessing && { opacity: 0.6 }]}
                onPress={confirmReportProblem}
                disabled={failProcessing}
              >
                {failProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.failConfirmText}>Signaler l'échec</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  failOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  failSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  failTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  failSubtitle: { fontSize: 13, color: '#666', marginTop: 2, marginBottom: 12 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  reasonRowSelected: { backgroundColor: '#FFF3E0' },
  reasonLabel: { fontSize: 15, color: '#333' },
  failNoteInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    minHeight: 60,
    marginTop: 10,
    color: '#333',
    textAlignVertical: 'top',
  },
  failActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  failCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
  },
  failCancelText: { color: '#333', fontWeight: '600' },
  failConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#E65100',
  },
  failConfirmText: { color: '#fff', fontWeight: '700' },
  scanFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});