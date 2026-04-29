import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  EmptyPromoState,
  PromoCard,
  PromoSearchBar,
  PromoStatsHeader,
} from '../../src/features/promotions/components';
import { usePromotions } from '../../src/features/promotions/hooks';

/**
 * Écran liste promotions — V2 moderne.
 * - 4 tuiles stats en haut (Actives / Planifiées / Passées / Arrêtées)
 * - Barre de recherche
 * - Cards riches avec countdown et impact count
 * - FAB "+" pour créer une nouvelle promo via le wizard
 */
export default function PromotionsScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const {
    loading, refreshing, error,
    stats, filtered, tab, setTab,
    search, setSearch,
    refetch,
  } = usePromotions();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const goCreate = () => router.push('/(epicier)/promo-wizard' as any);
  const goDetail = (id: number) =>
    router.push({ pathname: '/(epicier)/promo-detail' as any, params: { id: String(id) } });

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (error && filtered.length === 0 && stats.total === 0) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>{t('promotions.loadError')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.7}>
          <Text style={styles.retryBtnText}>{t('promotions.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        renderItem={({ item }) => (
          <PromoCard promo={item} onPress={() => goDetail(item.id)} />
        )}
        ListHeaderComponent={
          <>
            <PromoStatsHeader stats={stats} currentTab={tab} onSelect={setTab} />
            <PromoSearchBar value={search} onChangeText={setSearch} />
          </>
        }
        ListEmptyComponent={
          stats.total === 0 ? (
            <EmptyPromoState
              emoji="📢"
              title={t('promotions.list.empty')}
              ctaLabel={t('promotions.list.emptyCta')}
              onCta={goCreate}
            />
          ) : (
            <EmptyPromoState
              emoji="🔍"
              title={t('promotions.list.empty')}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetch}
            tintColor="#2196F3"
          />
        }
        contentContainerStyle={filtered.length === 0 && stats.total === 0 ? styles.emptyScroll : styles.scroll}
      />

      <TouchableOpacity style={styles.fab} onPress={goCreate} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabLabel}>{t('promotions.new')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 24,
  },
  scroll: {
    paddingBottom: 100,
  },
  emptyScroll: {
    flexGrow: 1,
    paddingBottom: 100,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  fabLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
