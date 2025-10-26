import { Stack } from 'expo-router';
import { TouchableOpacity, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';

export default function LivreurLayout() {
  const router = useRouter();

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