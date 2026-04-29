import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  EmptyLoyaltyState,
  PointsHeroCard,
  StoreLoyaltyCard,
} from '../../src/features/loyalty/components';
import { useLoyaltyBalances } from '../../src/features/loyalty/hooks';

export default function FideliteScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { balances, totalPoints, loading, refreshing, error, refetch } = useLoyaltyBalances();

  const goToStore = (epicerieId: number) => {
    router.push({ pathname: '/(client)/fidelite-detail' as any, params: { epicerieId: String(epicerieId) } });
  };

  const goDiscover = () => {
    router.push('/(client)/epiceries');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error && balances.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('loyalty.loadError')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.7}>
          <Text style={styles.retryBtnText}>{t('loyalty.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor="#4CAF50" />}
    >
      {balances.length > 0 ? (
        <>
          <PointsHeroCard totalPoints={totalPoints} storesCount={balances.length} />

          <Text style={styles.sectionTitle}>{t('loyalty.subtitle')}</Text>

          {balances.map(b => (
            <StoreLoyaltyCard
              key={b.epicerieId}
              balance={b}
              onPress={() => goToStore(b.epicerieId)}
            />
          ))}

          <View style={{ height: 30 }} />
        </>
      ) : (
        <EmptyLoyaltyState
          emoji="⭐"
          title={t('loyalty.empty.title')}
          subtitle={t('loyalty.empty.subtitle')}
          ctaLabel={t('loyalty.empty.cta')}
          onCta={goDiscover}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
