/**
 * BundleOfferCarousel — Carousel horizontal de bundles pour les clients.
 *
 * Deux modes :
 *   - mode="epicerie" + epicerieId : liste les bundles disponibles de cette
 *     boutique (carousel "Offres" sur page epicerie)
 *   - mode="featured" : liste les bundles featured cross-epicerie (home client)
 *
 * Comportements :
 *   - Auto-masque si la liste est vide (pas de "Aucune offre" qui pollue l'UI)
 *   - Cards horizontales tappables, ouvrent l'ecran detail
 *   - Affiche savings badge + prix + nom epicerie (mode featured)
 *
 * Reutilise les memes patterns visuels que les autres cards client de l'app
 * (border-radius 14, shadow legere) pour rester coherent.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import bundleOfferService, { BundleOffer } from '../../services/bundleOfferService';

type Mode = 'epicerie' | 'featured';

interface Props {
  mode: Mode;
  /** Requis si mode="epicerie". Ignore si mode="featured". */
  epicerieId?: number;
  /** Limite pour mode featured. */
  limit?: number;
  /** Titre custom. Defaut : "🎁 Offres & paniers" / "🎁 Offres à la une". */
  title?: string;
  /** Couleur d'accent pour le titre / chips (defaut vert client). */
  accent?: string;
  /** Hauteur de la card (controle implicite de la taille). */
  cardWidth?: number;
}

const DEFAULT_ACCENT = '#4CAF50';

export const BundleOfferCarousel: React.FC<Props> = ({
  mode,
  epicerieId,
  limit = 8,
  title,
  accent = DEFAULT_ACCENT,
  cardWidth = 220,
}) => {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = mode === 'epicerie'
          ? (epicerieId ? await bundleOfferService.listAvailableForEpicerie(epicerieId) : [])
          : await bundleOfferService.listFeatured(limit);
        if (!cancelled) setBundles(data);
      } catch (err) {
        // Pas d'Alert — l'absence de bundles ne doit jamais bloquer la page.
        // L'utilisateur verra simplement le carousel disparaitre.
        if (!cancelled) setBundles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode, epicerieId, limit]);

  // Auto-masque pendant le loading initial pour eviter le flash.
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={accent} />
      </View>
    );
  }

  // Auto-masque si la liste est vide.
  if (bundles.length === 0) return null;

  const headerTitle = title
    ?? (mode === 'epicerie' ? '🎁 Offres & paniers' : '🎁 Offres à la une');

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: accent }]}>{headerTitle}</Text>
        <Text style={styles.count}>{bundles.length}</Text>
      </View>

      <FlatList
        data={bundles}
        keyExtractor={(b) => String(b.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <BundleCard
            bundle={item}
            cardWidth={cardWidth}
            showEpicerieName={mode === 'featured'}
            onPress={() => router.push({
              pathname: '/(client)/bundle/[id]',
              params: { id: String(item.id) },
            } as any)}
          />
        )}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────

interface BundleCardProps {
  bundle: BundleOffer;
  cardWidth: number;
  showEpicerieName: boolean;
  onPress: () => void;
}

const BundleCard: React.FC<BundleCardProps> = ({ bundle, cardWidth, showEpicerieName, onPress }) => {
  const savings = bundle.computedSavings ?? 0;
  const savingsPct = bundle.savingsPercent ?? 0;
  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.coverWrap}>
        {bundle.photoUrl ? (
          <Image source={{ uri: bundle.photoUrl }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <MaterialCommunityIcons name="gift-outline" size={36} color="#BDBDBD" />
          </View>
        )}
        {savings > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>−{Math.round(savingsPct)}%</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{bundle.name}</Text>
        {showEpicerieName && bundle.epicerieName ? (
          <View style={styles.shopRow}>
            <Ionicons name="storefront-outline" size={11} color="#888" />
            <Text style={styles.shopName} numberOfLines={1}>{bundle.epicerieName}</Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {bundle.price?.toFixed(2)} {bundle.currencyCode}
          </Text>
          {bundle.items?.length ? (
            <Text style={styles.itemsCount}>· {bundle.items.length} prod.</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12, marginBottom: 8 },
  loadingWrap: { paddingVertical: 16, alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  count: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#9E9E9E',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 22,
    textAlign: 'center',
    fontWeight: '700',
    overflow: 'hidden',
  },
  list: { paddingHorizontal: 12, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  coverWrap: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#ECEFF1' },
  cover: { width: '100%', height: '100%' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  savingsBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#E53935',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  savingsText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  body: { padding: 10, gap: 4 },
  name: { fontSize: 14, fontWeight: '700', color: '#212121' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopName: { fontSize: 11, color: '#888', flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  price: { fontSize: 16, fontWeight: '800', color: '#388E3C' },
  itemsCount: { fontSize: 11, color: '#999' },
});

export default BundleOfferCarousel;
