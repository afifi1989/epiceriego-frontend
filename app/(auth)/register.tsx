// ============================================
// app/(auth)/register.tsx
// Écran d'inscription avec 3 types de comptes
// EPICIER : formulaire en 2 étapes
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AbridGOLogo from '../../src/components/shared/AbridGOLogo';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import { RegisterRequest, EpicerieType, EPICERIE_TYPES } from '../../src/type';

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(06|07)[0-9]{8}$/;

function validateEmail(v: string) {
  return EMAIL_REGEX.test(v);
}
function validatePhone(v: string) {
  return PHONE_REGEX.test(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();

  // Rôle sélectionné
  const [role, setRole] = useState<string>('CLIENT');

  // Pour EPICIER : étape courante (1 = épicerie, 2 = représentant légal)
  const [step, setStep] = useState<1 | 2>(1);

  // ── Champs EPICIER — Étape 1 : Informations de l'épicerie ──────────────────
  const [epicerieType, setEpicerieType] = useState<EpicerieType>('EPICERIE_GENERALE');
  const [nomEpicerie, setNomEpicerie] = useState('');
  const [emailEpicerie, setEmailEpicerie] = useState('');
  const [telephoneEpicerie, setTelephoneEpicerie] = useState('');
  const [adresse, setAdresse] = useState('');
  const [descriptionEpicerie, setDescriptionEpicerie] = useState('');

  // ── Champs EPICIER — Étape 2 : Représentant légal ─────────────────────────
  const [prenomGerant, setPrenomGerant] = useState('');
  const [nomGerant, setNomGerant] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Champs CLIENT / LIVREUR ───────────────────────────────────────────────
  const [nom, setNom] = useState('');
  const [emailCL, setEmailCL] = useState('');
  const [telephoneCL, setTelephoneCL] = useState('');
  const [adresseCL, setAdresseCL] = useState('');
  const [passwordCL, setPasswordCL] = useState('');
  const [confirmPasswordCL, setConfirmPasswordCL] = useState('');

  const [loading, setLoading] = useState(false);

  // ─── Role change: reset steps ───────────────────────────────────────────────
  const handleRoleChange = (value: string) => {
    setRole(value);
    setStep(1);
  };

  // ─── Validation étape 1 EPICIER ────────────────────────────────────────────
  const validateStep1 = (): boolean => {
    if (!nomEpicerie.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'épicerie est obligatoire');
      return false;
    }
    if (!adresse.trim()) {
      Alert.alert('Erreur', 'L\'adresse de l\'épicerie est obligatoire');
      return false;
    }
    if (emailEpicerie && !validateEmail(emailEpicerie)) {
      Alert.alert('Erreur', 'Email de contact invalide');
      return false;
    }
    if (telephoneEpicerie && !validatePhone(telephoneEpicerie)) {
      Alert.alert('Erreur', 'Numéro pro invalide (format : 06XXXXXXXX ou 07XXXXXXXX)');
      return false;
    }
    return true;
  };

  // ─── Validation étape 2 EPICIER ────────────────────────────────────────────
  const validateStep2 = (): boolean => {
    if (!prenomGerant.trim() || !nomGerant.trim()) {
      Alert.alert('Erreur', 'Le prénom et le nom du représentant légal sont obligatoires');
      return false;
    }
    if (!email.trim() || !validateEmail(email)) {
      Alert.alert('Erreur', 'Email de connexion invalide');
      return false;
    }
    if (!telephone.trim() || !validatePhone(telephone)) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide (format : 06XXXXXXXX ou 07XXXXXXXX)');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  // ─── Validation CLIENT / LIVREUR ───────────────────────────────────────────
  const validateClientLivreur = (): boolean => {
    if (!nom.trim() || !emailCL.trim() || !telephoneCL.trim() || !adresseCL.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return false;
    }
    if (!validateEmail(emailCL)) {
      Alert.alert('Erreur', 'Email invalide');
      return false;
    }
    if (!validatePhone(telephoneCL)) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide (format : 06XXXXXXXX ou 07XXXXXXXX)');
      return false;
    }
    if (passwordCL.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    if (passwordCL !== confirmPasswordCL) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  // ─── Passer à l'étape 2 ────────────────────────────────────────────────────
  const goToStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  // ─── Soumission ────────────────────────────────────────────────────────────
  const handleRegister = async (): Promise<void> => {
    const valid = role === 'EPICIER' ? validateStep2() : validateClientLivreur();
    if (!valid) return;

    setLoading(true);
    try {
      const fcmToken = await pushNotificationService.getTokenForLogin();

      let userData: RegisterRequest;

      if (role === 'EPICIER') {
        userData = {
          role,
          // Représentant légal — compte utilisateur
          email,
          password,
          nom: `${prenomGerant.trim()} ${nomGerant.trim()}`,
          telephone,
          adresse,
          latitude: 33.5731,
          longitude: -7.5898,
          // Épicerie — personne morale
          nomEpicerie,
          descriptionEpicerie,
          emailEpicerie: emailEpicerie || undefined,
          telephoneEpicerie: telephoneEpicerie || undefined,
          prenomGerant: prenomGerant.trim(),
          nomGerant: nomGerant.trim(),
          epicerieType,
        };
      } else {
        userData = {
          email: emailCL,
          password: passwordCL,
          nom,
          telephone: telephoneCL,
          role,
          adresse: adresseCL,
          latitude: 33.5731,
          longitude: -7.5898,
        };
      }

      const response = await authService.register(userData, null);

      // Pour les EPICIER, afficher l'identifiant ALXXXXX généré
      const identifiantMsg = response.identifiant
        ? `\n\nVotre identifiant de connexion : ${response.identifiant}\nConservez-le précieusement — il remplace l'email pour vous connecter.`
        : '';

      Alert.alert(
        'Inscription réussie !',
        `Nous avons envoyé des codes de vérification par email et SMS. Veuillez les saisir pour activer votre compte.${identifiantMsg}`,
        [{
          text: 'OK',
          onPress: () => router.push({
            pathname: '/(auth)/verify-account',
            params: {
              email: role === 'EPICIER' ? email : emailCL,
              maskedPhone: response.maskedPhone || '',
              identifiant: response.identifiant || '',
            },
          }),
        }]
      );
    } catch (error) {
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <AbridGOLogo size={200} />
          <Text style={styles.title}>Créer un compte</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>

          {/* Sélection du rôle */}
          <Text style={styles.label}>Je suis :</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={role}
              onValueChange={handleRoleChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="🛒 Client" value="CLIENT" />
              <Picker.Item label="🏪 Épicier" value="EPICIER" />
              <Picker.Item label="🚚 Livreur" value="LIVREUR" />
            </Picker>
          </View>

          {/* ═══════════════════════════════════════ */}
          {/* FORMULAIRE ÉPICIER — 2 étapes           */}
          {/* ═══════════════════════════════════════ */}
          {role === 'EPICIER' && (
            <>
              {/* Indicateur d'étape */}
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>1</Text>
                </View>
                <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>2</Text>
                </View>
              </View>

              {/* ── Étape 1 : Informations de l'épicerie ── */}
              {step === 1 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🏪 Informations de l'épicerie</Text>
                  <Text style={styles.sectionSubtitle}>Étape 1 / 2 — Personne morale</Text>

                  {/* ── Type de boutique ── */}
                  <Text style={styles.typeLabel}>Type de boutique *</Text>
                  <View style={styles.typeGrid}>
                    {EPICERIE_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        style={[
                          styles.typeCard,
                          epicerieType === t.value && styles.typeCardSelected,
                        ]}
                        onPress={() => setEpicerieType(t.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.typeCardIcon}>{t.icon}</Text>
                        <Text
                          style={[
                            styles.typeCardLabel,
                            epicerieType === t.value && styles.typeCardLabelSelected,
                          ]}
                          numberOfLines={2}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Nom de l'épicerie *"
                    placeholderTextColor="#999"
                    value={nomEpicerie}
                    onChangeText={setNomEpicerie}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Adresse *"
                    placeholderTextColor="#999"
                    value={adresse}
                    onChangeText={setAdresse}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Email de contact public (optionnel)"
                    placeholderTextColor="#999"
                    value={emailEpicerie}
                    onChangeText={setEmailEpicerie}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Téléphone professionnel (optionnel)"
                    placeholderTextColor="#999"
                    value={telephoneEpicerie}
                    onChangeText={setTelephoneEpicerie}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description de l'épicerie (optionnel)"
                    placeholderTextColor="#999"
                    value={descriptionEpicerie}
                    onChangeText={setDescriptionEpicerie}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity style={styles.button} onPress={goToStep2}>
                    <Text style={styles.buttonText}>Suivant →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Étape 2 : Représentant légal ── */}
              {step === 2 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>👤 Représentant légal</Text>
                  <Text style={styles.sectionSubtitle}>Étape 2 / 2 — Compte administrateur</Text>

                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      placeholder="Prénom *"
                      placeholderTextColor="#999"
                      value={prenomGerant}
                      onChangeText={setPrenomGerant}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      placeholder="Nom *"
                      placeholderTextColor="#999"
                      value={nomGerant}
                      onChangeText={setNomGerant}
                      autoCapitalize="words"
                    />
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Email de connexion *"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Téléphone personnel (06XXXXXXXX) *"
                    placeholderTextColor="#999"
                    value={telephone}
                    onChangeText={setTelephone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Mot de passe (min 6 caractères) *"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Confirmer le mot de passe *"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonOutline, styles.halfButton]}
                      onPress={() => setStep(1)}
                    >
                      <Text style={styles.buttonOutlineText}>← Retour</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.halfButton, loading && styles.buttonDisabled]}
                      onPress={handleRegister}
                      disabled={loading}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>S'inscrire</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* FORMULAIRE CLIENT / LIVREUR             */}
          {/* ═══════════════════════════════════════ */}
          {role !== 'EPICIER' && (
            <>
              {role === 'LIVREUR' && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    🚚 En tant que livreur, vous serez contacté par les épiciers pour effectuer des livraisons.
                  </Text>
                </View>
              )}
              {role === 'CLIENT' && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    🛒 Commandez vos produits depuis les épiceries locales et faites-vous livrer rapidement !
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Nom complet *"
                placeholderTextColor="#999"
                value={nom}
                onChangeText={setNom}
                autoCapitalize="words"
              />

              <TextInput
                style={styles.input}
                placeholder="Email *"
                placeholderTextColor="#999"
                value={emailCL}
                onChangeText={setEmailCL}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.input}
                placeholder="Téléphone (06XXXXXXXX) *"
                placeholderTextColor="#999"
                value={telephoneCL}
                onChangeText={setTelephoneCL}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <TextInput
                style={styles.input}
                placeholder="Adresse *"
                placeholderTextColor="#999"
                value={adresseCL}
                onChangeText={setAdresseCL}
              />

              <TextInput
                style={styles.input}
                placeholder="Mot de passe (min 6 caractères) *"
                placeholderTextColor="#999"
                value={passwordCL}
                onChangeText={setPasswordCL}
                secureTextEntry
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Confirmer le mot de passe *"
                placeholderTextColor="#999"
                value={confirmPasswordCL}
                onChangeText={setConfirmPasswordCL}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>S'inscrire</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* Lien connexion */}
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>
              Déjà un compte ?{' '}
              <Text style={styles.linkBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B2A4A',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
  },
  // ── Step indicator ──────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ccc',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#ccc',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#4CAF50',
  },
  // ── Section ─────────────────────────────────────
  section: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#558B2F',
    marginBottom: 15,
  },
  // ── Inputs ──────────────────────────────────────
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  textArea: {
    height: 80,
    paddingTop: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
    marginBottom: 12,
  },
  // ── Buttons ─────────────────────────────────────
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonOutline: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4CAF50',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonOutlineText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  halfButton: {
    flex: 1,
    marginTop: 4,
  },
  // ── Info box ────────────────────────────────────
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  // ── Footer ──────────────────────────────────────
  link: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    color: '#666',
  },
  linkBold: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  // ── Type de boutique ────────────────────────────
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeCard: {
    width: '30%',
    minWidth: 90,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  typeCardSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  typeCardIcon: {
    fontSize: 26,
  },
  typeCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444',
    textAlign: 'center',
    lineHeight: 14,
  },
  typeCardLabelSelected: {
    color: '#fff',
  },
});
