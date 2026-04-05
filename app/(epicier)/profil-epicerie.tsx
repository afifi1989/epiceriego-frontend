import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PresentationPhotoUpload } from '../../src/components/epicier/PresentationPhotoUpload';
import { STORAGE_KEYS } from '../../src/constants/config';
import { usePermissions } from '../../src/hooks/usePermissions';
import { epicerieService } from '../../src/services/epicerieService';
import { orderService } from '../../src/services/orderService';
import { Epicerie, LoginResponse } from '../../src/type';

export default function ProfilEpicerieScreen() {
  const router = useRouter();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const { can } = usePermissions(loginData);
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, todayRevenue: 0 });

  useEffect(() => { loadData(); }, []);

  useFocusEffect(useCallback(() => {
    epicerieService.getMyEpicerie()
      .then(data => setEpicerie(data))
      .catch(() => {});
  }, []));

  const loadData = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (raw) setLoginData(JSON.parse(raw));

      const epicerieData = await epicerieService.getMyEpicerie();
      setEpicerie(epicerieData);

      try {
        const ordersData = await orderService.getEpicerieOrders();
        const pendingCount = ordersData.filter(o => o.status === 'PENDING').length;
        const todayOrders = ordersData.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate.toDateString() === new Date().toDateString();
        });
        const todayRev = todayOrders.reduce((sum, o) => sum + o.total, 0);
        setStats({ totalOrders: ordersData.length, pendingOrders: pendingCount, todayRevenue: todayRev });
      } catch {
        // Stats non critiques
      }
    } catch (error) {
      console.error('Erreur chargement profil épicerie:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} ref={scrollViewRef}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {epicerie?.photoUrl ? (
            <Image source={{ uri: epicerie.photoUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarEmoji}>🏪</Text>
          )}
        </View>
        <Text style={styles.epicerieName}>{epicerie?.nomEpicerie || 'Mon Épicerie'}</Text>
        <View style={[styles.statusBadge, epicerie?.isActive ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusText}>{epicerie?.isActive ? '✅ Ouverte' : '❌ Fermée'}</Text>
        </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(epicier)/dashboard')}>
          <Text style={styles.statIcon}>📦</Text>
          <Text style={styles.statValue}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Commandes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(epicier)/commandes')}>
          <Text style={styles.statIcon}>⏳</Text>
          <Text style={[styles.statValue, stats.pendingOrders > 0 && styles.statWarning]}>
            {stats.pendingOrders}
          </Text>
          <Text style={styles.statLabel}>En attente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(epicier)/dashboard')}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statValue}>{stats.todayRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>CA du jour</Text>
        </TouchableOpacity>
      </View>

      {/* Photo de présentation */}
      {epicerie && can('settings:edit') && (
        <PresentationPhotoUpload
          epicerie={epicerie}
          epicerieId={epicerie.id}
          onPhotoUpdated={updated => setEpicerie(updated)}
        />
      )}

      {/* Informations épicerie */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations de l'épicerie</Text>
        <View style={styles.card}>
          <InfoRow icon="🏪" label="Nom" value={epicerie?.nomEpicerie} />
          <InfoRow icon="📍" label="Adresse" value={epicerie?.adresse} />
          <InfoRow icon="📱" label="Téléphone pro" value={epicerie?.telephonePro || epicerie?.telephone} />
          <InfoRow icon="📦" label="Produits" value={String(epicerie?.nombreProducts ?? 0)} last />
        </View>
      </View>

      {/* Informations gérant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations du gérant</Text>
        <View style={styles.card}>
          <InfoRow icon="👤" label="Prénom" value={epicerie?.prenomGerant} />
          <InfoRow icon="👤" label="Nom" value={epicerie?.nomGerant} />
          <InfoRow icon="📧" label="Email" value={epicerie?.emailGerant} last />
        </View>
      </View>

      {/* Actions */}
      {can('settings:edit') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestion de l'épicerie</Text>

          <ActionButton
            icon="✏️"
            label="Modifier les informations"
            onPress={() => router.push('/(epicier)/modifier-infos')}
          />
          <ActionButton
            icon="⏰"
            label="Horaires d'ouverture"
            onPress={() => router.push('/(epicier)/horaires')}
          />
          <ActionButton
            icon="🚚"
            label="Zones de livraison"
            onPress={() => router.push('/(epicier)/zones-livraison')}
          />
          <ActionButton
            icon="📸"
            label="Photo de présentation"
            onPress={() => scrollViewRef.current?.scrollTo({ y: 260, animated: true })}
            highlighted
          />
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function InfoRow({
  icon, label, value, last = false,
}: { icon: string; label: string; value?: string | null; last?: boolean }) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{icon} {label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
      {!last && <View style={styles.divider} />}
    </>
  );
}

function ActionButton({
  icon, label, onPress, highlighted = false,
}: { icon: string; label: string; onPress: () => void; highlighted?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, highlighted && styles.actionBtnHighlighted]}
      onPress={onPress}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#2196F3',
    padding: 30, paddingTop: 40,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 50 },
  avatar: { width: '100%', height: '100%', borderRadius: 50, resizeMode: 'cover' },
  epicerieName: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  statusActive: { backgroundColor: 'rgba(76,175,80,0.3)' },
  statusInactive: { backgroundColor: 'rgba(244,67,54,0.3)' },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 20, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 15, padding: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  statIcon: { fontSize: 26, marginBottom: 5 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#2196F3' },
  statWarning: { color: '#f44336' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2, fontWeight: '600' },

  section: { paddingHorizontal: 15, paddingBottom: 5 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 10, marginLeft: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 15, padding: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 11,
  },
  infoLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  infoValue: { fontSize: 13, color: '#333', flex: 1, textAlign: 'right', marginLeft: 10 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },

  actionBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  actionBtnHighlighted: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4, borderLeftColor: '#FF9800',
  },
  actionIcon: { fontSize: 22, marginRight: 14 },
  actionLabel: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
  chevron: { fontSize: 22, color: '#ccc' },
});
