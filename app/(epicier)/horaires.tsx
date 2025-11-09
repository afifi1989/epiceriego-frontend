/**
 * Gestion des horaires d'ouverture pour l'épicier
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { epicerieService } from '../../src/services/epicerieService';
import { ShopHoursManager, ShopHours } from '../../components/epicier/ShopHoursManager';

export default function ShopHoursScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<ShopHours>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const epicerieData = await epicerieService.getMyEpicerie();

      // Parse horaires if they exist
      if (epicerieData.horaires) {
        try {
          const parsedHours = JSON.parse(epicerieData.horaires);
          setHours(parsedHours);
        } catch (parseError) {
          // Si le format n'est pas JSON, utiliser les defaults
          console.warn('Format horaires non valide, utiliser les defaults');
          setHours({});
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les données');
      console.error('Erreur chargement horaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHours = async (newHours: ShopHours) => {
    try {
      setSaving(true);

      // Convertir les horaires en string JSON pour le stockage
      const hoursString = JSON.stringify(newHours);

      await epicerieService.updateMyEpicerie({
        horaires: hoursString,
      });

      setHours(newHours);
      Alert.alert('✅ Succès', 'Les horaires ont été mis à jour', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', `Impossible de sauvegarder les horaires: ${error}`);
      console.error('Erreur sauvegarde horaires:', error);
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
        <Text style={styles.headerTitle}>Horaires d'ouverture</Text>
        <View style={{ width: 40 }} />
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.savingText}>Enregistrement...</Text>
        </View>
      )}

      <ShopHoursManager
        initialHours={hours}
        onSave={handleSaveHours}
      />

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color="#0288D1" />
          <Text style={styles.infoText}>
            Ces horaires seront affichées aux clients lors de leur recherche de votre épicerie.
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
