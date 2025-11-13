import { View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';

interface AvailabilityToggleProps {
  isAvailable: boolean;
  onToggle: (value: boolean) => void;
  isLoading?: boolean;
  location?: { latitude: number; longitude: number } | null;
}

export const AvailabilityToggle = ({
  isAvailable,
  onToggle,
  isLoading = false,
  location,
}: AvailabilityToggleProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.textSection}>
          <Text style={styles.title}>
            {isAvailable ? '🟢 En ligne' : '🔴 Hors ligne'}
          </Text>
          <Text style={styles.subtitle}>
            {isAvailable
              ? 'Vous recevrez les nouvelles commandes'
              : 'Vous ne recevrez pas de nouvelles commandes'}
          </Text>
          {location && (
            <Text style={styles.location}>
              📍 Position GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          )}
          {!location && (
            <Text style={styles.locationWarning}>
              ⚠️ Position GPS non disponible
            </Text>
          )}
        </View>
        <View style={styles.switchContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#9C27B0" />
          ) : (
            <Switch
              value={isAvailable}
              onValueChange={onToggle}
              trackColor={{ false: '#ddd', true: '#C7A9D4' }}
              thumbColor={isAvailable ? '#9C27B0' : '#999'}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  textSection: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  location: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  locationWarning: {
    fontSize: 11,
    color: '#f44336',
    fontStyle: 'italic',
  },
  switchContainer: {
    marginLeft: 15,
  },
});
