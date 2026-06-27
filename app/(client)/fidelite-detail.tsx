export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  RedeemConfirmModal,
  RewardCard,
  StoreHeader,
  TransactionRow,
} from '../../src/features/loyalty/components';
import { useLoyaltyStore, useRedeemReward } from '../../src/features/loyalty/hooks';
import type { LoyaltyReward } from '../../src/features/loyalty/types';
import { canAfford, sortRewardsForClient } from '../../src/features/loyalty/utils';

type TabKey = 'rewards' | 'history';

export default function FideliteDetailScreen() {
  const { epicerieId } = useLocalSearchParams<{ epicerieId?: string }>();
  const router = useRouter();
  const { t } = useLanguage();

  const storeId = useMemo(() => {
    const id = Array.isArray(epicerieId) ? epicerieId[0] : epicerieId;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [epicerieId]);

  const [tab, setTab] = useState<TabKey>('rewards');
  const [pendingReward, setPendingReward] = useState<LoyaltyReward | null>(null);

  const {
    balance,
    rewards,
    transactions,
    hasMoreTx,
    loading,
    refreshing,
    loadingMoreTx,
    error,
    refetch,
    loadMoreTx,
  } = useLoyaltyStore(storeId);

  const { redeem, redeeming } = useRedeemReward();

  const sortedRewards = useMemo(
    () => sortRewardsForClient(rewards, balance?.balance ?? 0),
    [rewards, balance?.balance],
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(client)/fidelite' as any);
  };

  const handleRedeemPress = (reward: LoyaltyReward) => {
    if (!balance || !canAfford(reward, balance.balance)) return;
    setPendingReward(reward);
  };

  const confirmRedeem = async () => {
    if (!pendingReward || !storeId) return;
    const res = await redeem(storeId, pendingReward.id);
    if (res.success) {
      const name = pendingReward.name || pendingReward.productNameSnapshot || '';
      setPendingReward(null);
      Alert.alert(
        t('loyalty.rewards.success'),
        `${t('loyalty.rewards.successBody')}\n\n${name}`,
      );
      refetch();
    } else {
      setPendingReward(null);
      Alert.alert(t('loyalty.rewards.error'), res.error ?? '');
    }
  };

  if (!storeId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>#{String(epicerieId ?? '')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={goBack} activeOpacity={0.7}>
          <Text style={styles.retryBtnText}>{t('loyalty.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error || !balance) {
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor="#4CAF50" />}
        stickyHeaderIndices={[1]}
      >
        <StoreHeader balance={balance} />

        <View style={styles.tabsBar}>
          <TabButton
            active={tab === 'rewards'}
            label={t('loyalty.tabs.rewards')}
            onPress={() => setTab('rewards')}
          />
          <TabButton
            active={tab === 'history'}
            label={t('loyalty.tabs.history')}
            onPress={() => setTab('history')}
          />
        </View>

        {tab === 'rewards' ? (
          <RewardsPane
            rewards={sortedRewards}
            balance={balance.balance}
            redeeming={redeeming}
            onRedeem={handleRedeemPress}
          />
        ) : (
          <HistoryPane
            transactions={transactions}
            hasMore={hasMoreTx}
            loadingMore={loadingMoreTx}
            onLoadMore={loadMoreTx}
          />
        )}
      </ScrollView>

      <RedeemConfirmModal
        visible={!!pendingReward}
        reward={pendingReward}
        balance={balance.balance}
        redeeming={redeeming}
        onConfirm={confirmRedeem}
        onCancel={() => !redeeming && setPendingReward(null)}
      />
    </View>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RewardsPane({
  rewards,
  balance,
  redeeming,
  onRedeem,
}: {
  rewards: LoyaltyReward[];
  balance: number;
  redeeming: boolean;
  onRedeem: (r: LoyaltyReward) => void;
}) {
  const { t } = useLanguage();

  const { available, locked } = useMemo(() => {
    const avail: LoyaltyReward[] = [];
    const lock: LoyaltyReward[] = [];
    rewards.forEach(r => (canAfford(r, balance) ? avail.push(r) : lock.push(r)));
    return { available: avail, locked: lock };
  }, [rewards, balance]);

  if (rewards.length === 0) {
    return (
      <EmptyLoyaltyState
        emoji="🎁"
        title={t('loyalty.rewards.empty')}
        subtitle={t('loyalty.rewards.emptySubtitle')}
      />
    );
  }

  return (
    <View style={styles.pane}>
      {available.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>
            ✨ {t('loyalty.rewards.sectionAvailable')} ({available.length})
          </Text>
          {available.map(r => (
            <RewardCard
              key={r.id}
              reward={r}
              balance={balance}
              redeeming={redeeming}
              onRedeem={() => onRedeem(r)}
            />
          ))}
        </>
      )}

      {locked.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
            🔒 {t('loyalty.rewards.sectionLocked')} ({locked.length})
          </Text>
          {locked.map(r => (
            <RewardCard
              key={r.id}
              reward={r}
              balance={balance}
              redeeming={false}
              onRedeem={() => {}}
            />
          ))}
        </>
      )}
    </View>
  );
}

function HistoryPane({
  transactions,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  transactions: any[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useLanguage();

  if (transactions.length === 0) {
    return (
      <EmptyLoyaltyState
        emoji="🕓"
        title={t('loyalty.history.empty')}
        subtitle={t('loyalty.history.emptySubtitle')}
      />
    );
  }

  return (
    <View style={styles.pane}>
      <View style={styles.historyCard}>
        {transactions.map((tx, idx) => (
          <View key={tx.id}>
            <TransactionRow tx={tx} />
            {idx < transactions.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      {hasMore && (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={onLoadMore}
          disabled={loadingMore}
          activeOpacity={0.7}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Text style={styles.loadMoreText}>{t('loyalty.history.viewMore')}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
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
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: -16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#E8F5E9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#2E7D32',
    fontWeight: '800',
  },
  pane: {
    paddingHorizontal: 15,
    paddingBottom: 30,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 8,
  },
  loadMoreBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
  },
});
