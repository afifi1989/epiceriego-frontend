import { Colors } from '../../../src/constants/colors';
import { Stack } from 'expo-router';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Détails Client',
          headerTitle: '👤 Détails Client',
        }}
      />
      <Stack.Screen
        name="credit"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
