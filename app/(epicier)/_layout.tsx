import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function EpicierLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: '#2196F3' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📊</Text>,
          headerTitle: '📊 Dashboard',
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🛍️</Text>,
          headerTitle: '🛍️ Commandes',
        }}
      />
      <Tabs.Screen
        name="produits"
        options={{
          title: 'Produits',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📦</Text>,
          headerTitle: '📦 Mes Produits',
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👤</Text>,
          headerTitle: '👤 Mon Profil',
        }}
      />
      <Tabs.Screen
        name="parametrage"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modifier-infos"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ajouter-produit"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modifier-profil"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
