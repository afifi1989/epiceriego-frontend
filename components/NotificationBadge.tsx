import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { STORAGE_KEYS } from '../src/constants/config';
import { notificationService } from '../src/services/notificationService';

export function NotificationBadge() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  // Charger le nombre de notifications non lues
  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('[NotificationBadge] Erreur chargement count:', error);
    }
  };

  // Recharger au montage et quand on revient sur l'écran
  useEffect(() => {
    loadUnreadCount();
  }, []);

  // Recharger aussi quand on focus sur n'importe quel écran du layout
  useFocusEffect(
    React.useCallback(() => {
      loadUnreadCount();
      
      // Rafraîchir toutes les 30 secondes quand l'écran est actif
      const interval = setInterval(loadUnreadCount, 30000);
      
      return () => clearInterval(interval);
    }, [])
  );

  const handlePress = async () => {
    // Detection de role : l'epicier a son propre ecran notifications,
    // pendant moderne de l'ecran client. Sans ce check, l'epicier tombait
    // dans /(client)/notifications qui exige un role CLIENT et redirige.
    const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
    if (role === 'EPICIER' || role === 'COLLABORATEUR') {
      router.push('/(epicier)/notifications' as any);
    } else {
      router.push('/(client)/notifications');
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      style={styles.container}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: 15,
    padding: 5,
  },
  icon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF5252',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
