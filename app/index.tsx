// ============================================
// app/index.tsx - FIX AUTHENTIFICATION
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { STORAGE_KEYS } from '../src/constants/config';
import { clientOnboardingService } from '../src/services/clientOnboardingService';

export default function Index() {
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [initialCheckComplete, setInitialCheckComplete] = useState<boolean>(false);
  /** True dès que l'onboarding client a été complété sur ce device. Mesuré
   *  une fois au mount; pas de polling (changements internes redirigeront
   *  via router.replace). */
  const [onboardingDone, setOnboardingDone] = useState<boolean>(true);

  // ⚠️ NE PAS initialiser les push notifications ici !
  // Elles seront initialisées APRÈS authentification dans le role layout
  // usePushNotifications();

  const clearAllAuthData = useCallback(async (): Promise<void> => {
    try {
      console.log('[Index] 🗑️  Effacement complet de AsyncStorage...');
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.ROLE,
      ]);
      console.log('[Index] ✅ AsyncStorage complètement nettoyé');
    } catch (error) {
      console.error('[Index] ❌ Erreur lors du nettoyage:', error);
    }
  }, []);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      console.log('[Index] ===== VÉRIFICATION AUTH =====');

      // 1️⃣ Vérifier si un token valide existe
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      console.log('[Index] Token présent?:', !!token);

      if (!token) {
        // ❌ PAS DE TOKEN = NETTOYER TOUT
        console.log('[Index] ⚠️  Pas de token! Nettoyage COMPLET de AsyncStorage...');

        // Supprimer TOUS les éléments de stockage
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.TOKEN,
          STORAGE_KEYS.USER,
          STORAGE_KEYS.ROLE,
        ]);

        console.log('[Index] ✅ AsyncStorage nettoyé');
        setIsAuthenticated(false);
        setUserRole(null);
      } else {
        // ✅ TOKEN EXISTE = Récupérer le rôle
        const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
        console.log('[Index] ✅ Token valide trouvé');
        console.log('[Index] Rôle récupéré:', role);

        if (role) {
          setIsAuthenticated(true);
          setUserRole(role);
        } else {
          // Token existe mais pas de rôle? Forcer logout
          console.warn('[Index] ⚠️  Token présent mais pas de rôle! Logout...');
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.TOKEN,
            STORAGE_KEYS.USER,
            STORAGE_KEYS.ROLE,
          ]);
          setIsAuthenticated(false);
          setUserRole(null);
        }
      }

      console.log('[Index] État final:', {
        authenticated: !!(token && await AsyncStorage.getItem(STORAGE_KEYS.ROLE)),
        role: await AsyncStorage.getItem(STORAGE_KEYS.ROLE),
      });

      // Only set isChecking to false on the FIRST check
      if (isChecking) {
        setIsChecking(false);
      }
    } catch (error) {
      console.error('[Index] ❌ Auth check error:', error);
      setIsAuthenticated(false);
      setUserRole(null);
      if (isChecking) {
        setIsChecking(false);
      }
    }
  }, [isChecking, clearAllAuthData]);

  useEffect(() => {
    const performInitialCheck = async () => {
      console.log('[Index] ===== INITIAL AUTH CHECK =====');

      try {
        // ⚠️ FORCER LE NETTOYAGE COMPLET AU DÉMARRAGE
        // Cette ligne nettoie toutes les données au premier démarrage après réinstallation
        console.log('[Index] 🧹 Nettoyage des données AsyncStorage au démarrage...');
        console.log('[Index] 📌 IMPORTANT: Les données persistantes ont été supprimées');
        console.log('[Index] 📌 L\'app redirigera vers la page de login');
        await clearAllAuthData();

        // Afficher un résumé pour le débogage
        console.log('[Index] ℹ️  Pour accéder aux outils de débogage, tapez dans la console:');
        console.log('[Index] ℹ️  debugStorage.printAuthKeys() - Afficher l\'état auth');
        console.log('[Index] ℹ️  debugStorage.clearAllAuth() - Nettoyer les données d\'auth');
        console.log('[Index] ℹ️  debugStorage.setTestUser(\'CLIENT\') - Ajouter un utilisateur de test');

        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);

        console.log('[Index] Token en AsyncStorage:', !!token);
        console.log('[Index] Rôle en AsyncStorage:', role);

        // Vérifier si les données sont complètes
        if (token && role) {
          console.log('[Index] ✅ Token ET rôle présents - Authentification valide');
          setIsAuthenticated(true);
          setUserRole(role);
        } else {
          console.log('[Index] ⚠️ Données incomplètes - Nettoyage et redirection login');
          // Données incomplètes = nettoyage complet
          await clearAllAuthData();
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (error) {
        console.error('[Index] ❌ Erreur lors du check initial:', error);
        await clearAllAuthData();
        setIsAuthenticated(false);
        setUserRole(null);
      }

      // Vérifie le flag d'onboarding client en parallèle. Le routing
      // ci-dessous fera la décision finale en fonction du rôle ET de ce flag.
      try {
        const done = await clientOnboardingService.isCompleted();
        setOnboardingDone(done);
      } catch {
        // Si le storage est inaccessible, on considère done=true pour ne pas
        // bloquer l'utilisateur sur l'onboarding.
        setOnboardingDone(true);
      }

      setInitialCheckComplete(true);
    };

    performInitialCheck();

    // Écouter les changements de focus pour revalider l'auth
    const interval = setInterval(() => {
      checkAuth();
    }, 5000); // Vérifie toutes les 5 secondes

    return () => clearInterval(interval);
  }, [checkAuth, clearAllAuthData]);

  // Écran de chargement - Always wait for initial check
  if (!initialCheckComplete) {
    console.log('[Index] Attente de la vérification initiale...');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  console.log('[Index] Rendre selon l\'authentification:', {
    isAuthenticated,
    userRole,
    initialCheckComplete
  });

  // Redirection selon l'état auth et le rôle
  // IMPORTANT: Check NOT authenticated FIRST to prevent any role-based redirect
  if (!isAuthenticated || !userRole) {
    console.log('[Index] Redirection vers select-role (authentification manquante)');
    return <Redirect href="/(auth)/select-role" />;
  }

  // Now check the role
  if (userRole === 'CLIENT') {
    // 1ère ouverture par un client → onboarding 3 écrans (langue / géoloc /
    // catégories favorites). Une fois fait, on ne le re-déclenche plus
    // (flag persisté côté device, indépendant de la session).
    if (!onboardingDone) {
      console.log('[Index] Redirection vers onboarding client (1ère ouverture)');
      return <Redirect href="/onboarding" />;
    }
    console.log('[Index] Redirection vers client');
    return <Redirect href="/(client)" />;
  } else if (userRole === 'EPICIER') {
    console.log('[Index] Redirection vers epicier');
    return <Redirect href="/(epicier)" />;
  } else if (userRole === 'LIVREUR') {
    console.log('[Index] Redirection vers livreur');
    return <Redirect href="/(livreur)/deliveries" />;
  }

  // Fallback - Should never reach here, but just in case
  console.log('[Index] Fallback vers select-role (role inconnu)');
  return <Redirect href="/(auth)/select-role" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});