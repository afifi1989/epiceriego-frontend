import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationBadge } from '../../components/NotificationBadge';
import { STORAGE_KEYS } from '../../src/constants/config';
import { useLanguage } from '../../src/context/LanguageContext';
import { pushNotificationService } from '../../src/services/pushNotificationService';

// Composant interne pour gérer le layout authentifié
function ClientTabsContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();

  // ✅ Initialiser les push notifications pour les clients authentifiés
  useEffect(() => {
    console.log('[ClientLayout] 🎯 ClientLayout component mounted - Initializing notifications');

    const setupNotifications = async () => {
      try {
        // Petit délai pour s'assurer que le composant est complètement monté
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[ClientLayout] 1️⃣ Setting foreground handler');
        await pushNotificationService.setForegroundNotificationHandler();

        console.log('[ClientLayout] 2️⃣ Setup notification categories');
        await pushNotificationService.setupNotificationCategories();

        console.log('[ClientLayout] 3️⃣ Register for push notifications');
        const token = await pushNotificationService.registerForPushNotifications();
        console.log('[ClientLayout] Token received:', token);

        if (token) {
          console.log('[ClientLayout] 4️⃣ Send token to server');
          const success = await pushNotificationService.sendTokenToServer(token);
          console.log('[ClientLayout] Send result:', success);

          if (!success) {
            console.log('[ClientLayout] ⚠️ Token saved locally, will retry later');
          }

          console.log('[ClientLayout] 5️⃣ Retry pending tokens');
          await pushNotificationService.retryPendingToken();
        } else {
          console.error('[ClientLayout] ❌ No token received!');
        }

        console.log('[ClientLayout] 6️⃣ Setup notification handlers');
        pushNotificationService.setupNotificationHandlers(router);

        console.log('[ClientLayout] ✅ All notification setup complete');
      } catch (error) {
        console.error('[ClientLayout] ❌ Error during notification setup:', error);
        if (error instanceof Error) {
          console.error('[ClientLayout] Error message:', error.message);
          console.error('[ClientLayout] Stack:', error.stack);
        }
      }
    };

    setupNotifications();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('client.tabs.home'),
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🏠</Text>,
          headerTitle: t('client.headers.home'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="epiceries"
        options={{
          title: t('client.tabs.epiceries'),
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🏪</Text>,
          headerTitle: t('client.headers.epiceries'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('client.tabs.cart'),
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🛒</Text>,
          headerTitle: t('client.headers.cart'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          title: t('client.tabs.favorites'),
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>⭐</Text>,
          headerTitle: t('client.headers.favorites'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t('client.tabs.profile'),
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>👤</Text>,
          headerTitle: t('client.headers.profile'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(epicerie)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="LogoutButton"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="invitations"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="factures-paiements"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="(commandes)"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

// Composant principal avec vérification d'authentification
export default function ClientLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // 🔐 Vérifier l'authentification AVANT d'afficher le layout
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);

        // Si pas de token ou pas le bon rôle → rediriger vers login
        if (!token || role !== 'CLIENT') {
          console.error('[ClientLayout] ❌ ACCÈS NON AUTORISÉ - Token ou rôle invalide');
          setIsAuthenticated(false);
          setUserRole(role);
          return;
        }

        console.log('[ClientLayout] ✅ Authentification valide');
        setIsAuthenticated(true);
        setUserRole(role);
      } catch (error) {
        console.error('[ClientLayout] ❌ Erreur vérification auth:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // 🔄 Afficher un loader pendant la vérification
  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // 🚫 Rediriger si non authentifié
  if (!isAuthenticated || userRole !== 'CLIENT') {
    console.log('[ClientLayout] Redirection vers login - authentification manquante');
    return <Redirect href="/(auth)/login" />;
  }

  // ✅ Afficher le contenu authentifié
  return <ClientTabsContent />;
}
