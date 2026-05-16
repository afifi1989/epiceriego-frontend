// ============================================
// app/(auth)/phone-otp.tsx
// Login client par numéro de téléphone + code SMS.
// 2 étapes : 1/ saisie du numéro → demande SMS, 2/ saisie du code → login.
// ============================================
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';

type Step = 'phone' | 'code';
const RESEND_COOLDOWN = 60;

export default function PhoneOtpScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const requestOtp = async () => {
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 6) {
      Alert.alert('Numéro invalide', 'Saisissez un numéro de téléphone valide');
      return;
    }
    setLoading(true);
    try {
      const result = await authService.loginPhoneOtpRequest(cleanPhone);
      if (result.token) {
        setOtpToken(result.token);
        setMaskedPhone(result.maskedPhone || cleanPhone);
        setStep('code');
        startCooldown();
      } else {
        // Réponse neutre du backend (pas de token retourné = pas de compte)
        Alert.alert(
          'Vérifiez votre téléphone',
          result.message ||
            'Si ce numéro est associé à un compte, vous recevrez un code par SMS dans quelques instants.'
        );
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Erreur';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      Alert.alert('Code incorrect', 'Le code doit contenir 6 chiffres');
      return;
    }
    if (!otpToken) {
      Alert.alert('Erreur', 'Session expirée — recommencez la procédure');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const fcmToken = await pushNotificationService.getTokenForLogin();
      const outcome = await authService.loginPhoneOtpVerify(otpToken, trimmed, fcmToken);

      if (outcome.kind === 'deviceVerificationRequired') {
        router.replace({
          pathname: '/(auth)/verify-device' as any,
          params: {
            verificationToken: outcome.data.verificationToken,
            maskedEmail: outcome.data.maskedEmail,
            deviceLabel: outcome.data.deviceLabel || '',
          },
        });
        return;
      }

      const data = outcome.data;
      if (data.mustChangePassword) router.replace('/change-password');
      else if (data.role === 'CLIENT') router.replace('/(client)');
      else router.replace('/');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Code invalide';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#1B2A4A" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (step === 'code' ? setStep('phone') : router.back())}
            activeOpacity={0.7}
          >
            <Text style={s.backBtnText}>‹ {step === 'code' ? 'Modifier le numéro' : 'Retour'}</Text>
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Text style={s.iconEmoji}>{step === 'phone' ? '📱' : '🔐'}</Text>
          </View>

          {step === 'phone' ? (
            <>
              <Text style={s.title}>Connexion par téléphone</Text>
              <Text style={s.subtitle}>
                Saisissez votre numéro et nous vous enverrons un code de connexion par SMS.
              </Text>

              <Text style={s.label}>Numéro de téléphone</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+212 6 XX XX XX XX"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                autoFocus
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[s.submitBtn, loading && s.btnDisabled]}
                onPress={requestOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>Recevoir un code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.title}>Saisissez le code reçu</Text>
              <Text style={s.subtitle}>
                Code envoyé par SMS au{'\n'}
                <Text style={s.emailHighlight}>{maskedPhone}</Text>
              </Text>

              <Text style={s.label}>Code à 6 chiffres</Text>
              <TextInput
                style={s.codeInput}
                value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor="#aaa"
                maxLength={6}
                autoFocus
              />
              <Text style={s.hint}>Code valable pendant 5 minutes — 3 tentatives max</Text>

              <TouchableOpacity
                style={[s.submitBtn, (loading || code.length !== 6) && s.btnDisabled]}
                onPress={verifyOtp}
                disabled={loading || code.length !== 6}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>Se connecter</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.resendBtn, cooldown > 0 && s.btnDisabled]}
                onPress={requestOtp}
                disabled={cooldown > 0 || loading}
                activeOpacity={0.7}
              >
                <Text style={s.resendBtnText}>
                  {cooldown > 0 ? `Renvoyer le code dans ${cooldown}s` : 'Renvoyer le code'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B2A4A' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  backBtn: { paddingVertical: 8, marginBottom: 8 },
  backBtnText: { color: '#1B2A4A', fontSize: 16, fontWeight: '500' },
  iconWrap: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  iconEmoji: { fontSize: 38 },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2A4A', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emailHighlight: { color: '#4CAF50', fontWeight: '700' },
  label: { fontSize: 14, color: '#555', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#1B2A4A',
    marginBottom: 20,
  },
  codeInput: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 10,
    fontSize: 28,
    color: '#1B2A4A',
    textAlign: 'center',
    letterSpacing: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 24 },
  submitBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { paddingVertical: 14, alignItems: 'center' },
  resendBtnText: { color: '#4CAF50', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
