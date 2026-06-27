export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
/**
 * Liste des bundles / offres groupees pour l'epicier connecte.
 *
 * Cards verticales avec :
 *  - Photo de couverture (ou placeholder)
 *  - Nom + description courte
 *  - Prix bundle + savings ("Economisez 25 DH")
 *  - Statut chip (Brouillon / Active / Inactive)
 *  - Indicateur dispo (max quantite vendable)
 *
 * FAB en bas a droite pour creer un nouveau bundle.
 *
 * Tap sur card -> `offre-detail` avec id en param.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import bundleOfferService, {
  BundleOffer,
  BundleOfferStatus,
} from '../../src/services/bundleOfferService';

const BLUE = Colors.primary;
const GREEN = '#388E3C';
const ORANGE = '#F57C00';
const GREY = '#9E9E9E';

const STATUS_CONFIG: Record<BundleOfferStatus, { label: string; color: string; bg: string }> = {
  DRAFT:    { label: 'Brouillon', color: '#616161', bg: '#EEEEEE' },
  ACTIVE:   { label: 'Active',    color: '#2E7D32', bg: '#E8F5E9' },
  INACTIVE: { label: 'En pause',  color: '#E65100', bg: '#FFF3E0' },
};

export default function OffresPaniersScreen() {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await bundleOfferService.listMyStore();
      setBundles(data);
    } catch (err: any) {
      // 402 (subscription gating) est intercepte par l'interceptor api.ts qui
      // affiche deja un Alert + redirect mon-abonnement. On ne re-affiche
      // pas ici pour eviter le double Alert.
      if (!err?.__subscriptionGateHandled) {
        const msg = err?.response?.data?.message || err?.message || 'Chargement impossible';
        Alert.alert('Erreur', msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // useFocusEffect : recharge au retour du detail (apres save/delete).
  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleCreate = () => {
    router.push('/(epicier)/offre-detail');
  };

  const handleOpen = (id: number) => {
    router.push({ pathname: '/(epicier)/offre-detail', params: { id: String(id) } });
  };

  const renderItem = ({ item }: { item: BundleOffer }) => {
    const status = STATUS_CONFIG[item.status];
    const itemsCount = item.items?.length ?? 0;
    const savings = item.computedSavings ?? 0;
    const savingsPct = item.savingsPercent ?? 0;
    const maxQty = item.maxAvailableQuantity ?? 0;
    return (
      <TouchableOpacity style={styles.card} onPress={() => handleOpen(item.id)} activeOpacity={0.7}>
        {/* Photo de couverture */}
        <View style={styles.cover}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.coverImg} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImg, styles.coverFallback]}>
              <MaterialCommunityIcons name="gift-outline" size={36} color="#BDBDBD" />
            </View>
          )}
          {item.isFeatured && (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={11} color="#fff" />
              <Text style={styles.featuredText}>Mise en avant</Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="basket-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{itemsCount} produit{itemsCount > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="package-variant-closed" size={14} color={maxQty > 0 ? '#666' : '#C62828'} />
              <Text style={[styles.metaText, maxQty <= 0 && { color: '#C62828' }]}>
                {maxQty > 0 ? `${maxQty} dispo` : 'Rupture'}
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {item.price?.toFixed(2)} {item.currencyCode}
            </Text>
            {savings > 0 && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>
                  −{savings.toFixed(2)} {item.currencyCode}
                  {savingsPct ? ` (-${Math.round(savingsPct)}%)` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onCreate={handleCreate} canCreate={false} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onCreate={handleCreate} canCreate />

      <FlatList
        data={bundles}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={bundles.length === 0 ? styles.emptyList : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BLUE]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="gift-outline" size={64} color="#CFD8DC" />
            <Text style={styles.emptyTitle}>Aucune offre pour le moment</Text>
            <Text style={styles.emptyHint}>
              Creez votre 1er panier groupe — ex : "Panier Ramadan" ou "Pack petit-dejeuner".
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={handleCreate}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Creer une offre</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB visible uniquement si la liste n'est pas vide (sinon on a deja
          le gros bouton dans l'empty state). */}
      {bundles.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────

interface HeaderProps {
  onCreate: () => void;
  canCreate: boolean;
}

const Header: React.FC<HeaderProps> = ({ onCreate, canCreate }) => {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Offres & paniers</Text>
      {canCreate ? (
        <TouchableOpacity onPress={onCreate} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 26 }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BLUE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BLUE,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  list: { padding: 12, paddingBottom: 80 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  empty: { alignItems: 'center', gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#37474F' },
  emptyHint: { fontSize: 14, color: '#78909C', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    backgroundColor: BLUE,
    borderRadius: 24,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cover: { width: '100%', height: 140, backgroundColor: '#ECEFF1' },
  coverImg: { width: '100%', height: '100%' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  featuredText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  body: { padding: 12, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#212121' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  description: { fontSize: 13, color: '#616161', lineHeight: 18 },

  metaRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#666' },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  price: { fontSize: 18, fontWeight: '800', color: GREEN },
  savingsBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  savingsText: { color: '#C62828', fontSize: 12, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
