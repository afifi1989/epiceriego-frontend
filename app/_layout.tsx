import { Stack } from 'expo-router';
import { LanguageProvider } from '../src/context/LanguageContext';
import { CurrencyProvider } from '../src/context/CurrencyContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <CurrencyProvider>
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
          <Stack.Screen name="push-diagnostic" options={{ title: 'Diagnostic Push' }} />
        </Stack>
      </CurrencyProvider>
    </LanguageProvider>
  );
}
