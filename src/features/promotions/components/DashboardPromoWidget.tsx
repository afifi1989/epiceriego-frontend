import { Colors } from '../../../constants/colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { promotionService } from '../../../services/promotionService';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { usePermissions } from '../../../hooks/usePermissions';
import type { Promotion } from '../types';
import { computeStatus, humanizeDuration, interpolate } from '../utils';

/**
 * Widget compact pour le dashboard épicier. Montre en un coup d'œil :
 *  - nombre de promos actives
 *  - la plus urgente (expire en premier)
 *  - CTA "Gérer" / "Créer"
 *
 * Charge en best-effort, silencieux sur erreur (le dashboard ne doit pas casser
 * si l'API promo est indisponible).
 */
export function DashboardPromoWidget() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Promotion[]>([]);

  // Defense-in-depth : meme si le parent rend ce widget par erreur, on refuse
  // de fetcher si l'utilisateur n'a pas promotions:manage (l'endpoint backend
  // /promotions/my-store l'exige). Evite un 403 visible pour le caissier.
  const user = useCurrentUser();
  const { can } = usePermissions(user);
  const allowed = can('promotions:manage');

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await promotionService.getMyPromotions();
        if (cancelled) return;
        const actives = list.filter(p => computeStatus(p) === 'ACTIVE')
          .sort((a, b) => new Date(a.dateFin).getTime() - new Date(b.dateFin).getTime());
        setActive(actives);
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allowed]);

  // Si pas la permission, ne rien afficher du tout (le parent peut deja gater
  // mais defense-in-depth : on s'assure que rien ne fuit visuellement).
  if (!allowed) return null;

  const goManage = () => router.push('/(epicier)/promotions' as any);
  const goCreate = () => router.push('/(epicier)/promo-wizard' as any);

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  // Cas vide : pas de promo active
  if (active.length === 0) {
    return (
      <TouchableOpacity style={[styles.card, styles.emptyCard]} onPress={goCreate} activeOpacity={0.8}>
        <Text style={styles.emptyEmoji}>🎯</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>{t('promotions.dashboard.noneActive')}</Text>
          <Text style={styles.emptyCta}>＋ {t('promotions.dashboard.createFirst')}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const nextExpiring = active[0];
  const msRemaining = new Date(nextExpiring.dateFin).getTime() - Date.now();
  const urgent = msRemaining > 0 && msRemaining < 24 * 60 * 60 * 1000;
  const countLabel = interpolate(
    t(active.length === 1 ? 'promotions.dashboard.nActive' : 'promotions.dashboard.nActivePlural'),
    { n: active.length }
  );

  return (
    <TouchableOpacity style={styles.card} onPress={goManage} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>🏷️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('promotions.dashboard.widgetTitle')}</Text>
          <Text style={styles.count}>{countLabel}</Text>
          {urgent && (
            <Text style={styles.urgent}>
              ⚠️ «{nextExpiring.titre}» · {humanizeDuration(msRemaining)}
            </Text>
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
  },
  emptyCard: {
    borderLeftColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 30,
    opacity: 0.55,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
  },
  emptyCta: {
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '700',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 22 },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  count: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222',
    marginTop: 2,
  },
  urgent: {
    fontSize: 12,
    color: '#EF6C00',
    marginTop: 4,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    color: '#CCC',
  },
});
