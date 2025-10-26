// ============================================
// app/index.tsx - CORRIGÉ POUR LA DÉCONNEXION
// ============================================
import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { authService } from '../src/services/authService';

export default function Index() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    
    // Écouter les changements de focus pour revalider l'auth
    const interval = setInterval(() => {
      checkAuth();
    }, 1000); // Vérifie toutes les secondes

    return () => clearInterval(interval);
  }, []);

  const checkAuth = async (): Promise<void> => {
    try {
      const authenticated = await authService.isAuthenticated();
      const role = await authService.getUserRole();
      
      setIsAuthenticated(authenticated);
      setUserRole(role);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setUserRole(null);
    } finally {
      setIsChecking(false);
    }
  };

  // Écran de chargement
  if (isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Redirection selon l'état auth et le rôle
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userRole === 'CLIENT') {
    return <Redirect href="/(client)" />;
  } else if (userRole === 'EPICIER') {
    return <Redirect href="/(epicier)" />;
  } else if (userRole === 'LIVREUR') {
    return <Redirect href="/(livreur)/deliveries" />;
  }

  // Fallback
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});