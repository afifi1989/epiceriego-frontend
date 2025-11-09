import { Stack } from 'expo-router';

export default function CommandesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="commandes" />
      <Stack.Screen
        name="details-commande"
        options={{
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
