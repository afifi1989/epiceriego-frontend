export { LivreurErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { STORAGE_KEYS } from '../../src/constants/config';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';

// Composant interne pour gérer le layout authentifié
function LivreurTabsContent() {
  const router = useRouter();
  const [epicerieName, setEpicerieName] = useState<string>('');

  // ✅ Charger le nom de l'épicerie au montage
  useEffect(() => {
    const loadEpicerieName = async () => {
      try {
        const storedEpicerieName = await AsyncStorage.getItem('epicerieName');
        if (storedEpicerieName) {
          setEpicerieName(storedEpicerieName);
        }
      } catch (error) {
        console.error('[LivreurLayout] Erreur chargement nom épicerie:', error);
      }
    };
    loadEpicerieName();
  }, []);

  useEffect(() => {
    console.log('[LivreurLayout] 🎯 Mount — initializing notifications');

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupNotifications = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!isMounted) return;

        await pushNotificationService.setForegroundNotificationHandler();

        const token = await pushNotificationService.registerForPushNotifications();

        if (token) {
          await pushNotificationService.sendTokenToServer(token);
          await pushNotificationService.retryPendingToken();
        }

        if (!isMounted) return;

        unsubscribe = pushNotificationService.setupNotificationHandlers(router);
        await pushNotificationService.handleColdStartResponse(router);

        console.log('[LivreurLayout] ✅ Notification setup complete');
      } catch (error) {
        console.error('[LivreurLayout] ❌ Error during notification setup:', error);
      }
    };

    setupNotifications();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#9C27B0',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 1,
        },
        headerStyle: { backgroundColor: '#9C27B0' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        // Déconnexion accessible depuis tous les onglets (fin de shift =
        // changement de livreur sur le même téléphone). handleLogout était
        // défini mais jamais branché — déconnexion uniquement via Profil.
        headerRight: () => (
          <TouchableOpacity
            onPress={handleLogout}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
          >
            <MaterialCommunityIcons name="logout" size={22} color="#fff" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Livraisons',
          tabBarLabel: 'Livraisons',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>📦</Text>
          ),
          headerTitle: epicerieName || '🚚 Mes Livraisons',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarLabel: 'Historique',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>📋</Text>
          ),
          headerTitle: '📋 Historique',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>👤</Text>
          ),
          headerTitle: '👤 Mon Profil',
        }}
      />
      <Tabs.Screen
        name="scan-qr"
        options={{
          href: null,
        }}
      />
    </Tabs>
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

  // ✅ Afficher le contenu authentifié.
  return (
    <View style={{ flex: 1 }}>
      <LivreurTabsContent />
    </View>
  );
}