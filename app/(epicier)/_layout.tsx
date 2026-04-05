import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../src/constants/config';
import { getUserProfile } from '../../src/hooks/usePermissions';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import { LoginResponse } from '../../src/type';

// Composant interne pour gérer le layout authentifié
function EpicierTabsContent({ loginData }: { loginData: LoginResponse | null }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = getUserProfile(loginData);
  const canManageLivreurs = profile === 'owner' || profile === 'manager';

  // ✅ Initialiser les push notifications pour les épiciers authentifiés
  useEffect(() => {
    console.log('[EpicierLayout] 🎯 EpicierLayout component mounted - Initializing notifications');

    const setupNotifications = async () => {
      try {
        // Petit délai pour s'assurer que le composant est complètement monté
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[EpicierLayout] 1️⃣ Setting foreground handler');
        await pushNotificationService.setForegroundNotificationHandler();

        console.log('[EpicierLayout] 2️⃣ Setup notification categories');
        await pushNotificationService.setupNotificationCategories();

        console.log('[EpicierLayout] 3️⃣ Register for push notifications');
        const token = await pushNotificationService.registerForPushNotifications();
        console.log('[EpicierLayout] Token received:', token);

        if (token) {
          console.log('[EpicierLayout] 4️⃣ Send token to server');
          const success = await pushNotificationService.sendTokenToServer(token);
          console.log('[EpicierLayout] Send result:', success);

          if (!success) {
            console.log('[EpicierLayout] ⚠️ Token saved locally, will retry later');
          }

          console.log('[EpicierLayout] 5️⃣ Retry pending tokens');
          await pushNotificationService.retryPendingToken();
        } else {
          console.error('[EpicierLayout] ❌ No token received!');
        }

        console.log('[EpicierLayout] 6️⃣ Setup notification handlers');
        pushNotificationService.setupNotificationHandlers(router);

        console.log('[EpicierLayout] ✅ All notification setup complete');
      } catch (error) {
        console.error('[EpicierLayout] ❌ Error during notification setup:', error);
        if (error instanceof Error) {
          console.error('[EpicierLayout] Error message:', error.message);
          console.error('[EpicierLayout] Stack:', error.stack);
        }
      }
    };

    setupNotifications();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
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
        headerStyle: { backgroundColor: '#2196F3' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>📊</Text>,
          headerTitle: '📊 Dashboard',
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: 'Commandes',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🛍️</Text>,
          headerTitle: '🛍️ Commandes',
        }}
      />
      <Tabs.Screen
        name="clients-list"
        options={{
          title: 'Clients',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>👥</Text>,
          headerTitle: '👥 Mes Clients',
        }}
      />
      <Tabs.Screen
        name="livreurs"
        options={{
          title: 'Livreurs',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🚚</Text>,
          headerTitle: '🚚 Gérer les Livreurs',
          href: canManageLivreurs ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>👤</Text>,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="parametrage"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modifier-infos"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ajouter-produit"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modifier-profil"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modifier-produit"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="horaires"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="zones-livraison"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="details-commande"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ajouter-modifier-produit"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ajouter-promo"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ajuster-stock"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="produits"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="commande-prep"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="commandes-list"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="commande-summary"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="factures"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="inviter-clients"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="historique-invitations"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modifier-promo"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="produit-detail"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
              name="statistiques"
              options={{
                href: null,
              }}
            />

      <Tabs.Screen
                          name="preparer-commande"
                          options={{
                            href: null,
                          }}
                        />
      <Tabs.Screen
        name="scan-qr"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="approvisionnement"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="fiche-produit"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="vente-directe"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="collaborateurs"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profil-epicerie"
        options={{
          href: null,
          headerTitle: '🏪 Mon Épicerie',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Tabs>
  );
}

// Composant principal avec vérification d'authentification
export default function EpicierLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);

  // 🔐 Vérifier l'authentification AVANT d'afficher le layout
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);

        // Si pas de token ou pas le bon rôle → rediriger vers login
        if (!token || role !== 'EPICIER') {
          console.error('[EpicierLayout] ❌ ACCÈS NON AUTORISÉ - Token ou rôle invalide');
          setIsAuthenticated(false);
          setUserRole(role);
          return;
        }

        // Charger les données login pour les permissions
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (raw) setLoginData(JSON.parse(raw));

        console.log('[EpicierLayout] ✅ Authentification valide');
        setIsAuthenticated(true);
        setUserRole(role);
      } catch (error) {
        console.error('[EpicierLayout] ❌ Erreur vérification auth:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // 🔄 Afficher un loader pendant la vérification
  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // 🚫 Rediriger si non authentifié
  if (!isAuthenticated || userRole !== 'EPICIER') {
    console.log('[EpicierLayout] Redirection vers login - authentification manquante');
    return <Redirect href="/(auth)/login" />;
  }

  // ✅ Afficher le contenu authentifié
  return <EpicierTabsContent loginData={loginData} />;
}
