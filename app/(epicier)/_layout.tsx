export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORAGE_KEYS } from '../../src/constants/config';
import { getUserProfile } from '../../src/hooks/usePermissions';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import { epicerieService } from '../../src/services/epicerieService';
import { onboardingService } from '../../src/services/onboardingService';
import { usePathname } from 'expo-router';
import { LoginResponse } from '../../src/type';
import { NetworkProvider } from '../../src/context/NetworkContext';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';
import { NotificationBadge } from '../../components/NotificationBadge';
import { useCurrency } from '../../src/context/CurrencyContext';
import { EpicierLanguageProvider } from '../../src/context/EpicierLanguageProvider';

// Composant interne pour gérer le layout authentifié
function EpicierTabsContent({ loginData }: { loginData: LoginResponse | null }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = getUserProfile(loginData);
  const canManageLivreurs = profile === 'owner' || profile === 'manager';
  const { setCurrency } = useCurrency();

  // Charge la devise de l'épicerie connectée une fois pour toute la
  // session. Tous les écrans épicier (dashboard, produits, commandes,
  // factures…) consommeront ensuite via useCurrency() — pas besoin de
  // refetch sur chaque écran.
  useEffect(() => {
    let cancelled = false;
    epicerieService.getMyEpicerie()
      .then(epicerie => {
        if (!cancelled) setCurrency(epicerie.currency ?? null);
      })
      .catch(err => {
        // Pas bloquant — fallback "DH" via formatCurrency.
        console.warn('[EpicierLayout] Devise non chargée:', err?.message);
      });
    return () => { cancelled = true; setCurrency(null); };
  }, [setCurrency]);

  // ── Onboarding obligatoire ────────────────────────────────────────
  // Si l'epicier n'a pas complete les etapes (TYPE + CATALOGUE), on
  // redirige vers l'ecran onboarding qui occupe tout le viewport (tab bar
  // cachee, header masque). Empeche de naviguer ailleurs en pleine
  // session si l'onboarding n'est pas valide. Best-effort : si l'API
  // echoue, on laisse passer (pas de regression).
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.includes('/onboarding')) return; // deja sur l'onboarding
    let cancelled = false;
    (async () => {
      try {
        const epicerie = await epicerieService.getMyEpicerie();
        if (cancelled || !epicerie) return;
        const status = await onboardingService.getStatus(epicerie.id);
        if (cancelled) return;
        if (!status?.completed) {
          router.replace('/(epicier)/onboarding');
        }
      } catch {
        // service indisponible / 404 → ne pas bloquer
      }
    })();
    return () => { cancelled = true; };
  }, [pathname, router]);

  useEffect(() => {
    console.log('[EpicierLayout] 🎯 Mount — initializing notifications');

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

        console.log('[EpicierLayout] ✅ Notification setup complete');
      } catch (error) {
        console.error('[EpicierLayout] ❌ Error during notification setup:', error);
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
        tabBarActiveTintColor: Colors.primary,
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
        headerStyle: { backgroundColor: Colors.primary },
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
          headerRight: () => <NotificationBadge />,
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: 'Commandes',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🛍️</Text>,
          headerTitle: '🛍️ Commandes',
          headerRight: () => <NotificationBadge />,
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
        name="parametres"
        options={{
          href: null, // hub paramètres unifié — accessible depuis le profil
          title: 'Paramètres',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // accessible via le badge du dashboard
          title: 'Notifications',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="passants-a-convertir"
        options={{
          href: null,
          title: 'Passants à convertir',
          headerTitle: '🚶 Passants à convertir',
        }}
      />
      <Tabs.Screen
        name="mots-cles-recherche"
        options={{
          href: null,
          title: 'Mots-clés de recherche',
          headerTitle: '🔤 Mots-clés de recherche',
        }}
      />
      <Tabs.Screen
        name="parametres-epicerie"
        options={{
          href: null,  // accessible via le profil, pas dans la tab bar
          title: 'Paramètres épicerie',
        }}
      />
      <Tabs.Screen
        name="personnalisation-epicerie"
        options={{
          href: null,  // accessible depuis parametres-epicerie
          title: 'Personnalisation',
        }}
      />
      <Tabs.Screen
        name="aide-support"
        options={{
          href: null,  // accessible depuis "Mon compte" du profil
          title: 'Aide & Support',
        }}
      />
      <Tabs.Screen
        name="offres-paniers"
        options={{
          href: null,  // accessible depuis produits.tsx (bouton "Offres")
          title: 'Offres & paniers',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="offre-detail"
        options={{
          href: null,  // pousse depuis offres-paniers (creation + edition)
          title: 'Offre',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="modifier-infos"
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
        name="horaires"
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
        name="ajouter-promo"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stock-alerts"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="inventaire"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="inventaire-session"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cash-session"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="printer-settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cash-reports"
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
        name="finaliser-catalogue"
        options={{
          href: null,        // accessible depuis la bannière Produits/Dashboard
          headerShown: false, // header géré par l'écran (back + titre)
        }}
      />
      <Tabs.Screen
        name="commande-prep"
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
        name="promotions"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="promo-wizard"
        options={{
          href: null,
          headerShown: true,
          headerTitle: 'Nouvelle promotion',
        }}
      />
      <Tabs.Screen
        name="promo-detail"
        options={{
          href: null,
          headerShown: true,
          headerTitle: 'Détail promotion',
        }}
      />
      <Tabs.Screen
        name="codes-promos"
        options={{
          href: null,
          headerShown: true,
          headerTitle: '🏷️ Codes promos',
        }}
      />
      <Tabs.Screen
        name="code-promo-form"
        options={{
          href: null,
          headerShown: true,
          headerTitle: 'Code promo',
        }}
      />
      <Tabs.Screen
        name="fournisseurs"
        options={{
          href: null,
          headerShown: true,
          headerTitle: '🏪 Fournisseurs',
        }}
      />
      <Tabs.Screen
        name="fournisseur-form"
        options={{
          href: null,
          headerShown: true,
          headerTitle: 'Fournisseur',
        }}
      />
      <Tabs.Screen
        name="fournisseur-detail"
        options={{
          href: null,
          headerShown: true,
          headerTitle: 'Détail fournisseur',
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
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Tabs.Screen
        name="carnet-client"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          // Onboarding obligatoire : on cache completement la tab bar pour
          // que l'epicier ne puisse pas naviguer ailleurs tant qu'il n'a
          // pas valide les etapes obligatoires (TYPE + CATALOGUE).
          // Le header est aussi cache — l'ecran gere son propre layout
          // plein ecran via OnboardingStepShell.
          href: null,
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="whatsapp-settings"
        options={{
          href: null,
          headerTitle: 'WhatsApp Business',
          headerStyle: { backgroundColor: '#25D366' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Tabs.Screen
        name="fidelite"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="mon-abonnement"
        options={{
          href: null,
          headerTitle: '⭐ Mon abonnement',
          headerStyle: { backgroundColor: Colors.primary },
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
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // 🚫 Rediriger si non authentifié
  if (!isAuthenticated || userRole !== 'EPICIER') {
    console.log('[EpicierLayout] Redirection vers login - authentification manquante');
    return <Redirect href="/(auth)/login" />;
  }

  // ✅ Afficher le contenu authentifié avec support offline.
  // EpicierLanguageProvider verrouille la langue UI en français pour toute
  // la zone épicier (cohérent avec le web Angular qui est FR-only). La
  // recherche darija/arabe dans vente-directe reste fonctionnelle car elle
  // passe par la map de synonymes (helper expandAndFilter), pas par t().
  return (
    <NetworkProvider>
      <EpicierLanguageProvider>
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <EpicierTabsContent loginData={loginData} />
        </View>
      </EpicierLanguageProvider>
    </NetworkProvider>
  );
}
