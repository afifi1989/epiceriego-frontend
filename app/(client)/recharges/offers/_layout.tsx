import { Stack } from 'expo-router';

/**
 * Layout pour les offres de recharge
 */
export default function OffersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="[epicerieId]"
        options={{
          title: 'Sélectionner une offre',
        }}
      />
    </Stack>
  );
}
