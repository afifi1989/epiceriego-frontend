// ============================================
// app/(auth)/verify-reset-codes.tsx
// Écran de vérification des codes OTP (Email + SMS)
// ============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { passwordResetService } from '../../src/services/passwordResetService';

export default function VerifyResetCodesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();

  // États
  const [emailOtp, setEmailOtp] = useState<string>('');
  const [smsOtp, setSmsOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Vérifie les codes OTP
   */
  const handleVerifyCodes = async (): Promise<void> => {
    // Validation basique
    if (!emailOtp || !smsOtp) {
      Alert.alert('Erreur', 'Veuillez saisir les deux codes');
      return;
    }

    // Validation format (6 chiffres)
    if (emailOtp.length !== 6 || !/^\d+$/.test(emailOtp)) {
      Alert.alert('Erreur', 'Le code email doit contenir 6 chiffres');
      return;
    }

    if (smsOtp.length !== 6 || !/^\d+$/.test(smsOtp)) {
      Alert.alert('Erreur', 'Le code SMS doit contenir 6 chiffres');
      return;
    }

    if (!params.email) {
      Alert.alert('Erreur', 'Email manquant');
      return;
    }

    setLoading(true);

    try {
      console.log('[VerifyResetCodes] Vérification des codes pour:', params.email);
      const response = await passwordResetService.verifyResetCodes(
        params.email,
        emailOtp,
        smsOtp
      );

      console.log('[VerifyResetCodes] Réponse:', response);

      if (response.success && response.bothVerified) {
        Alert.alert('Succès', 'Codes vérifiés avec succès !', [
          {
            text: 'OK',
            onPress: () => {
              // Naviguer vers l'écran de nouveau mot de passe
              router.push({
                pathname: '/(auth)/reset-password',
                params: { email: params.email },
              });
            },
          },
        ]);
      } else {
        const message = response.attemptsRemaining !== undefined
          ? `${response.message}\n\nTentatives restantes: ${response.attemptsRemaining}`
          : response.message;
        Alert.alert('Erreur', message);
      }
    } catch (error) {
      console.error('[VerifyResetCodes] Erreur:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retour à l'écran précédent
   */
  const goBack = (): void => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📨</Text>
          <Text style={styles.title}>Vérification</Text>
          <Text style={styles.subtitle}>
            Saisissez les codes reçus par email et SMS
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Codes de vérification</Text>

          <Text style={styles.emailLabel}>
            📧 Email: {params.email}
          </Text>

          {/* Code Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Code reçu par Email</Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#999"
              value={emailOtp}
              onChangeText={setEmailOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoCapitalize="none"
            />
          </View>

          {/* Code SMS */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Code reçu par SMS</Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#999"
              value={smsOtp}
              onChangeText={setSmsOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoCapitalize="none"
            />
          </View>

          {/* Info */}
          <Text style={styles.infoText}>
            ⏱️ Les codes sont valables pendant 15 minutes.{'\n'}
            Vous avez 3 tentatives maximum.
          </Text>

          {/* Bouton de vérification */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyCodes}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Vérifier les codes</Text>
            )}
          </TouchableOpacity>

          {/* Bouton retour */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
          >
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
        </View>

        {/* Info sécurité */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Ne partagez jamais vos codes avec qui que ce soit
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Styles
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  emailLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: '#f0f8ff',
    padding: 10,
    borderRadius: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 20,
    backgroundColor: '#f9f9f9',
    color: '#333',
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: '#fff8dc',
    padding: 12,
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '600',
  },
  securityInfo: {
    marginTop: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  securityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
