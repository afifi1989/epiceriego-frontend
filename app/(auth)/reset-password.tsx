// ============================================
// app/(auth)/reset-password.tsx
// Écran de saisie du nouveau mot de passe
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();

  // États
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  /**
   * Réinitialise le mot de passe
   */
  const handleResetPassword = async (): Promise<void> => {
    // Validation basique
    if (!newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    // Vérifier la longueur minimale
    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    // Vérifier que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (!params.email) {
      Alert.alert('Erreur', 'Email manquant');
      return;
    }

    setLoading(true);

    try {
      console.log('[ResetPassword] Réinitialisation pour:', params.email);
      const response = await passwordResetService.resetPassword(
        params.email,
        newPassword
      );

      console.log('[ResetPassword] Réponse:', response);

      if (response.success) {
        Alert.alert(
          'Succès',
          'Votre mot de passe a été réinitialisé avec succès !',
          [
            {
              text: 'OK',
              onPress: () => {
                // Retourner à la page de connexion
                router.replace('/(auth)/login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Erreur', response.message || 'Erreur lors de la réinitialisation');
      }
    } catch (error) {
      console.error('[ResetPassword] Erreur:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcule la force du mot de passe
   */
  const getPasswordStrength = (): { text: string; color: string; width: string } => {
    if (newPassword.length === 0) {
      return { text: '', color: '#ddd', width: '0%' };
    }

    let strength = 0;

    if (newPassword.length >= 6) strength++;
    if (newPassword.length >= 8) strength++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++;
    if (/\d/.test(newPassword)) strength++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) strength++;

    if (strength <= 2) {
      return { text: 'Faible', color: '#e74c3c', width: '33%' };
    } else if (strength <= 3) {
      return { text: 'Moyen', color: '#f39c12', width: '66%' };
    } else {
      return { text: 'Fort', color: '#2ecc71', width: '100%' };
    }
  };

  const strength = getPasswordStrength();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🔑</Text>
          <Text style={styles.title}>Nouveau mot de passe</Text>
          <Text style={styles.subtitle}>
            Choisissez un mot de passe sécurisé
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Réinitialisation</Text>

          <Text style={styles.emailLabel}>
            📧 Email: {params.email}
          </Text>

          {/* Nouveau mot de passe */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Min. 6 caractères"
                placeholderTextColor="#999"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Indicateur de force */}
            {newPassword.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarBg}>
                  <View
                    style={[
                      styles.strengthBar,
                      { width: strength.width, backgroundColor: strength.color },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strength.color }]}>
                  {strength.text}
                </Text>
              </View>
            )}
          </View>

          {/* Confirmation mot de passe */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
            <TextInput
              style={styles.input}
              placeholder="Retapez le mot de passe"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          {/* Conseils de sécurité */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 Conseils :</Text>
            <Text style={styles.tip}>• Au moins 6 caractères</Text>
            <Text style={styles.tip}>• Mélangez majuscules et minuscules</Text>
            <Text style={styles.tip}>• Ajoutez des chiffres et symboles</Text>
          </View>

          {/* Bouton de réinitialisation */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Réinitialiser le mot de passe</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Info sécurité */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>✅</Text>
          <Text style={styles.securityText}>
            Codes vérifiés avec succès
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
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 15,
  },
  eyeIcon: {
    fontSize: 20,
  },
  strengthContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#ddd',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10,
  },
  strengthBar: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    width: 60,
  },
  tipsContainer: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  tip: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
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
