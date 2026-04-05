import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/constants/config';
import { authService } from '../../src/services/authService';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(newPassword);

      // Récupérer le rôle pour rediriger vers le bon espace
      const role = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
      Alert.alert('Succès', 'Mot de passe modifié. Bienvenue !', [
        {
          text: 'OK',
          onPress: () => {
            if (role === 'EPICIER' || role === 'COLLABORATEUR') {
              router.replace('../(epicier)/dashboard');
            } else if (role === 'LIVREUR') {
              router.replace('/(livreur)/deliveries');
            } else {
              router.replace('/(client)');
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de modifier le mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>🔐</Text>
        </View>

        <Text style={styles.title}>Définir votre mot de passe</Text>
        <Text style={styles.subtitle}>
          Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer.
        </Text>

        {/* Nouveau mot de passe */}
        <Text style={styles.label}>Nouveau mot de passe *</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimum 8 caractères"
            secureTextEntry={!showNew}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showNew ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Confirmation */}
        <Text style={styles.label}>Confirmer le mot de passe *</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Répétez votre mot de passe"
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Confirmer</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  iconBox: {
    alignSelf: 'center', width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: { fontSize: 36 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    marginBottom: 16, paddingHorizontal: 12,
  },
  input: { flex: 1, height: 48, fontSize: 15, color: '#1a1a2e' },
  eyeBtn: { padding: 8 },
  eyeText: { fontSize: 18 },
  btn: {
    backgroundColor: '#2196F3', borderRadius: 10,
    height: 50, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
