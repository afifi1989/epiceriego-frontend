export { ClientErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationBadge } from '../../components/NotificationBadge';
import { STORAGE_KEYS } from '../../src/constants/config';
import { useLanguage } from '../../src/context/LanguageContext';
import { pushNotificationService } from '../../src/services/pushNotificationService';

/**
 * Icône vectorielle de tab : version pleine quand l'onglet est actif, outline
 * sinon — teintée automatiquement par la tab bar (active/inactiveTintColor).
 * Remplace les anciens emojis : rendu net à toutes les densités, contraste
 * cohérent et état actif réellement visible.
 */
const tabIcon = (
  outline: keyof typeof Ionicons.glyphMap,
  filled: keyof typeof Ionicons.glyphMap,
) =>
  function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
  };

// Composant interne pour gérer le layout authentifié
function ClientTabsContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    console.log('[ClientLayout] 🎯 Mount — initializing notifications');

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

        console.log('[ClientLayout] ✅ Notification setup complete');
      } catch (error) {
        console.error('[ClientLayout] ❌ Error during notification setup:', error);
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
          tabBarIcon: tabIcon('home-outline', 'home'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="epiceries"
        options={{
          title: t('client.tabs.epiceries'),
          tabBarIcon: tabIcon('storefront-outline', 'storefront'),
          headerTitle: t('client.headers.epiceries'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="cartes"
        options={{
          title: t('cards.tabLabel'),
          tabBarIcon: tabIcon('wallet-outline', 'wallet'),
          headerTitle: t('cards.headerTitle'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('client.tabs.cart'),
          tabBarIcon: tabIcon('cart-outline', 'cart'),
          headerTitle: t('client.headers.cart'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          title: t('client.tabs.favorites'),
          tabBarIcon: tabIcon('heart-outline', 'heart'),
          headerTitle: t('client.headers.favorites'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t('client.tabs.profile'),
          tabBarIcon: tabIcon('person-outline', 'person'),
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
        name="search"
        options={{
          href: null,
          headerTitle: t('client.search.headerTitle') || 'Recherche',
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="order-confirmation"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
              name="aide-support"
              options={{
                href: null,
              }}
            />
      <Tabs.Screen
        name="(epicerie)"
        options={{
          href: null,
          headerTitle: t('client.headers.epiceries'),
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="cartes/[epicerieId]"
        options={{
          href: null,
          headerTitle: t('cards.headerTitle'),
        }}
      />
      <Tabs.Screen
        name="bundle/[id]"
        options={{
          href: null,  // accessible via le carousel offres
          headerShown: false,
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
          headerTitle: t('client.headers.notifications') || 'Notifications',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="invitations"
        options={{
          href: null,
          headerTitle: t('client.headers.invitations') || 'Invitations',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="factures-paiements"
        options={{
          href: null,
          headerTitle: t('client.headers.invoices') || 'Factures & Paiements',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="mon-carnet"
        options={{
          href: null,
          headerTitle: t('client.headers.myCarnet') || 'Mon carnet',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="carnet-releve"
        options={{
          href: null,
          headerTitle: t('carnet.statementTitle') || 'Relevé de compte',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerTitle: t('client.headers.settings') || 'Paramètres',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="notification-preferences"
        options={{
          href: null,
          headerTitle: t('client.headers.notificationPreferences') || 'Préférences notifications',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="(commandes)"
        options={{
          href: null,
          headerTitle: t('client.headers.orders') || 'Mes Commandes',
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="fidelite"
        options={{
          href: null,
          headerTitle: t('loyalty.title'),
          headerRight: () => <NotificationBadge />,
        }}
      />

      <Tabs.Screen
        name="fidelite-detail"
        options={{
          href: null,
          headerTitle: t('loyalty.title'),
          headerRight: () => <NotificationBadge />,
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
  return (
    <View style={{ flex: 1 }}>
      <ClientTabsContent />
    </View>
  );
}
