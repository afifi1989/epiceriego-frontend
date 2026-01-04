import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { registrationVerificationService } from '../../src/services/registrationVerificationService';

export default function VerifyAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string; maskedPhone?: string }>();

  // States
  const [emailOtp, setEmailOtp] = useState<string>('');
  const [smsOtp, setSmsOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [smsVerified, setSmsVerified] = useState<boolean>(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('15:00');

  // Initialize expiry timer
  useEffect(() => {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15);
    setExpiryTime(expiry);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiryTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = expiryTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('EXPIRÉ');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryTime]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  /**
   * Verifies email code
   */
  const handleVerifyEmailCode = async (): Promise<void> => {
    if (!emailOtp) {
      Alert.alert('Erreur', 'Veuillez saisir le code email');
      return;
    }

    if (emailOtp.length !== 6 || !/^\d+$/.test(emailOtp)) {
      Alert.alert('Erreur', 'Le code email doit contenir 6 chiffres');
      return;
    }

    setLoading(true);

    try {
      const response = await registrationVerificationService.verifyEmailCode(
        params.email,
        emailOtp
      );

      if (response.success && response.emailVerified) {
        setEmailVerified(true);
        Alert.alert('Succès', 'Code email vérifié !');

        if (response.bothVerified) {
          handleBothVerified();
        }
      } else {
        if (response.attemptsRemaining !== undefined) {
          setAttemptsRemaining(response.attemptsRemaining);
        }
        Alert.alert('Erreur', response.message);
      }
    } catch (error) {
      console.error('[VerifyAccount] Erreur email:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifies SMS code
   */
  const handleVerifySmsCode = async (): Promise<void> => {
    if (!smsOtp) {
      Alert.alert('Erreur', 'Veuillez saisir le code SMS');
      return;
    }

    if (smsOtp.length !== 6 || !/^\d+$/.test(smsOtp)) {
      Alert.alert('Erreur', 'Le code SMS doit contenir 6 chiffres');
      return;
    }

    setLoading(true);

    try {
      const response = await registrationVerificationService.verifySmsCode(
        params.email,
        smsOtp
      );

      if (response.success && response.smsVerified) {
        setSmsVerified(true);
        Alert.alert('Succès', 'Code SMS vérifié !');

        if (response.bothVerified) {
          handleBothVerified();
        }
      } else {
        if (response.attemptsRemaining !== undefined) {
          setAttemptsRemaining(response.attemptsRemaining);
        }
        Alert.alert('Erreur', response.message);
      }
    } catch (error) {
      console.error('[VerifyAccount] Erreur SMS:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles successful verification
   */
  const handleBothVerified = (): void => {
    Alert.alert(
      'Compte vérifié !',
      'Votre compte a été vérifié avec succès. Vous pouvez maintenant vous connecter.',
      [
        {
          text: 'Se connecter',
          onPress: () => {
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  /**
   * Resends verification codes
   */
  const handleResendCodes = async (): Promise<void> => {
    if (resendCooldown > 0) {
      Alert.alert('Info', `Veuillez attendre ${resendCooldown} secondes`);
      return;
    }

    setResendLoading(true);

    try {
      const response = await registrationVerificationService.resendVerificationCodes(
        params.email
      );

      if (response.success) {
        // Reset expiry timer
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 15);
        setExpiryTime(expiry);

        // Set cooldown
        setResendCooldown(60);

        Alert.alert('Succès', 'Codes renvoyés avec succès !');
      } else {
        if (response.resendCooldownSeconds) {
          setResendCooldown(response.resendCooldownSeconds);
        }
        Alert.alert('Erreur', response.message);
      }
    } catch (error) {
      console.error('[VerifyAccount] Erreur renvoi:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>✉️</Text>
            <Text style={styles.title}>Vérification de compte</Text>
            <Text style={styles.subtitle}>
              Saisissez les codes reçus par email et SMS
            </Text>
          </View>

          {/* Timer */}
          <View style={styles.timerBox}>
            <Text style={styles.timerLabel}>Expire dans:</Text>
            <Text style={[
              styles.timerValue,
              timeRemaining === 'EXPIRÉ' && styles.timerExpired
            ]}>
              {timeRemaining}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.emailLabel}>
              📧 Email: {params.email}
            </Text>
            {params.maskedPhone && (
              <Text style={styles.phoneLabel}>
                📱 Téléphone: {params.maskedPhone}
              </Text>
            )}

            {/* Email Code */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>Code Email</Text>
                {emailVerified && <Text style={styles.verifiedBadge}>✓ Vérifié</Text>}
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    emailVerified && styles.inputVerified
                  ]}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  value={emailOtp}
                  onChangeText={setEmailOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!emailVerified}
                />
                {!emailVerified && (
                  <TouchableOpacity
                    style={[styles.verifyButton, (loading || emailOtp.length !== 6) && styles.verifyButtonDisabled]}
                    onPress={handleVerifyEmailCode}
                    disabled={loading || emailOtp.length !== 6}
                  >
                    <Text style={styles.verifyButtonText}>Vérifier</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* SMS Code */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>Code SMS</Text>
                {smsVerified && <Text style={styles.verifiedBadge}>✓ Vérifié</Text>}
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    smsVerified && styles.inputVerified
                  ]}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  value={smsOtp}
                  onChangeText={setSmsOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!smsVerified}
                />
                {!smsVerified && (
                  <TouchableOpacity
                    style={[styles.verifyButton, (loading || smsOtp.length !== 6) && styles.verifyButtonDisabled]}
                    onPress={handleVerifySmsCode}
                    disabled={loading || smsOtp.length !== 6}
                  >
                    <Text style={styles.verifyButtonText}>Vérifier</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Info */}
            <Text style={styles.infoText}>
              ⏱️ Les codes expirent dans 15 minutes.{'\n'}
              Tentatives restantes: {attemptsRemaining}/3
            </Text>

            {/* Resend Button */}
            <TouchableOpacity
              style={[
                styles.resendButton,
                (resendLoading || resendCooldown > 0) && styles.resendButtonDisabled
              ]}
              onPress={handleResendCodes}
              disabled={resendLoading || resendCooldown > 0}
            >
              {resendLoading ? (
                <ActivityIndicator color="#4CAF50" size="small" />
              ) : (
                <Text style={styles.resendButtonText}>
                  {resendCooldown > 0
                    ? `Renvoyer les codes (${resendCooldown}s)`
                    : 'Renvoyer les codes'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.backButtonText}>← Retour à la connexion</Text>
            </TouchableOpacity>
          </View>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>
              Ne partagez jamais vos codes avec qui que ce soit
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  timerBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerLabel: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
  },
  timerValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  timerExpired: {
    color: '#ff6b6b',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  emailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 8,
  },
  phoneLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 8,
    marginTop: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  verifiedBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    backgroundColor: '#f9f9f9',
    color: '#333',
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: 'bold',
    marginRight: 10,
  },
  inputVerified: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: '#fff8dc',
    padding: 12,
    borderRadius: 10,
  },
  resendButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginBottom: 15,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  securityInfo: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  securityText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
