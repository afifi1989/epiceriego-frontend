import { Stack, useRouter, Redirect } from 'expo-router';
import { TouchableOpacity, Alert, Text, ActivityIndicator, View } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/constants/config';

import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';

// Composant interne pour gérer le layout authentifié
function LivreurStackContent() {
  const router = useRouter();

  // ✅ Initialiser les push notifications pour les livreurs authentifiés
  useEffect(() => {
    console.log('[LivreurLayout] 🎯 LivreurLayout component mounted - Initializing notifications');

    const setupNotifications = async () => {
      try {
        // Petit délai pour s'assurer que le composant est complètement monté
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[LivreurLayout] 1️⃣ Setting foreground handler');
        await pushNotificationService.setForegroundNotificationHandler();

        console.log('[LivreurLayout] 2️⃣ Setup notification categories');
        await pushNotificationService.setupNotificationCategories();

        console.log('[LivreurLayout] 3️⃣ Register for push notifications');
        const token = await pushNotificationService.registerForPushNotifications();
        console.log('[LivreurLayout] Token received:', token);

        if (token) {
          console.log('[LivreurLayout] 4️⃣ Send token to server');
          const success = await pushNotificationService.sendTokenToServer(token);
          console.log('[LivreurLayout] Send result:', success);

          if (!success) {
            console.log('[LivreurLayout] ⚠️ Token saved locally, will retry later');
          }

          console.log('[LivreurLayout] 5️⃣ Retry pending tokens');
          await pushNotificationService.retryPendingToken();
        } else {
          console.error('[LivreurLayout] ❌ No token received!');
        }

        console.log('[LivreurLayout] 6️⃣ Setup notification handlers');
        pushNotificationService.setupNotificationHandlers(router);

        console.log('[LivreurLayout] ✅ All notification setup complete');
      } catch (error) {
        console.error('[LivreurLayout] ❌ Error during notification setup:', error);
        if (error instanceof Error) {
          console.error('[LivreurLayout] Error message:', error.message);
          console.error('[LivreurLayout] Stack:', error.stack);
        }
      }
    };

    setupNotifications();
  }, [router]);

  const handleLogout = async (): Promise<void> => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Erreur déconnexion:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#9C27B0' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="deliveries" 
        options={{ 
          title: '🚚 Mes Livraisons',
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleLogout} 
              style={{ marginRight: 15 }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                Déconnexion
              </Text>
            </TouchableOpacity>
          ),
        }} 
      />
    </Stack>
  );
}

// Composant principal avec vérification d'authentification
export default function LivreurLayout() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // 🔐 Vérifier l'authentification AVANT d'afficher le layout
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);

        // Si pas de token ou pas le bon rôle → rediriger vers login
        if (!token || role !== 'LIVREUR') {
          console.error('[LivreurLayout] ❌ ACCÈS NON AUTORISÉ - Token ou rôle invalide');
          setIsAuthenticated(false);
          setUserRole(role);
          return;
        }

        console.log('[LivreurLayout] ✅ Authentification valide');
        setIsAuthenticated(true);
        setUserRole(role);
      } catch (error) {
        console.error('[LivreurLayout] ❌ Erreur vérification auth:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // 🔄 Afficher un loader pendant la vérification
  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9C27B0" />
      </View>
    );
  }

  // 🚫 Rediriger si non authentifié
  if (!isAuthenticated || userRole !== 'LIVREUR') {
    console.log('[LivreurLayout] Redirection vers login - authentification manquante');
    return <Redirect href="/(auth)/login" />;
  }

  // ✅ Afficher le contenu authentifié
  return <LivreurStackContent />;
}