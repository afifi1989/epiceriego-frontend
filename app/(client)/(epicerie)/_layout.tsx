import { Stack } from 'expo-router';

export default function EpicierLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#2196F3' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          title: '📊 Dashboard Épicier',
          headerLeft: () => null,
        }} 
      />
    </Stack>
  );
}
