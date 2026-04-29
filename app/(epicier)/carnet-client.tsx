/**
 * Carnet Digital (الكرني) — Écran unifié de gestion client
 *
 * Remplace les 4 anciens écrans (détail client, crédit, avance, factures)
 * par une seule vue avec :
 * - En-tête client + solde
 * - 3 boutons d'action rapide (Encaisser, Avance, Crédit)
 * - Résumé financier (4 cartes)
 * - Timeline chronologique des transactions
 * - Alertes intelligentes (factures en retard, limite crédit)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../src/constants/config';
import { usePermissions } from '../../src/hooks/usePermissions';
import { LoginResponse } from '../../src/type';
import { useCarnet } from '../../src/features/carnet/hooks/useCarnet';
import { ALERT_CONFIG, CarnetAlert } from '../../src/features/carnet/types';
import { CarnetHeader } from '../../src/features/carnet/components/CarnetHeader';
import { CarnetSummary } from '../../src/features/carnet/components/CarnetSummary';
import { CarnetTimeline } from '../../src/features/carnet/components/CarnetTimeline';
import { QuickPaymentModal } from '../../src/features/carnet/components/QuickPaymentModal';
import { QuickAdvanceModal } from '../../src/features/carnet/components/QuickAdvanceModal';
import { CreditSettingsModal } from '../../src/features/carnet/components/CreditSettingsModal';
import { loyaltyService, LoyaltyBalance } from '../../src/services/loyaltyService';

const BLUE = '#2196F3';

export default function CarnetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = parseInt(id ?? '0', 10);

  const [epicerieId, setEpicerieId] = useState<number>(0);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const { can } = usePermissions(loginData);
  const canManageCredit = can('clients:credit');

  // Charger epicerieId + loginData
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      if (raw) {
        const user = JSON.parse(raw);
        setLoginData(user);
        setEpicerieId(user.epicerieId ?? 0);
      }
    });
  }, []);

  // Hook carnet
  const { carnet, loading, refreshing, error, isStale, loadMore, hasMore, refresh } = useCarnet({
    epicerieId,
    clientId,
    enabled: epicerieId > 0 && clientId > 0,
  });

  // Loyalty
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);

  useEffect(() => {
    if (clientId > 0) {
      loyaltyService.getClientBalance(clientId)
        .then(setLoyaltyBalance)
        .catch(() => setLoyaltyBalance(null));
    }
  }, [clientId]);

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  const handleActionSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // ── Loading ──
  if (loading && !carnet) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carnet client</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error && !carnet) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carnet client</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: '#e53935', fontSize: 15 }}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={{ marginTop: 12, padding: 10 }}>
            <Text style={{ color: BLUE, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!carnet) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Barre de navigation ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carnet</Text>
        {/* Visible uniquement pour les clients virtuels — un client réel
            gère son profil lui-même depuis son app. */}
        {carnet.clientIsVirtual && (
          <TouchableOpacity
            style={styles.editVirtualBtn}
            onPress={() => router.push({
              pathname: '/(epicier)/clients/nouveau-virtuel' as any,
              params: {
                clientId: String(carnet.clientId),
                name: carnet.clientName,
                phone: carnet.clientPhone ?? '',
                email: carnet.clientEmail ?? '',
              },
            })}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {isStale && (
          <View style={styles.staleBadge}>
            <Text style={styles.staleText}>Hors-ligne</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[BLUE]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── En-tête client ── */}
        <CarnetHeader carnet={carnet} />

        {/* ── Actions rapides ── */}
        {/* Encaisser visible pour tous les profils. Avance et Crédit
            requièrent la permission `clients:credit` (caissier exclu). */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => setShowPayment(true)}>
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>Encaisser</Text>
          </TouchableOpacity>
          {canManageCredit && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnBlue]} onPress={() => setShowAdvance(true)}>
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={styles.actionLabel}>Avance</Text>
            </TouchableOpacity>
          )}
          {canManageCredit && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPurple]} onPress={() => setShowCredit(true)}>
              <Text style={styles.actionIcon}>⚙️</Text>
              <Text style={styles.actionLabel}>Crédit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Alertes ── */}
        {carnet.alerts.length > 0 && (
          <View style={styles.alertsSection}>
            {carnet.alerts.map((alert: CarnetAlert, idx: number) => {
              const config = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.OVERDUE;
              return (
                <View key={idx} style={[styles.alertCard, { backgroundColor: config.bgColor }]}>
                  <Text style={styles.alertIcon}>{config.icon}</Text>
                  <Text style={[styles.alertText, { color: config.color }]}>{alert.message}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Points fidélité ── */}
        {loyaltyBalance && loyaltyBalance.balance > 0 && (
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyIcon}>
              <Ionicons name="star" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyTitle}>Points fidélité</Text>
              <Text style={styles.loyaltyBalance}>{loyaltyBalance.balance} pts</Text>
            </View>
          </View>
        )}

        {/* ── Résumé financier ── */}
        <CarnetSummary carnet={carnet} />

        {/* ── Timeline ── */}
        <CarnetTimeline
          transactions={carnet.transactions}
          hasMore={hasMore}
          onLoadMore={loadMore}
          loading={loading}
        />

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <QuickPaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handleActionSuccess}
        epicerieId={epicerieId}
        clientId={clientId}
        clientName={carnet.clientName}
        balanceDue={carnet.balanceDue}
      />

      <QuickAdvanceModal
        visible={showAdvance}
        onClose={() => setShowAdvance(false)}
        onSuccess={handleActionSuccess}
        epicerieId={epicerieId}
        clientId={clientId}
        clientName={carnet.clientName}
      />

      <CreditSettingsModal
        visible={showCredit}
        onClose={() => setShowCredit(false)}
        onSuccess={handleActionSuccess}
        epicerieId={epicerieId}
        clientId={clientId}
        clientName={carnet.clientName}
        currentAllowCredit={carnet.allowCredit}
        currentCreditLimit={carnet.creditLimit}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BLUE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' },
  body: { flex: 1, backgroundColor: '#f5f7fa' },

  headerBar: {
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  staleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  staleText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  editVirtualBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Actions rapides
  actionsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  actionBtnGreen: { backgroundColor: '#e8f5e9' },
  actionBtnBlue: { backgroundColor: '#e3f2fd' },
  actionBtnPurple: { backgroundColor: '#f3e5f5' },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: '#333' },

  // Alertes
  alertsSection: { paddingHorizontal: 12, gap: 6 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10,
  },
  alertIcon: { fontSize: 16 },
  alertText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Loyalty
  loyaltyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginBottom: 10,
    backgroundColor: '#fff8e1', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#ffe082',
  },
  loyaltyIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FF9800',
    alignItems: 'center', justifyContent: 'center',
  },
  loyaltyTitle: { fontSize: 12, color: '#e65100', fontWeight: '600' },
  loyaltyBalance: { fontSize: 20, fontWeight: '900', color: '#e65100' },
});
