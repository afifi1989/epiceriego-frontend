/**
 * Gestion des zones de livraison pour l'épicier
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { epicerieService } from '../../src/services/epicerieService';
import { DeliveryZoneManager, DeliveryZone } from '../../components/epicier/DeliveryZoneManager';

export default function DeliveryZonesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const epicerieData = await epicerieService.getMyEpicerie();

      setLatitude(epicerieData.latitude);
      setLongitude(epicerieData.longitude);

      // Parse zones de livraison if they exist
      if (epicerieData.deliveryZones && epicerieData.deliveryZones.trim()) {
        try {
          const parsedZones = JSON.parse(epicerieData.deliveryZones);
          setZones(parsedZones);
          console.log('[DeliveryZonesScreen] Zones chargées:', parsedZones);
        } catch (parseError) {
          // Si le format n'est pas JSON, utiliser les defaults du composant
          console.warn('[DeliveryZonesScreen] Format zones non valide, utiliser les defaults');
          setZones([]);
        }
      } else {
        // Pas de zones en BD, utiliser defaults du composant
        console.log('[DeliveryZonesScreen] Aucune zone en BD, utiliser defaults');
        setZones([]);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les données');
      console.error('[DeliveryZonesScreen] Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZones = async (newZones: DeliveryZone[]) => {
    try {
      setSaving(true);

      // Convertir les zones en string JSON pour le stockage
      const zonesString = JSON.stringify(newZones);

      // Note: Assuming epicerieService supports deliveryZones field
      // If not, we may need to add it to the backend
      await epicerieService.updateMyEpicerie({
        deliveryZones: zonesString,
      });

      setZones(newZones);
      Alert.alert('✅ Succès', 'Les zones de livraison ont été mises à jour', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      // If deliveryZones is not supported, show a different message
      if (String(error).includes('unknown property') || String(error).includes('deliveryZones')) {
        Alert.alert(
          '⚠️ Fonctionnalité non encore supportée',
          'Le backend n\'a pas encore implémenté la gestion des zones de livraison. Cette fonctionnalité sera disponible bientôt.'
        );
        // Still update local state for UI purposes
        setZones(newZones);
        router.back();
      } else {
        Alert.alert('Erreur', `Impossible de sauvegarder les zones: ${error}`);
      }
      console.error('Erreur sauvegarde zones:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zones de livraison</Text>
        <View style={{ width: 40 }} />
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.savingText}>Enregistrement...</Text>
        </View>
      )}

      <DeliveryZoneManager
        initialZones={zones}
        onSave={handleSaveZones}
        latitude={latitude}
        longitude={longitude}
      />

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <MaterialIcons name="local-shipping" size={20} color="#0288D1" />
          <Text style={styles.infoText}>
            Les zones de livraison permettent aux clients de voir les frais de livraison et les délais estimés selon leur localisation.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
  },
  savingText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E1F5FE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#01579B',
    fontWeight: '500',
    lineHeight: 18,
  },
});
