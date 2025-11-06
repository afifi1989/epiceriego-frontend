import { Stack } from 'expo-router';
import { useLanguage } from '../../../src/context/LanguageContext';

export default function CommandesLayout() {
  const { t } = useLanguage();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#4CAF50',
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#333',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('orders.myOrders'),
          headerStyle: {
            backgroundColor: '#fff',
          },
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t('orders.detailsTitle'),
          headerStyle: {
            backgroundColor: '#fff',
          },
        }}
      />
    </Stack>
  );
}
