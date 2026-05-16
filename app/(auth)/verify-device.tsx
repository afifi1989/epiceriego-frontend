// ============================================
// app/(auth)/verify-device.tsx
// Écran de validation d'un nouveau device par OTP email.
// Atteint après une réponse 202 du backend lors d'un login depuis un device
// non-trusted (login standard, Google ou phone-OTP).
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';

const RESEND_COOLDOWN = 60; // seconds, aligné sur le backend

export default function VerifyDeviceScreen() {
  const router = useRouter();
  const { verificationToken, maskedEmail, deviceLabel } = useLocalSearchParams<{
    verificationToken: string;
    maskedEmail: string;
    deviceLabel?: string;
  }>();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Envoie automatique du code à l'arrivée + démarre le countdown
  useEffect(() => {
    if (!verificationToken) {
      Alert.alert('Erreur', 'Session de validation invalide', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    sendCode(true);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const sendCode = async (silent = false) => {
    if (!verificationToken) return;
    setSending(true);
    try {
      await authService.sendDeviceEmailOtp(verificationToken);
      startCooldown();
      if (!silent) Alert.alert('Code envoyé', 'Vérifiez votre boîte de réception');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Erreur d\'envoi';
      if (silent) {
        // Auto-send au mount peut échouer si cooldown encore actif côté serveur
        // (l'utilisateur vient d'arriver sur l'écran). Ne pas Alert, juste démarrer le cooldown.
        startCooldown();
      } else {
        Alert.alert('Erreur', msg);
      }
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      Alert.alert('Code incorrect', 'Le code doit contenir 6 chiffres');
      return;
    }
    if (!verificationToken) return;

    setLoading(true);
    try {
      const fcmToken = await pushNotificationService.getTokenForLogin();
      const data = await authService.verifyDeviceOtp(verificationToken, trimmed, fcmToken);

      // Naviguer selon le rôle (CLIENT par défaut pour cette feature)
      if (data.mustChangePassword) router.replace('/change-password');
      else if (data.role === 'CLIENT') router.replace('/(client)');
      else if (data.role === 'EPICIER') router.replace('/(epicier)/dashboard' as any);
      else if (data.role === 'LIVREUR') router.replace('/(livreur)/deliveries');
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
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.backBtnText}>‹ Retour</Text>
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Text style={s.iconEmoji}>📧</Text>
          </View>

          <Text style={s.title}>Validation d'appareil</Text>
          <Text style={s.subtitle}>
            Pour votre sécurité, nous avons envoyé un code à 6 chiffres à{'\n'}
            <Text style={s.emailHighlight}>{maskedEmail || 'votre email'}</Text>
          </Text>

          {deviceLabel ? (
            <View style={s.deviceBox}>
              <Text style={s.deviceLabel}>Appareil demandant l'accès :</Text>
              <Text style={s.deviceName}>{deviceLabel}</Text>
            </View>
          ) : null}

          <Text style={s.label}>Code de validation</Text>
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
          <Text style={s.hint}>Code valable pendant 15 minutes — 3 tentatives max</Text>

          <TouchableOpacity
            style={[s.submitBtn, loading && s.btnDisabled]}
            onPress={submit}
            disabled={loading || code.length !== 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Valider l'appareil</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.resendBtn, (cooldown > 0 || sending) && s.btnDisabled]}
            onPress={() => sendCode(false)}
            disabled={cooldown > 0 || sending}
            activeOpacity={0.7}
          >
            <Text style={s.resendBtnText}>
              {sending
                ? 'Envoi…'
                : cooldown > 0
                ? `Renvoyer le code dans ${cooldown}s`
                : 'Renvoyer le code'}
            </Text>
          </TouchableOpacity>

          <Text style={s.helpText}>
            Vous ne recevez pas le code ? Vérifiez vos spams. Si l'email n'est plus accessible,
            contactez le support.
          </Text>
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
  deviceBox: {
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  deviceLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  deviceName: { fontSize: 15, color: '#1B2A4A', fontWeight: '600' },
  label: { fontSize: 14, color: '#555', marginBottom: 8, fontWeight: '500' },
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
  resendBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  resendBtnText: { color: '#4CAF50', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  helpText: { fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18 },
});
