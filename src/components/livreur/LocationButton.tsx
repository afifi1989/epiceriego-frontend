import { TouchableOpacity, Text, StyleSheet, Linking, Alert } from 'react-native';

interface LocationButtonProps {
  latitude?: number;
  longitude?: number;
  address: string;
}

export const LocationButton = ({
  latitude,
  longitude,
  address,
}: LocationButtonProps) => {
  const handleOpenMap = async () => {
    if (!latitude || !longitude) {
      Alert.alert(
        'GPS non disponible',
        'Les coordonnées GPS pour cette adresse ne sont pas disponibles.'
      );
      return;
    }

    const url = `https://www.google.com/maps/search/${latitude},${longitude}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir Google Maps');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleOpenMap}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.text}>Voir sur la carte</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
