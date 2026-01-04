// ============================================
// app/(auth)/forgot-password.tsx
// Écran de demande de réinitialisation de mot de passe
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
import { useRouter } from 'expo-router';
import { passwordResetService } from '../../src/services/passwordResetService';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  // États
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Envoie les codes OTP
   */
  const handleSendCodes = async (): Promise<void> => {
    // Validation basique
    if (!email) {
      Alert.alert('Erreur', 'Veuillez saisir votre email');
      return;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Email invalide');
      return;
    }

    setLoading(true);

    try {
      console.log('[ForgotPassword] Envoi des codes pour:', email);
      const response = await passwordResetService.initiatePasswordReset(email);

      console.log('[ForgotPassword] Réponse:', response);

      if (response.success) {
        // Afficher les informations sur les codes envoyés
        const message = `Codes envoyés avec succès !\n\n` +
          `Email: ${response.emailSent ? '✅ Envoyé' : '❌ Échec'}\n` +
          `SMS: ${response.smsSent ? '✅ Envoyé' : '❌ Échec'}\n\n` +
          `Téléphone: ${response.maskedPhone}\n` +
          `Expiration: ${response.expiryMinutes} minutes`;

        Alert.alert('Codes envoyés', message, [
          {
            text: 'OK',
            onPress: () => {
              // Naviguer vers l'écran de vérification
              router.push({
                pathname: '/(auth)/verify-reset-codes',
                params: { email },
              });
            },
          },
        ]);
      } else {
        Alert.alert('Erreur', response.message || 'Erreur lors de l\'envoi des codes');
      }
    } catch (error) {
      console.error('[ForgotPassword] Erreur:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retour à la page de connexion
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
          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>
            Saisissez votre email pour recevoir les codes de vérification
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Réinitialisation</Text>

          <Text style={styles.infoText}>
            Vous recevrez un code par email ET un code par SMS.{'\n'}
            Les deux codes seront nécessaires pour réinitialiser votre mot de passe.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Bouton d'envoi */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendCodes}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Envoyer les codes</Text>
            )}
          </TouchableOpacity>

          {/* Bouton retour */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
          >
            <Text style={styles.backButtonText}>← Retour à la connexion</Text>
          </TouchableOpacity>
        </View>

        {/* Info sécurité */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Double vérification pour plus de sécurité
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
  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
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
