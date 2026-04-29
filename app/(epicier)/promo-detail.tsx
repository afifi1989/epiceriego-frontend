import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
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
  PromoCountdown,
  PromoImpactCard,
  PromoStatusBadge,
} from '../../src/features/promotions/components';
import {
  usePromotionActions,
  usePromotionDetail,
} from '../../src/features/promotions/hooks';
import {
  computeStatus,
  formatShortDate,
  interpolate,
  statusColor,
} from '../../src/features/promotions/utils';

export default function PromoDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const numId = id ? Number(id) : null;

  const { promotion, impact, loading, refreshing, refetch } = usePromotionDetail(numId);
  const { loading: actionLoading, apply, rollback, remove } = usePromotionActions();

  const status = useMemo(() => promotion ? computeStatus(promotion) : 'DRAFT', [promotion]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(epicier)/promotions' as any);
  };

  const goEdit = () => {
    if (!numId) return;
    router.push({ pathname: '/(epicier)/promo-wizard' as any, params: { id: String(numId) } });
  };

  const handleApply = () => {
    if (!numId) return;
    Alert.alert(
      '',
      t('promotions.detail.applyConfirm'),
      [
        { text: t('promotions.cancel'), style: 'cancel' },
        {
          text: t('promotions.apply'),
          onPress: async () => {
            const res = await apply(numId);
            if (res) {
              Alert.alert('', interpolate(t('promotions.detail.applied'), { n: res.unitsModified }));
              refetch();
            }
          },
        },
      ]
    );
  };

  const handleRollback = () => {
    if (!numId) return;
    Alert.alert(
      '',
      t('promotions.detail.rollbackConfirm'),
      [
        { text: t('promotions.cancel'), style: 'cancel' },
        {
          text: t('promotions.rollback'),
          style: 'destructive',
          onPress: async () => {
            const res = await rollback(numId);
            if (res) {
              Alert.alert('', interpolate(t('promotions.detail.rolledBack'), { n: res.unitsRestored }));
              refetch();
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!numId) return;
    Alert.alert(
      '',
      t('promotions.detail.deleteConfirm'),
      [
        { text: t('promotions.cancel'), style: 'cancel' },
        {
          text: t('promotions.delete'),
          style: 'destructive',
          onPress: async () => {
            const ok = await remove(numId);
            if (ok) {
              Alert.alert('', t('promotions.detail.deleted'));
              goBack();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!promotion) {
    return (
      <View style={styles.loading}>
        <Text>—</Text>
      </View>
    );
  }

  const color = statusColor(status);

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor="#2196F3" />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero header avec % en grand */}
        <View style={[styles.hero, { backgroundColor: color }]}>
          <View style={styles.heroGradient} />
          <Text style={styles.heroTitle} numberOfLines={2}>{promotion.titre}</Text>
          {promotion.description ? (
            <Text style={styles.heroDesc} numberOfLines={3}>{promotion.description}</Text>
          ) : null}

          <View style={styles.heroMeta}>
            <PromoStatusBadge status={status} />
            {status === 'ACTIVE' && (
              <PromoCountdown targetIso={promotion.dateFin} mode="endsIn" />
            )}
            {status === 'SCHEDULED' && (
              <PromoCountdown targetIso={promotion.dateDebut} mode="startsIn" />
            )}
            {status === 'EXPIRED' && (
              <PromoCountdown targetIso={promotion.dateFin} mode="endedAgo" />
            )}
          </View>

          <View style={styles.pctBox}>
            <Text style={styles.pctText}>−{Math.round(promotion.reductionPercentage)}</Text>
            <Text style={styles.pctSuffix}>%</Text>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('promotions.detail.dates')}</Text>
          <View style={styles.infoCard}>
            <Row label="📅" value={`${formatShortDate(promotion.dateDebut)} → ${formatShortDate(promotion.dateFin)}`} />
            {promotion.appliedAt && (
              <Row
                label="✅"
                value={interpolate(t('promotions.detail.startedAt'), { when: formatShortDate(promotion.appliedAt) })}
              />
            )}
            {promotion.rolledBackAt && (
              <Row
                label="🏁"
                value={interpolate(t('promotions.detail.endedAt'), { when: formatShortDate(promotion.rolledBackAt) })}
              />
            )}
          </View>
        </View>

        {/* Targets */}
        {promotion.targetType && promotion.targetType !== 'ALL' && promotion.targets && promotion.targets.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('promotions.detail.targets')}</Text>
            <View style={styles.infoCard}>
              {promotion.targets.map((tg, idx) => (
                <View key={tg.id} style={[styles.targetRow, idx > 0 && styles.targetRowBorder]}>
                  <Text style={styles.targetKind}>
                    {tg.kind === 'CATEGORY' ? '📁' : tg.kind === 'PRODUCT' ? '🍎' : '🏷️'}
                  </Text>
                  <Text style={styles.targetName} numberOfLines={1}>{tg.displayName}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : promotion.targetType === 'ALL' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('promotions.detail.targets')}</Text>
            <View style={styles.infoCard}>
              <View style={styles.targetRow}>
                <Text style={styles.targetKind}>🏪</Text>
                <Text style={styles.targetName}>{t('promotions.wizard.targetAll')}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Impact */}
        {impact && impact.activeUnitsCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('promotions.detail.impact')}</Text>
            <PromoImpactCard impact={impact} />
          </View>
        )}
      </ScrollView>

      {/* Actions footer */}
      <View style={styles.footer}>
        {status !== 'ACTIVE' && status !== 'EXPIRED' && (
          <TouchableOpacity style={[styles.btn, styles.btnApply]} onPress={handleApply} disabled={actionLoading != null}>
            {actionLoading === 'apply'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnText}>▶ {t('promotions.apply')}</Text>}
          </TouchableOpacity>
        )}
        {status === 'ACTIVE' && (
          <TouchableOpacity style={[styles.btn, styles.btnRollback]} onPress={handleRollback} disabled={actionLoading != null}>
            {actionLoading === 'rollback'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnText}>⏸ {t('promotions.rollback')}</Text>}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btn, styles.btnEdit]} onPress={goEdit} disabled={actionLoading != null}>
          <Text style={styles.btnTextDark}>✏️ {t('promotions.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnIcon, styles.btnDelete]} onPress={handleDelete} disabled={actionLoading != null}>
          {actionLoading === 'delete'
            ? <ActivityIndicator size="small" color="#C62828" />
            : <Text style={styles.btnIconText}>🗑️</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  heroDesc: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.92,
    marginTop: 6,
    lineHeight: 18,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  pctBox: {
    position: 'absolute',
    right: 20,
    top: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pctText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 38,
  },
  pctSuffix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 6,
    marginLeft: 2,
  },

  section: {
    marginTop: 18,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    fontSize: 16,
  },
  rowValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  targetRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  targetKind: {
    fontSize: 18,
  },
  targetName: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },

  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnApply: {
    backgroundColor: '#4CAF50',
  },
  btnRollback: {
    backgroundColor: '#FF9800',
  },
  btnEdit: {
    backgroundColor: '#F5F5F5',
  },
  btnDelete: {
    backgroundColor: '#FFEBEE',
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  btnTextDark: {
    color: '#333',
    fontWeight: '700',
    fontSize: 14,
  },
  btnIcon: {
    width: 50,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIconText: {
    fontSize: 18,
  },
});
