import { Stack } from 'expo-router';

export default function CreditLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#2196F3' },
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
