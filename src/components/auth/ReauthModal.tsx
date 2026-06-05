import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/config';
import { authService } from '../../services/authService';
import { authFeedbackBus } from '../../services/auth/authFeedbackBus';
import { useTheme } from '../../theme';

/**
 * Modal global de re-authentification, declenche par
 * {@code authFeedbackBus.emit('reauth:required', { email })}.
 *
 * <h3>Pourquoi un modal global plutot qu'un redirect ?</h3>
 * Quand le refresh token echoue (ou que le token est forge), l'experience
 * d'origine etait un router.replace('/auth/login') qui :
 *   - perd l'ecran courant (formulaire en cours, scroll position, navigation stack)
 *   - perd le contexte mental de l'utilisateur ("j'etais en train de...")
 *
 * Avec ce modal, l'utilisateur resaisit juste son mot de passe sans quitter
 * son ecran. Le re-login appose des tokens frais sur le storage existant.
 * Le screen courant reste en arriere-plan ; ses prochaines requetes passeront
 * normalement.
 *
 * <h3>Edge cases</h3>
 * - Email absent du storage (storage corrompu, premier lancement post-crash) :
 *   on bascule sur le full login screen (pas de pre-fill possible).
 * - {@code deviceVerificationRequired} en reponse au re-login : on dismiss et
 *   on redirige vers le flow complet qui sait gerer le OTP.
 * - Mauvais mot de passe : message inline, on reste sur le modal.
 *
 * <h3>Concurrence</h3>
 * Une seule instance montee a la racine. Les events 'reauth:required' multiples
 * (typique de plusieurs requetes concurrentes qui tombent en 401 a quelques ms
 * d'intervalle) sont absorbes : si le modal est deja visible, on ignore.
 */
export function ReauthModal() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Garde-fou anti double-event quand plusieurs requetes 401 concurrentes
  // emettent reauth:required dans la meme tick.
  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  useEffect(() => {
    const sub = authFeedbackBus.on('reauth:required', ({ email: payloadEmail }) => {
      if (visibleRef.current) return;
      if (!payloadEmail) {
        // Pas d'email connu → on ne peut pas faire de re-login partiel.
        // On bascule sur le full login flow.
        forceFullLogout('/(auth)/login');
        return;
      }
      setEmail(payloadEmail);
      setPassword('');
      setErrorMsg(null);
      setVisible(true);
    });
    return () => sub.remove();
  }, []);

  const forceFullLogout = async (route: string = '/(auth)/login') => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.ROLE,
      ]);
    } catch {
      // best-effort
    }
    setVisible(false);
    authFeedbackBus.emit('reauth:cancelled');
    try {
      router.replace(route as any);
    } catch {
      // si le router n'a pas la route, l'app reagira au prochain mount
    }
  };

  const handleSubmit = async () => {
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const outcome = await authService.login(email, password);

      if (outcome.kind === 'authenticated') {
        // Tokens stockes par authService.persistSession() — on a juste a fermer.
        setVisible(false);
        setPassword('');
        authFeedbackBus.emit('reauth:success');
      } else if (outcome.kind === 'deviceVerificationRequired') {
        // Cet appareil n'est plus trusted (rare apres un simple expire,
        // mais possible si la session a ete revoquee cote backend). On
        // bascule sur le flow complet qui sait gerer le OTP device.
        await forceFullLogout('/(auth)/login');
      } else {
        // Outcome inattendu (autres kinds eventuels)
        setErrorMsg('Reconnexion impossible, veuillez utiliser l\'ecran de connexion.');
      }
    } catch (err: any) {
      const message = typeof err === 'string'
        ? err
        : err?.message ?? 'Mot de passe incorrect.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Hardware back Android : on traite comme "Changer de compte"
        forceFullLogout();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={28} color={theme.colors.brand} />
            <Text style={[theme.typography.titleMd, { color: theme.colors.textPrimary }]}>
              Session expiree
            </Text>
          </View>

          <Text style={[theme.typography.body, styles.subtitle, { color: theme.colors.textSecondary }]}>
            Votre session a expire. Resaisissez votre mot de passe pour continuer.
          </Text>

          <View style={[styles.field, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md }]}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]} numberOfLines={1}>
              {email}
            </Text>
          </View>

          <View style={[styles.field, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md }]}>
            <Ionicons name="key-outline" size={18} color={theme.colors.textSecondary} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}
            />
          </View>

          {errorMsg ? (
            <Text style={[styles.error, { color: theme.colors.danger }]}>
              {errorMsg}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !password.trim()}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: theme.colors.brand,
                borderRadius: theme.radius.md,
                opacity: (submitting || !password.trim()) ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[theme.typography.bodyStrong, { color: '#fff' }]}>
                Continuer
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => forceFullLogout()}
            disabled={submitting}
            style={styles.secondaryBtn}
          >
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Changer de compte
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    marginBottom: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    fontSize: 13,
    marginTop: -4,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
