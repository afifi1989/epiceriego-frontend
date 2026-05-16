/**
 * Widget dashboard mobile epicier — alertes stock.
 *
 * <p>Affiche en un coup d'œil le nombre de produits :
 *   - en rupture (stock <= seuil critique)
 *   - en stock bas (en-dessous du seuil de reapprovisionnement)
 *   - predits en rupture dans les N prochains jours (velocity-based)</p>
 *
 * <p>Tap → ouvre la page <code>stock-alerts</code> avec la liste complete.
 * Auto-masque si :
 *   - l'utilisateur n'a pas la permission <code>stock:view</code> (defense-in-depth)
 *   - aucune alerte (etat sain → on ne pollue pas le dashboard)
 *   - erreur API (silent fail)</p>
 *
 * <p>UI epicier mobile en francais uniquement.</p>
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { stockService, StockAlertsResponse } from '../../services/stockService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { usePermissions } from '../../hooks/usePermissions';

export function DashboardStockWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<StockAlertsResponse | null>(null);
  const [hidden, setHidden] = useState(false);

  const user = useCurrentUser();
  const { can } = usePermissions(user);
  const allowed = can('stock:view');

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setHidden(false);
    let cancelled = false;
    (async () => {
      try {
        const data = await stockService.getAlerts();
        if (!cancelled) setAlerts(data);
      } catch {
        // 403 / reseau : auto-masque silencieusement
        if (!cancelled) setHidden(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allowed]);

  if (!allowed || hidden) return null;

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color="#FF9800" />
      </View>
    );
  }

  const ruptureCount = alerts?.ruptures?.length ?? 0;
  const lowCount = alerts?.lowStock?.length ?? 0;
  const predictedCount = alerts?.predictedRuptures?.length ?? 0;
  const totalAlerts = ruptureCount + lowCount;

  // Etat sain : aucune alerte → on cache totalement (eviter d'encombrer le
  // dashboard avec un widget vide). L'epicier peut toujours acceder via le
  // menu "Plus" si besoin de verifier.
  if (totalAlerts === 0 && predictedCount === 0) return null;

  // Tonalite globale selon la gravite : rouge si ruptures effectives,
  // orange sinon (stock bas + previsions).
  const isCritical = ruptureCount > 0;
  const cardStyle = isCritical ? styles.cardCritical : styles.cardWarning;
  const accent = isCritical ? '#d32f2f' : '#ef6c00';
  const accentBg = isCritical ? '#ffebee' : '#fff3e0';

  return (
    <TouchableOpacity
      style={[styles.card, cardStyle]}
      onPress={() => router.push('/(epicier)/stock-alerts' as any)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconBox, { backgroundColor: accentBg }]}>
        <Text style={[styles.icon, { color: accent }]}>
          {isCritical ? '🚨' : '⚠️'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {isCritical ? 'Stock critique' : 'À réapprovisionner'}
        </Text>
        <View style={styles.row}>
          {ruptureCount > 0 && (
            <Text style={[styles.metric, { color: '#d32f2f' }]}>
              {ruptureCount} rupture{ruptureCount > 1 ? 's' : ''}
            </Text>
          )}
          {lowCount > 0 && (
            <Text style={[styles.metric, { color: '#ef6c00' }]}>
              {lowCount} stock bas
            </Text>
          )}
          {predictedCount > 0 && (
            <Text style={[styles.metric, { color: '#1976d2' }]}>
              +{predictedCount} bientôt
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardWarning: { borderLeftColor: '#FF9800' },
  cardCritical: { borderLeftColor: '#d32f2f' },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
    borderLeftColor: '#FF9800',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    marginBottom: 4,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { fontSize: 14, fontWeight: '700' },
  chevron: { fontSize: 22, color: '#CCC' },
});
