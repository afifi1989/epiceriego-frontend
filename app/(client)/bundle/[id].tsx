/**
 * Detail d'un bundle / panier groupe cote client.
 *
 * Affichage :
 *   - Photo de couverture en hero
 *   - Nom + nom epicerie + description
 *   - Liste des produits inclus avec quantite + prix unitaire
 *   - Recap prix : "X items × Y DH = Z DH" rayé + prix bundle en gros
 *   - Savings badge ("Vous economisez X DH (-Y%)")
 *   - CTA "Ajouter au panier" en sticky bottom
 *
 * Statut du CTA :
 *   - P3 (actuelle) : Alert "Disponible bientôt — intégration commande en cours"
 *   - P4 : convertira en ajout au cart effectif via cartService
 *
 * Le backend renvoie 404 si le bundle n'est plus ACTIVE ou hors validity
 * window — on affiche un ecran d'erreur clair plutot qu'une page vide.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import bundleOfferService, { BundleOffer } from '../../../src/services/bundleOfferService';
import { cartService, CartBundle, CartBundleItem } from '../../../src/services/cartService';

const GREEN = '#4CAF50';
const DARK_GREEN = '#388E3C';
const RED = '#E53935';

export default function BundleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseInt(params.id ?? '0', 10);

  const [bundle, setBundle] = useState<BundleOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('Identifiant de bundle invalide.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await bundleOfferService.getPublic(id);
        if (!cancelled) setBundle(data);
      } catch (err: any) {
        if (!cancelled) {
          const status = err?.response?.status;
          if (status === 404) {
            setError('Cette offre n\'est plus disponible.');
          } else {
            setError(err?.response?.data?.message || err?.message || 'Chargement impossible');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleAddToCart = async () => {
    if (!bundle) return;
    const cartBundle: CartBundle = {
      bundleOfferId: bundle.id,
      epicerieId: bundle.epicerieId,
      epicerieName: bundle.epicerieName,
      snapshotName: bundle.name,
      snapshotPrice: bundle.price,
      currencyCode: bundle.currencyCode,
      photoUrl: bundle.photoUrl ?? null,
      items: (bundle.items ?? []).map<CartBundleItem>(it => ({
        productId: it.productId,
        productName: it.productName ?? '',
        productPhotoUrl: it.productPhotoUrl,
        productUnitId: it.productUnitId ?? null,
        unitLabel: it.unitLabel,
        quantity: it.quantity,
      })),
      quantity: 1,
    };
    try {
      await cartService.addBundle(cartBundle);
      Alert.alert(
        'Ajouté au panier',
        `${bundle.name} a été ajouté à votre panier.`,
        [
          { text: 'Continuer', style: 'cancel' },
          { text: 'Voir le panier', onPress: () => router.push('/(client)/cart') },
        ],
      );
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Ajout au panier impossible');
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Chargement…" />
        <View style={styles.center}><ActivityIndicator size="large" color={GREEN} /></View>
      </SafeAreaView>
    );
  }

  // ── Erreur / non dispo ──────────────────────────────────────────────
  if (error || !bundle) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Offre indisponible" />
        <View style={styles.center}>
          <MaterialCommunityIcons name="gift-off-outline" size={56} color="#BDBDBD" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Detail ───────────────────────────────────────────────────────────
  const savings = bundle.computedSavings ?? 0;
  const savingsPct = bundle.savingsPercent ?? 0;
  const sumItems = (bundle.items ?? []).reduce(
    (acc, it) => acc + (it.unitPrice ?? 0) * (it.quantity ?? 0),
    0,
  );
  const available = bundle.available !== false; // fallback true si champ absent

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} title="Offre" />

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <View style={styles.heroWrap}>
          {bundle.photoUrl ? (
            <Image source={{ uri: bundle.photoUrl }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <MaterialCommunityIcons name="gift-outline" size={48} color="#BDBDBD" />
            </View>
          )}
          {savings > 0 && (
            <View style={styles.savingsBadge}>
              <Ionicons name="pricetag" size={13} color="#fff" />
              <Text style={styles.savingsBadgeText}>−{Math.round(savingsPct)}%</Text>
            </View>
          )}
        </View>

        {/* Title + shop */}
        <View style={styles.section}>
          <Text style={styles.title}>{bundle.name}</Text>
          {bundle.epicerieName ? (
            <View style={styles.shopRow}>
              <Ionicons name="storefront" size={14} color="#666" />
              <Text style={styles.shopName}>{bundle.epicerieName}</Text>
            </View>
          ) : null}
          {bundle.description ? (
            <Text style={styles.description}>{bundle.description}</Text>
          ) : null}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Contenu du panier ({bundle.items?.length ?? 0} {bundle.items?.length === 1 ? 'produit' : 'produits'})
          </Text>
          <View style={styles.itemsList}>
            {(bundle.items ?? []).map((it, idx) => (
              <View key={`${it.productId}-${idx}`} style={styles.itemRow}>
                {it.productPhotoUrl ? (
                  <Image source={{ uri: it.productPhotoUrl }} style={styles.itemThumb} />
                ) : (
                  <View style={[styles.itemThumb, styles.itemThumbFallback]}>
                    <MaterialCommunityIcons name="package-variant" size={18} color="#999" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.productName}</Text>
                  {it.unitLabel ? (
                    <Text style={styles.itemUnit}>{it.unitLabel}</Text>
                  ) : null}
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>×{it.quantity}</Text>
                  {it.unitPrice != null ? (
                    <Text style={styles.itemUnitPrice}>
                      {(it.unitPrice * (it.quantity ?? 1)).toFixed(2)} {bundle.currencyCode}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recap prix */}
        <View style={styles.section}>
          <View style={styles.priceCard}>
            {sumItems > bundle.price && (
              <View style={styles.priceRow}>
                <Text style={styles.priceRowLabel}>Prix séparé</Text>
                <Text style={styles.priceRowOld}>{sumItems.toFixed(2)} {bundle.currencyCode}</Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.priceRowMain}>Prix du panier</Text>
              <Text style={styles.priceRowMainValue}>
                {bundle.price.toFixed(2)} {bundle.currencyCode}
              </Text>
            </View>
            {savings > 0 && (
              <View style={styles.savingsBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.savingsBannerText}>
                  Vous économisez {savings.toFixed(2)} {bundle.currencyCode} ({Math.round(savingsPct)}%)
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Dispo info */}
        {!available && (
          <View style={[styles.section, { paddingTop: 0 }]}>
            <View style={styles.unavailableBox}>
              <Ionicons name="alert-circle" size={18} color={RED} />
              <Text style={styles.unavailableText}>
                Cette offre est temporairement en rupture (un des produits n'est plus en stock).
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA sticky bottom */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerPriceLabel}>Total</Text>
          <Text style={styles.footerPrice}>
            {bundle.price.toFixed(2)} {bundle.currencyCode}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.cta, !available && styles.ctaDisabled]}
          onPress={handleAddToCart}
          disabled={!available}
          activeOpacity={0.85}
        >
          <Ionicons name="cart" size={18} color="#fff" />
          <Text style={styles.ctaText}>Ajouter au panier</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────

const Header: React.FC<{ onBack: () => void; title: string }> = ({ onBack, title }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    <View style={{ width: 24 }} />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  body: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GREEN,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, marginHorizontal: 12 },

  errorText: { color: '#616161', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: GREEN, borderRadius: 8 },
  errorBtnText: { color: '#fff', fontWeight: '600' },

  heroWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#ECEFF1' },
  hero: { width: '100%', height: '100%' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  savingsBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: RED,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  savingsBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  section: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#37474F', marginBottom: 8 },

  title: { fontSize: 22, fontWeight: '800', color: '#212121' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopName: { fontSize: 14, color: '#666' },
  description: { fontSize: 14, color: '#555', lineHeight: 20, marginTop: 6 },

  itemsList: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0F0F0' },
  itemThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#222' },
  itemUnit: { fontSize: 12, color: '#888' },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#37474F' },
  itemUnitPrice: { fontSize: 12, color: '#888', marginTop: 2 },

  priceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  priceRowLabel: { fontSize: 13, color: '#999' },
  priceRowOld: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  priceRowMain: { fontSize: 15, fontWeight: '700', color: '#212121' },
  priceRowMainValue: { fontSize: 22, fontWeight: '900', color: DARK_GREEN },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DARK_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  savingsBannerText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  unavailableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  unavailableText: { flex: 1, color: '#B71C1C', fontSize: 13, lineHeight: 18 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerPriceLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerPrice: { fontSize: 20, fontWeight: '900', color: DARK_GREEN },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaDisabled: { backgroundColor: '#BDBDBD' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
