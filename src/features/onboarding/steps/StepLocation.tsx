/**
 * StepLocation — Étape "Localisation GPS" du wizard d'onboarding.
 *
 * Flow :
 *  1. À l'ouverture, on tente l'auto-détection (avec permission).
 *  2. L'épicier voit les coordonnées détectées et peut les ajuster.
 *  3. Le wizard appelle submit() qui PUT /epiceries/my-epicerie.
 *
 * Pas d'aperçu carte pour l'instant — l'architecture est prête à
 * accueillir un <MapPreview lat={lat} lng={lng} /> sans toucher au
 * flow (Leaflet ou react-native-maps, selon décision future).
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { epicerieService } from '../../../services/epicerieService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

export const StepLocation = forwardRef<StepHandle, StepProps>(
  function StepLocation({ epicerie, busy }, ref) {
    const [latitude, setLatitude] = useState<string>(
      epicerie.latitude != null ? String(epicerie.latitude) : '',
    );
    const [longitude, setLongitude] = useState<string>(
      epicerie.longitude != null ? String(epicerie.longitude) : '',
    );
    const [detecting, setDetecting] = useState(false);

    // Auto-détection au mount uniquement si aucune coordonnée n'est
    // déjà enregistrée — sinon on respecte ce que l'épicier a saisi.
    useEffect(() => {
      if (epicerie.latitude == null && epicerie.longitude == null) {
        detectLocation();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const detectLocation = async () => {
      setDetecting(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Autorisation requise',
            'Activez la localisation pour détecter automatiquement votre position. ' +
            'Vous pouvez aussi saisir les coordonnées manuellement.',
          );
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      } catch (err) {
        console.warn('[StepLocation] detect failed:', err);
        Alert.alert(
          'Détection impossible',
          'Impossible de récupérer votre position. Saisissez les coordonnées manuellement.',
        );
      } finally {
        setDetecting(false);
      }
    };

    useImperativeHandle(ref, () => ({
      async submit() {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (Number.isNaN(lat) || lat < -90 || lat > 90) {
          Alert.alert('Latitude invalide', 'Entre -90 et 90.');
          return false;
        }
        if (Number.isNaN(lng) || lng < -180 || lng > 180) {
          Alert.alert('Longitude invalide', 'Entre -180 et 180.');
          return false;
        }
        try {
          await epicerieService.updateMyEpicerie({ latitude: lat, longitude: lng });
          return true;
        } catch (err: any) {
          Alert.alert('Erreur', err?.message ?? 'Sauvegarde impossible');
          return false;
        }
      },
    }));

    return (
      <View>
        {/* ── Bouton détection auto ── */}
        <TouchableOpacity
          style={styles.detectBtn}
          onPress={detectLocation}
          disabled={detecting || busy}
          activeOpacity={0.8}
        >
          {detecting ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.detectIcon}>📡</Text>
          )}
          <Text style={styles.detectText}>
            {detecting ? 'Détection en cours…' : 'Détecter ma position'}
          </Text>
        </TouchableOpacity>

        {/* ── Coordonnées manuelles ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={latitude}
            onChangeText={setLatitude}
            placeholder="Ex : 33.5731"
            placeholderTextColor="#9aa3ad"
            keyboardType="numbers-and-punctuation"
            editable={!busy}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={longitude}
            onChangeText={setLongitude}
            placeholder="Ex : -7.5898"
            placeholderTextColor="#9aa3ad"
            keyboardType="numbers-and-punctuation"
            editable={!busy}
          />
        </View>

        {/* ── Hint ── */}
        <View style={styles.hintBox}>
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={styles.hintText}>
            Une position GPS précise aide vos clients à vous trouver et
            permet aux livreurs d'optimiser leurs trajets.
          </Text>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    marginBottom: space.xl,
  },
  detectIcon: { fontSize: 18 },
  detectText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  field: { marginBottom: space.md + 2 },
  label: {
    ...typography.caption,
    color: colors.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hintBox: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radii.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  hintIcon: { fontSize: 16 },
  hintText: {
    flex: 1,
    ...typography.caption,
    color: colors.textMuted,
  },
});
