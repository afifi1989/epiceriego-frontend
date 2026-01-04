import { Stack } from 'expo-router';

/**
 * Layout pour les recharges téléphoniques
 * Utilise Stack pour éviter d'apparaître dans le menu Tabs parent
 */
export default function RechargesLayout() {
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
          title: 'Sélectionner un opérateur',
        }}
      />
      <Stack.Screen
        name="offers"
        options={{
          headerShown: false, // Le dossier offers a ses propres écrans
        }}
      />
      <Stack.Screen
        name="confirm"
        options={{
          title: 'Confirmer la recharge',
        }}
      />
    </Stack>
  );
}
