import { Colors } from '../../../../src/constants/colors';
import { Stack } from 'expo-router';

export default function CreditLayout() {
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
          title: 'Gestion Crédit',
          headerTitle: '💳 Gestion Crédit Client',
        }}
      />
    </Stack>
  );
}
