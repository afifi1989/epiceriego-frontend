export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
// ============================================
// app/(epicier)/dashboard.tsx
// Dashboard complet pour l'épicier
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Skeleton } from '../../src/components/feedback';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePermissions } from '../../src/hooks/usePermissions';
import { STORAGE_KEYS } from '../../src/constants/config';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService } from '../../src/services/orderService';
import { offlineService } from '../../src/services/offline';
import { useNetwork } from '../../src/context/NetworkContext';
import { Epicerie, LoginResponse, Order, Product } from '../../src/type';
import { onboardingService } from '../../src/services/onboardingService';
import { productService } from '../../src/services/productService';
import { formatPrice, getStatusColor, getStatusLabel } from '../../src/utils/helpers';
import { useCurrency } from '../../src/context/CurrencyContext';
import { DashboardPromoWidget } from '../../src/features/promotions/components';
import { DashboardPromoCodesWidget } from '../../src/components/epicier/DashboardPromoCodesWidget';
import { DashboardStockWidget } from '../../src/components/epicier/DashboardStockWidget';

export default function EpicierDashboardScreen() {
  const router = useRouter();
  // Devise propagée par le layout épicier au login
  const { currency } = useCurrency();

  // États
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    productsCount: 0,
  });
  // Produits importés/brouillon sans stock → rappel « à approvisionner ».
  const [draftToStockCount, setDraftToStockCount] = useState(0);
  const { can } = usePermissions(loginData);
  const { isOnline } = useNetwork();
  // Modale "Plus d'actions" : regroupe les raccourcis secondaires pour ne
  // pas saturer le dashboard. La grille principale ne montre que les 6
  // actions les plus utilisees.
  const [showMoreActions, setShowMoreActions] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (raw) {
          const user = JSON.parse(raw);
          setLoginData(user);

          // Vérifier si l'onboarding est terminé (seulement si online et première visite)
          if (user.epicerieId) {
            try {
              const status = await onboardingService.getStatus(user.epicerieId);
              if (!status.completed) {
                // Libérer le spinner avant la redirection : si la nav échoue
                // ou prend du temps, on n'est pas bloqué sur "Chargement…".
                setLoading(false);
                router.replace('/(epicier)/onboarding');
                return;
              }
            } catch {
              // Si offline ou erreur, ne pas bloquer l'accès au dashboard
            }
          }
        }
        loadDashboardData();
      } catch (err) {
        console.error('[Dashboard] init failed:', err);
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Charge toutes les données du dashboard (avec cache offline)
   */
  const loadDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);

      // Charger les infos de l'épicerie (cache 30 min, dispo offline)
      const epicerieData = await offlineService.fetchWithCache<Epicerie>({
        namespace: 'epicerie',
        key: 'my-epicerie',
        fetcher: () => epicerieService.getMyEpicerie(),
      });
      if (epicerieData) setEpicerie(epicerieData);

      // Comptage des produits brouillon sans stock (rappel d'approvisionnement).
      // Non bloquant : best-effort, réutilise le cache produits de l'écran Produits.
      if (epicerieData) {
        try {
          const prods = await offlineService.fetchWithCache<Product[]>({
            namespace: 'products',
            key: `epicerie_${epicerieData.id}`,
            fetcher: () => productService.getProductsByEpicerie(epicerieData.id, false, true),
          });
          if (prods) {
            const stockOf = (p: Product) =>
              (p.units && p.units.length) ? p.units.reduce((s, u) => s + (u.stock ?? 0), 0) : (p.stock ?? 0);
            setDraftToStockCount(prods.filter(p => !p.isAvailable && stockOf(p) === 0).length);
          }
        } catch { /* non bloquant */ }
      }

      // Charger les commandes (cache 5 min, dispo offline)
      const ordersData = await offlineService.fetchWithCache<Order[]>({
        namespace: 'orders',
        key: 'epicerie-orders',
        fetcher: () => orderService.getEpicerieOrders(),
      });
      if (ordersData) {
        setOrders(ordersData);

        // Calculer les statistiques
        const pendingCount = ordersData.filter(o => o.status === 'PENDING').length;
        const todayOrders = ordersData.filter(o => {
          const orderDate = new Date(o.createdAt);
          const today = new Date();
          return orderDate.toDateString() === today.toDateString();
        });
        const todayRev = todayOrders.reduce((sum, o) => sum + o.total, 0);

        setStats({
          totalOrders: ordersData.length,
          pendingOrders: pendingCount,
          todayRevenue: todayRev,
          productsCount: epicerieData?.nombreProducts ?? 0,
        });
      }

    } catch (error) {
      // Seulement alerter si on est online (offline = données du cache)
      if (offlineService.isOnline()) {
        Alert.alert('Erreur', 'Impossible de charger les données');
      }
      console.error('Erreur dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Rafraîchir les données
   */
  const onRefresh = (): void => {
    setRefreshing(true);
    loadDashboardData();
  };

  /**
   * Accepter une commande
   */
  const handleAcceptOrder = async (orderId: number): Promise<void> => {
    try {
      await orderService.updateOrderStatus(orderId, 'ACCEPTED');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('✅', 'Commande acceptée !');
      loadDashboardData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'accepter la commande');
    }
  };

  /**
   * Refuser une commande
   */
  const handleRejectOrder = async (orderId: number): Promise<void> => {
    Alert.alert(
      'Refuser la commande',
      'Êtes-vous sûr de vouloir refuser cette commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await orderService.updateOrderStatus(orderId, 'CANCELLED');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              Alert.alert('✅', 'Commande refusée');
              loadDashboardData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de refuser la commande');
            }
          },
        },
      ]
    );
  };

  /**
   * Tuile de raccourci — style épuré : carte blanche, accent couleur à
   * gauche + pastille d'icône teintée. Remplace les cartes KPI : l'accueil
   * mène désormais avec les actions, pas les chiffres.
   */
  const Tile = ({
    emoji,
    label,
    accent,
    onPress,
    highlight = false,
  }: {
    emoji: string;
    label: string;
    accent: string;
    onPress: () => void;
    highlight?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.tile, { borderLeftColor: accent }, highlight && styles.tileHighlight]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.tileIconWrap, { backgroundColor: accent + '1A' }]}>
        <Text style={styles.tileEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );

  /**
   * Écran de chargement
   */
  if (loading) {
    // Skeleton qui imite la page (KPIs 2×2 + section commandes) plutôt qu'un
    // spinner nu : perception de vitesse, pas de flash de layout au chargement.
    return (
      <View style={[styles.container, { padding: 15 }]}>
        <Skeleton variant="text" width="55%" height={22} style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Skeleton variant="rect" height={80} style={{ flex: 1, borderRadius: 12 }} />
          <Skeleton variant="rect" height={80} style={{ flex: 1, borderRadius: 12 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <Skeleton variant="rect" height={80} style={{ flex: 1, borderRadius: 12 }} />
          <Skeleton variant="rect" height={80} style={{ flex: 1, borderRadius: 12 }} />
        </View>
        <Skeleton variant="text" width="45%" height={18} style={{ marginBottom: 10 }} />
        {[0, 1].map(i => (
          <Skeleton key={i} variant="rect" height={120} style={{ borderRadius: 12, marginBottom: 10 }} />
        ))}
      </View>
    );
  }

  /**
   * Rendu principal
   */
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* En-tête avec infos épicerie */}
      {epicerie && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{epicerie.nomEpicerie}</Text>
          <Text style={styles.headerSubtitle}>{epicerie.adresse}</Text>
        </View>
      )}

      {/* Rappel : produits importés à approvisionner (auto-masqué si 0). */}
      {draftToStockCount > 0 && (
        <TouchableOpacity
          style={dashStockBanner.bar}
          onPress={() => router.push('/(epicier)/finaliser-catalogue')}
          activeOpacity={0.85}
        >
          <Text style={dashStockBanner.icon}>📥</Text>
          <View style={{ flex: 1 }}>
            <Text style={dashStockBanner.title}>
              {draftToStockCount} produit{draftToStockCount > 1 ? 's' : ''} à approvisionner
            </Text>
            <Text style={dashStockBanner.subtitle}>Réglez leur stock pour finaliser votre catalogue</Text>
          </View>
          <Text style={dashStockBanner.arrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Hub de raccourcis — accueil moderne (tuiles épurées + accent couleur).
          Remplace les anciennes cartes KPI : la page d'accueil mène désormais
          avec les actions directes ; les chiffres vivent sur la page
          Statistiques dédiée (lien stylé juste en dessous). */}
      <View style={styles.hub}>
        <Text style={styles.sectionTitle}>Raccourcis</Text>
        <View style={styles.tilesGrid}>
          {/* Vente directe — action #1 du quotidien, mise en avant */}
          <Tile
            emoji="🛒"
            label="Vente directe"
            accent="#16A34A"
            highlight
            onPress={() => router.push('/(epicier)/vente-directe')}
          />
          <Tile
            emoji="📦"
            label="Produits"
            accent="#2563EB"
            onPress={() => router.push('/(epicier)/produits')}
          />
          {can('stock:adjust') && (
            <Tile
              emoji="🏷️"
              label="Approvisionner"
              accent="#F59E0B"
              onPress={() => router.push('/(epicier)/approvisionnement')}
            />
          )}
          {can('promotions:manage') && (
            <Tile
              emoji="🎉"
              label="Promotions"
              accent="#EC4899"
              onPress={() => router.push('/(epicier)/promotions')}
            />
          )}
          {can('settings:edit') && (
            <Tile
              emoji="💰"
              label="Caisse"
              accent="#0D9488"
              onPress={() => router.push('/(epicier)/cash-session' as any)}
            />
          )}
          {/* Offres & paniers — pas de garde permission (découverte) */}
          <Tile
            emoji="🎁"
            label="Offres & paniers"
            accent="#9333EA"
            onPress={() => router.push('/(epicier)/offres-paniers')}
          />
          {/* Plus — ouvre la modale avec les raccourcis secondaires */}
          <Tile
            emoji="⋯"
            label="Plus"
            accent="#94A3B8"
            onPress={() => setShowMoreActions(true)}
          />
        </View>
      </View>

      {/* Lien stylé vers la page Statistiques — les chiffres détaillés
          (CA, top produits, clients, périodes) vivent là-bas. */}
      {can('stats:view') && (
        <TouchableOpacity
          style={styles.statsLink}
          onPress={() => router.push('/(epicier)/statistiques')}
          activeOpacity={0.85}
        >
          <View style={styles.statsLinkIcon}>
            <Text style={{ fontSize: 22 }}>📊</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statsLinkTitle}>Statistiques</Text>
            <Text style={styles.statsLinkSub}>
              Chiffre d'affaires, top produits, clients…
            </Text>
          </View>
          <Text style={styles.statsLinkArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Commandes en attente — REMONTÉES en tête (audit UX) : c'est l'action
          n°1 de l'épicier, elle exigeait ~900px de scroll sous les widgets et
          les 8 quick actions. Position fixe et prévisible ; à 0 commande, le
          petit état "✅ Aucune commande en attente" sert de signal tout-va-bien. */}
      <View style={styles.ordersSection}>
        <Text style={styles.sectionTitle}>
          Commandes en Attente ({stats.pendingOrders})
        </Text>

        {orders
          .filter(order => order.status === 'PENDING')
          .map(order => (
            <View key={order.id} style={styles.orderCard}>
              {/* En-tête commande */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderClient}>👤 {order.clientNom}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.orderTotalContainer}>
                  <Text style={styles.orderTotal}>{formatPrice(order.total, order.currency || currency)}</Text>
                  <Text style={styles.orderItems}>{order.nombreItems} articles</Text>
                </View>
              </View>

              {/* Adresse */}
              <View style={styles.orderAddress}>
                <Text style={styles.orderAddressIcon}>📍</Text>
                <Text style={styles.orderAddressText}>{order.adresseLivraison}</Text>
              </View>

              {/* Téléphone */}
              {order.telephoneLivraison && (
                <View style={styles.orderPhone}>
                  <Text style={styles.orderPhoneIcon}>📞</Text>
                  <Text style={styles.orderPhoneText}>{order.telephoneLivraison}</Text>
                </View>
              )}

              {/* Boutons d'action */}
              <View style={styles.orderActions}>
                <TouchableOpacity
                  style={[styles.orderButton, styles.acceptButton]}
                  onPress={() => handleAcceptOrder(order.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Accepter la commande de ${order.clientNom}, ${formatPrice(order.total, order.currency || currency)}`}
                >
                  <Text style={styles.orderButtonText}>✅ Accepter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.orderButton, styles.rejectButton]}
                  onPress={() => handleRejectOrder(order.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Refuser la commande de ${order.clientNom}`}
                >
                  <Text style={styles.orderButtonText}>❌ Refuser</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

        {stats.pendingOrders === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyText}>Aucune commande en attente</Text>
          </View>
        )}
      </View>

      {/* Widget Stock — alertes a reapprovisionner (auto-masque si stock OK). */}
      <DashboardStockWidget />

      {/* Widget Promotions (V70+) — necessite promotions:manage cote backend */}
      {can('promotions:manage') && <DashboardPromoWidget />}

      {/* V95 Phase 6 — Widget Codes promos (économies offertes 30j) */}
      {can('stats:view') && <DashboardPromoCodesWidget />}

      {/* Commandes récentes */}
      <View style={styles.ordersSection}>
        <Text style={styles.sectionTitle}>Commandes Récentes</Text>

        {orders
          .filter(order => order.status !== 'PENDING')
          .slice(0, 5)
          .map(order => (
            <View key={order.id} style={styles.recentOrderCard}>
              <View style={styles.recentOrderHeader}>
                <Text style={styles.recentOrderClient}>{order.clientNom}</Text>
                <View 
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(order.status) }
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(order.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.recentOrderFooter}>
                <Text style={styles.recentOrderTotal}>
                  {formatPrice(order.total, order.currency || currency)}
                </Text>
                <Text style={styles.recentOrderDate}>
                  {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </View>
          ))}

        {orders.filter(o => o.status !== 'PENDING').length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande récente</Text>
          </View>
        )}
      </View>

      {/* Modale "Plus d'actions" : grille secondaire avec les raccourcis
          peu frequents. Chaque entree est conditionnee par sa permission. */}
      <Modal
        visible={showMoreActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMoreActions(false)}
      >
        <Pressable style={moreStyles.overlay} onPress={() => setShowMoreActions(false)}>
          <Pressable style={moreStyles.sheet} onPress={e => e.stopPropagation()}>
            <View style={moreStyles.handle} />
            <Text style={moreStyles.title}>Plus d'actions</Text>
            <View style={moreStyles.grid}>
              {can('livreurs:manage') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/livreurs'); }}
                >
                  <Text style={moreStyles.emoji}>🚚</Text>
                  <Text style={moreStyles.label}>Livreurs</Text>
                </TouchableOpacity>
              )}
              {can('settings:edit') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/parametres' as any); }}
                >
                  <Text style={moreStyles.emoji}>⚙️</Text>
                  <Text style={moreStyles.label}>Paramètres</Text>
                </TouchableOpacity>
              )}
              {can('promoCodes:manage') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/codes-promos' as any); }}
                >
                  <Text style={moreStyles.emoji}>🎟️</Text>
                  <Text style={moreStyles.label}>Codes promos</Text>
                </TouchableOpacity>
              )}
              {can('suppliers:manage') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/fournisseurs' as any); }}
                >
                  <Text style={moreStyles.emoji}>🏪</Text>
                  <Text style={moreStyles.label}>Fournisseurs</Text>
                </TouchableOpacity>
              )}
              {can('stock:view') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/stock-alerts' as any); }}
                >
                  <Text style={moreStyles.emoji}>🚨</Text>
                  <Text style={moreStyles.label}>Alertes stock</Text>
                </TouchableOpacity>
              )}
              {can('stock:adjust') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/inventaire' as any); }}
                >
                  <Text style={moreStyles.emoji}>📋</Text>
                  <Text style={moreStyles.label}>Inventaire</Text>
                </TouchableOpacity>
              )}
              {can('settings:edit') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/printer-settings' as any); }}
                >
                  <Text style={moreStyles.emoji}>🖨️</Text>
                  <Text style={moreStyles.label}>Imprimante</Text>
                </TouchableOpacity>
              )}
              {can('settings:edit') && (
                <TouchableOpacity
                  style={moreStyles.item}
                  onPress={() => { setShowMoreActions(false); router.push('/(epicier)/fidelite' as any); }}
                >
                  <Text style={moreStyles.emoji}>⭐</Text>
                  <Text style={moreStyles.label}>Fidélité</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={moreStyles.closeBtn} onPress={() => setShowMoreActions(false)}>
              <Text style={moreStyles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const moreStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 14,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  item: {
    width: '30%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  emoji: { fontSize: 26, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  closeBtn: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  closeText: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

/**
 * Styles
 */
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: Colors.primary,
    padding: 20,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 50,
    marginBottom: 10,
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
  statsContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBlue: {
    backgroundColor: '#E3F2FD',
  },
  statOrange: {
    backgroundColor: '#FFF3E0',
  },
  statGreen: {
    backgroundColor: '#E8F5E9',
  },
  statPurple: {
    backgroundColor: '#F3E5F5',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
  },
  quickActions: {
    padding: 15,
  },
  // ── Hub de raccourcis (tuiles épurées + accent couleur) ──
  hub: {
    padding: 15,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  tileHighlight: {
    borderLeftWidth: 5,
    backgroundColor: '#F6FFF8',
  },
  tileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileEmoji: {
    fontSize: 24,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  // ── Lien stylé vers les statistiques ──
  statsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 5,
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#9333EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  statsLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#9333EA1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLinkTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  statsLinkSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statsLinkArrow: {
    fontSize: 22,
    color: '#9333EA',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonHighlight: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  actionButtonMore: {
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#e0e6ed',
    borderStyle: 'dashed',
  },
  actionEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ordersSection: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  orderClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  orderDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  orderTotalContainer: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 2,
  },
  orderItems: {
    fontSize: 13,
    color: '#6b7280',
  },
  orderAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  orderAddressIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  orderAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  orderPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  orderPhoneIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  orderPhoneText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  orderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  orderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  orderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recentOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentOrderClient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  recentOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentOrderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  recentOrderDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

const dashStockBanner = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    marginHorizontal: 15,
    marginBottom: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '800', color: '#78350F' },
  subtitle: { fontSize: 12, color: '#92400E', marginTop: 2 },
  arrow: { fontSize: 20, color: '#B45309', fontWeight: '700' },
});
