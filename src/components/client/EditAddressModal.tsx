/**
 * EditAddressModal — Ajout / modification de l'adresse postale du user.
 *
 * Contrairement au telephone qui necessite un OTP (preuve de possession),
 * l'adresse est purement declarative : on l'enregistre directement via
 * PUT /api/users/profile. Un bouton "Utiliser ma position" permet de
 * pre-remplir via expo-location + reverse geocoding (best-effort,
 * fallback texte libre).
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GeocodingError, geocodingService } from '../../services/geocodingService';
import { profileService } from '../../services/profileService';
import { User } from '../../type';

const GREEN = '#4CAF50';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentAddress?: string;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  onSuccess: (updatedUser: User) => void;
}

export function EditAddressModal({
  visible,
  onClose,
  currentAddress,
  currentLatitude,
  currentLongitude,
  onSuccess,
}: Props) {
  const [address, setAddress] = useState(currentAddress ?? '');
  const [latitude, setLatitude] = useState<number | null>(currentLatitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(currentLongitude ?? null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const resetAndClose = () => {
    setAddress(currentAddress ?? '');
    setLatitude(currentLatitude ?? null);
    setLongitude(currentLongitude ?? null);
    setSaving(false);
    setLocating(false);
    setGeocoding(false);
    onClose();
  };

  /**
   * Geocode l'adresse tapee via le backend (POST /api/geocode). Regle
   * « GPS obligatoire pour la livraison par zone » : une adresse de profil
   * qui porte lat/lng evite de redemander la position a chaque commande —
   * le panier reutilise ces coordonnees via « Mon adresse ».
   */
  const handleLocateAddress = async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      Alert.alert('Erreur', "Saisissez d'abord une adresse a localiser.");
      return;
    }
    setGeocoding(true);
    try {
      const result = await geocodingService.geocode(trimmed);
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      if (result.formattedAddress) setAddress(result.formattedAddress);
    } catch (err: any) {
      const unavailable = err instanceof GeocodingError && err.code === 'UNAVAILABLE';
      Alert.alert(
        'Localisation impossible',
        unavailable
          ? "Le service de localisation d'adresse est indisponible — utilisez « Utiliser ma position actuelle »."
          : 'Adresse introuvable. Precisez la ville et le quartier, ou utilisez votre position actuelle.'
      );
    } finally {
      setGeocoding(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      // Lazy import : evite le crash si expo-location n'est pas linke
      // sur un build particulier (dev client, web, etc.).
      const Location = await import('expo-location');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusee',
          "Vous pouvez saisir l'adresse manuellement ci-dessous."
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lng } = position.coords;
      setLatitude(lat);
      setLongitude(lng);

      // Reverse geocoding — fail-safe, on ecrase seulement si on recupere
      // qqch d'utilisable, sinon on laisse le user completer.
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (results && results.length > 0) {
          const r = results[0];
          const parts = [
            r.streetNumber,
            r.street,
            r.postalCode,
            r.city,
            r.country,
          ].filter(Boolean);
          if (parts.length > 0) {
            setAddress(parts.join(', '));
          }
        }
      } catch {
        // Reverse geocoding pas dispo (offline, quota) — on garde les coords
        // et l'utilisateur tape l'adresse a la main.
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de recuperer votre position.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      Alert.alert('Erreur', 'Saisissez une adresse.');
      return;
    }
    setSaving(true);

    // Geocodage automatique a la saisie (best-effort) : si l'utilisateur n'a
    // ni utilise sa position ni localise l'adresse, on tente de geocoder le
    // texte pour que l'adresse enregistree porte TOUJOURS des coordonnees
    // exploitables par la livraison par zones. En cas d'echec on sauvegarde
    // quand meme (adresse declarative) — le panier redemandera une position.
    let lat = latitude;
    let lng = longitude;
    if (lat == null || lng == null) {
      try {
        const result = await geocodingService.geocode(trimmed);
        lat = result.latitude;
        lng = result.longitude;
        setLatitude(lat);
        setLongitude(lng);
      } catch {
        // Service indisponible ou adresse introuvable : pas bloquant ici.
      }
    }

    try {
      const payload: Partial<User> = { adresse: trimmed };
      // On envoie lat/lng uniquement si on en a (sinon on ne touche pas a
      // ceux deja stockes cote backend — evite de ramener un user a 0,0).
      if (lat != null && lng != null) {
        payload.latitude = lat;
        payload.longitude = lng;
      }
      const updated = await profileService.updateProfile(payload);
      onSuccess(updated);
      Alert.alert('Adresse mise a jour', 'Vos nouvelles coordonnees ont ete enregistrees.');
      resetAndClose();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err
        : err?.response?.data?.message || err?.message || 'Mise a jour impossible';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Adresse postale</Text>
            <TouchableOpacity onPress={resetAndClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.helpText}>
              Indiquez votre adresse de livraison principale. Vous pouvez la
              saisir manuellement ou utiliser votre position actuelle.
            </Text>

            <TouchableOpacity
              style={[styles.locationBtn, locating && styles.btnDisabled]}
              onPress={handleUseCurrentLocation}
              disabled={locating || saving}
            >
              {locating ? (
                <ActivityIndicator color={GREEN} />
              ) : (
                <>
                  <Ionicons name="location" size={18} color={GREEN} />
                  <Text style={styles.locationBtnText}>Utiliser ma position actuelle</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Adresse complete</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={address}
              onChangeText={(v) => {
                setAddress(v);
                // L'adresse a change : les anciennes coordonnees ne la
                // decrivent plus — on les invalide pour forcer une nouvelle
                // localisation (GPS, geocodage bouton, ou geocodage au save).
                setLatitude(null);
                setLongitude(null);
              }}
              placeholder="Ex: 12 rue de la Paix, 75002 Paris"
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!saving}
            />

            <TouchableOpacity
              style={[styles.locationBtn, (geocoding || saving) && styles.btnDisabled]}
              onPress={handleLocateAddress}
              disabled={geocoding || locating || saving}
            >
              {geocoding ? (
                <ActivityIndicator color={GREEN} />
              ) : (
                <>
                  <Ionicons name="map" size={18} color={GREEN} />
                  <Text style={styles.locationBtnText}>Localiser cette adresse</Text>
                </>
              )}
            </TouchableOpacity>

            {latitude != null && longitude != null && (
              <View style={styles.coordsBox}>
                <Ionicons name="navigate" size={14} color="#666" />
                <Text style={styles.coordsText}>
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </Text>
                <TouchableOpacity
                  onPress={() => { setLatitude(null); setLongitude(null); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, (saving || !address.trim()) && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving || !address.trim()}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Enregistrer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#222' },
  body: { padding: 18, gap: 14 },
  helpText: { fontSize: 14, color: '#555', lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
    fontSize: 15,
    color: '#222',
  },
  inputMulti: { minHeight: 80 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: GREEN,
    backgroundColor: '#F1F8E9',
  },
  locationBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  coordsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  coordsText: { fontSize: 12, color: '#666', fontWeight: '500' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
