import { Pressable, Platform, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';
import { useLanguage } from '../../src/context/LanguageContext';

export function showAlert(title: any, message: any, buttons: any) {
  if (Platform.OS === 'web') {
    const confirmResult = window.confirm(`${title}\n\n${message}`);
    if (confirmResult && buttons) {
      const confirmButton = buttons.find((b: any) => b.style === 'destructive' || b.text === 'OK');
      confirmButton?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}

export default function LogoutButton() {
  const router = useRouter();
  const { t } = useLanguage();

  const handleLogout = () => {
    console.log('handleLogout appelé');
    showAlert(t('settings.logout'), t('orders.confirmLogout'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            console.log('Déconnexion en cours...');
            await authService.logout();
            console.log('Déconnexion réussie');
            
            // Force la navigation vers login
            router.replace('/(auth)/login');
            
            // Actualise la page racine après un court délai
            setTimeout(() => {
              router.replace('/');
            }, 100);
          } catch (error) {
            console.error('Erreur déconnexion:', error);
          }
        },
      },
    ]);
  };

  return (
    <Pressable onPress={handleLogout} style={{ marginRight: 15 }}>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
        {t('settings.logout')}
      </Text>
    </Pressable>
  );
}