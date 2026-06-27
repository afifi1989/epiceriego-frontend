import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Side-effect : enregistre la tâche de localisation arrière-plan du livreur
// (TaskManager.defineTask doit s'exécuter au chargement du bundle, y compris
// quand l'OS relance l'app en mode headless pour livrer des positions).
import '../src/services/locationTrackingService';
import { ReauthModal } from '../src/components/auth/ReauthModal';
import {
  AuthFeedbackBridge,
  NetworkBanner,
  ToastProvider,
} from '../src/components/feedback';
import { CurrencyProvider } from '../src/context/CurrencyContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { ThemeProvider } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <CurrencyProvider>
            <ToastProvider>
              <AuthFeedbackBridge />
              <ReauthModal />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: '#4CAF50' },
                  headerTintColor: '#fff',
                  headerTitleStyle: { fontWeight: 'bold' },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(client)" options={{ headerShown: false }} />
                <Stack.Screen name="(epicier)" options={{ headerShown: false }} />
                <Stack.Screen name="(livreur)" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="push-diagnostic" options={{ title: 'Diagnostic Push' }} />
              </Stack>
              <NetworkBanner />
            </ToastProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
