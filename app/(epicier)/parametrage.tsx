import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { epicerieService } from '../../src/services/epicerieService';
import { Epicerie } from '../../src/type';

export default function ParametrageScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);

  useEffect(() => {
    loadEpicerieData();
  }, []);

  const loadEpicerieData = async () => {
    try {
      const data = await epicerieService.getMyEpicerie();
      setEpicerie(data);
      setIsActive(data.isActive);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (value: boolean) => {
    try {
      setIsActive(value);
      // TODO: Appeler l'API pour mettre à jour le statut
      Alert.alert(
        'Statut modifié',
        value ? 'Votre épicerie est maintenant active' : 'Votre épicerie est maintenant inactive'
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le statut');
      setIsActive(!value);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>État de l'épicerie</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>🔄 Statut de l'épicerie</Text>
              <Text style={styles.settingDescription}>
                {isActive ? 'Votre épicerie est visible par les clients' : 'Votre épicerie est masquée'}
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={handleToggleStatus}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={isActive ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>🔔 Notifications push</Text>
              <Text style={styles.settingDescription}>
                Recevoir des notifications pour les nouvelles commandes
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ccc', true: '#2196F3' }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gestion des commandes</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>⚡ Acceptation automatique</Text>
              <Text style={styles.settingDescription}>
                Accepter automatiquement les nouvelles commandes
              </Text>
            </View>
            <Switch
              value={autoAcceptOrders}
              onValueChange={setAutoAcceptOrders}
              trackColor={{ false: '#ccc', true: '#2196F3' }}
              thumbColor={autoAcceptOrders ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations de l'épicerie</Text>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/(epicier)/modifier-infos')}
        >
          <Text style={styles.actionIcon}>✏️</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Modifier les informations</Text>
            <Text style={styles.actionDescription}>Nom, adresse, téléphone, horaires</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📸</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Photo de l'épicerie</Text>
            <Text style={styles.actionDescription}>Changer la photo de profil</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>🕐</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Horaires d'ouverture</Text>
            <Text style={styles.actionDescription}>Définir les horaires de l'épicerie</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zone de livraison</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📍</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Zone de livraison</Text>
            <Text style={styles.actionDescription}>Définir le rayon de livraison</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>💰</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Frais de livraison</Text>
            <Text style={styles.actionDescription}>Configurer les frais de livraison</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paiement</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>💳</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Modes de paiement</Text>
            <Text style={styles.actionDescription}>Espèces, carte, mobile money</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>🏦</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Compte bancaire</Text>
            <Text style={styles.actionDescription}>Gérer les informations bancaires</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Autres</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📊</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Statistiques</Text>
            <Text style={styles.actionDescription}>Voir les statistiques détaillées</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>❓</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Aide & Support</Text>
            <Text style={styles.actionDescription}>Contacter le support</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📄</Text>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>Conditions d'utilisation</Text>
            <Text style={styles.actionDescription}>Lire les CGU</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 15,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginLeft: 5,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#666',
  },
  actionArrow: {
    fontSize: 24,
    color: '#ccc',
  },
});
