export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import React, { useCallback, useEffect, useState } from 'react';
// Rouge "danger" unifié sur la palette du design system (était #B00020).
import { lightColors } from '../../src/theme/colors';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LoyaltyCardVisual } from '../../src/components/client/LoyaltyCardVisual';
import { loyaltyCardService, LoyaltyCard } from '../../src/services/loyaltyCardService';
import { useLanguage } from '../../src/context/LanguageContext';
import { tFmt } from '../../src/services/chatbotService';

/**
 * Loyalty cards list — one entry per ACCEPTED relationship between the client
 * and an épicerie. Tapping a card navigates to the full-screen detail view
 * with the QR.
 *
 * The list re-fetches every time the screen comes into focus so a card that
 * was just revoked by the épicier disappears within seconds of the user
 * coming back from another tab — the implicit revocation only takes effect
 * client-side on the next API call.
 */
export default function CartesScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const loadCards = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorCode(null);
    try {
      const data = await loyaltyCardService.getMyCards();
      setCards(data);
    } catch (e: any) {
      console.error('[cartes] load failed', e);
      setErrorCode(e?.errorCode || 'LOYALTY_CARD_ERROR');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch on every focus: cheap, and ensures revoked cards drop quickly.
  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCards(true);
  }, [loadCards]);

  const onCardPress = useCallback(
    (card: LoyaltyCard) => {
      router.push({
        pathname: '/(client)/cartes/[epicerieId]',
        params: { epicerieId: String(card.epicerieId) },
      });
    },
    [router],
  );

  // ─── Loading state (initial only — refresh shows in-place spinner) ────
  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (errorCode && cards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t(`cards.error.${errorCode}`)}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadCards()}>
          <Text style={styles.retryBtnText}>{t('cards.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🎴</Text>
        <Text style={styles.emptyTitle}>{t('cards.emptyTitle')}</Text>
        <Text style={styles.emptyDesc}>{t('cards.emptyDesc')}</Text>
      </View>
    );
  }

  // ─── List ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.countLabel}>
        {tFmt(t, 'cards.cardCount', { count: cards.length })}
      </Text>
      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.relationId)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onCardPress(item)}>
            <LoyaltyCardVisual card={item} compact style={styles.cardItem} />
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 32,
  },
  countLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  cardItem: {
    marginBottom: 12,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: lightColors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
