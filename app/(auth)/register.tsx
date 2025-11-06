// ============================================
// app/(auth)/register.tsx
// Écran d'inscription avec 3 types de comptes
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
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/authService';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import { RegisterRequest } from '../../src/type';

export default function RegisterScreen() {
  const router = useRouter();
  
  // États du formulaire
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [nom, setNom] = useState<string>('');
  const [telephone, setTelephone] = useState<string>('');
  const [role, setRole] = useState<string>('CLIENT');
  const [adresse, setAdresse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Champs spécifiques EPICIER
  const [nomEpicerie, setNomEpicerie] = useState<string>('');
  const [descriptionEpicerie, setDescriptionEpicerie] = useState<string>('');

  /**
   * Validation du formulaire
   */
  const validateForm = (): boolean => {
    // Vérifier les champs obligatoires
    if (!email || !password || !nom || !telephone || !adresse) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return false;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Email invalide');
      return false;
    }

    // Validation mot de passe
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }

    // Validation téléphone marocain
    const phoneRegex = /^(06|07)[0-9]{8}$/;
    if (!phoneRegex.test(telephone)) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide (format: 06XXXXXXXX ou 07XXXXXXXX)');
      return false;
    }

    // Si EPICIER, vérifier les champs spécifiques
    if (role === 'EPICIER' && (!nomEpicerie || !descriptionEpicerie)) {
      Alert.alert('Erreur', 'Veuillez renseigner les informations de votre épicerie');
      return false;
    }

    return true;
  };

  /**
   * Gestion de l'inscription
   */
  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Récupérer le push token AVANT l'inscription
      console.log('[RegisterScreen] 🔔 Récupération du push token...');
      const fcmToken = await pushNotificationService.getTokenForLogin();
      console.log('[RegisterScreen] Token obtenu:', fcmToken ? 'OUI ✅' : 'NON ❌');

      console.log('[RegisterScreen] 📝 Préparation des données d\'inscription...');

      // Préparer les données
      const userData: RegisterRequest = {
        email,
        password,
        nom,
        telephone,
        role,
        adresse,
        latitude: 33.5731, // TODO: Récupérer via GPS
        longitude: -7.5898, // TODO: Récupérer via GPS
      };

      // Ajouter les données épicerie si nécessaire
      if (role === 'EPICIER') {
        userData.nomEpicerie = nomEpicerie;
        userData.descriptionEpicerie = descriptionEpicerie;
      }

      console.log('[RegisterScreen] 🔐 Appel API d\'inscription...');

      // Appel API avec le token
      const response = await authService.register(userData, fcmToken);

      console.log('[RegisterScreen] ✅ Inscription réussie');
      console.log('[RegisterScreen] Rôle:', response.role);
      console.log('[RegisterScreen] ⏳ Attente pour assurer la sauvegarde du JWT...');

      // Attendre un peu pour s'assurer que le JWT est bien sauvegardé en AsyncStorage
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[RegisterScreen] ✅ JWT sauvegardé, redirection en cours...');

      // Succès - Redirection selon le rôle
      Alert.alert(
        'Succès ! 🎉',
        'Votre compte a été créé avec succès !',
        [
          {
            text: 'OK',
            onPress: () => {
              if (response.role === 'CLIENT') {
                console.log('[RegisterScreen] 📱 Redirection vers CLIENT...');
                router.replace('/(client)');
              } else if (response.role === 'EPICIER') {
                console.log('[RegisterScreen] 🏪 Redirection vers EPICIER...');
                router.replace('../(epicier)/dashboard');
              } else if (response.role === 'LIVREUR') {
                console.log('[RegisterScreen] 🚗 Redirection vers LIVREUR...');
                router.replace('/(livreur)/deliveries');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[RegisterScreen] ❌ Erreur lors de l\'inscription:', error);
      Alert.alert('Erreur', error as string);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Rendu du formulaire
   */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>
            {role === 'CLIENT' ? '🛒' : role === 'EPICIER' ? '🏪' : '🚚'}
          </Text>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez EpicerieGo</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Sélection du rôle */}
          <Text style={styles.label}>Je suis :</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={role}
              onValueChange={(value) => setRole(value)}
              style={styles.picker}
            >
              <Picker.Item label="🛒 Client" value="CLIENT" />
              <Picker.Item label="🏪 Épicier" value="EPICIER" />
              <Picker.Item label="🚚 Livreur" value="LIVREUR" />
            </Picker>
          </View>

          {/* Champs communs */}
          <TextInput
            style={styles.input}
            placeholder="Nom complet *"
            value={nom}
            onChangeText={setNom}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Téléphone (06XXXXXXXX) *"
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <TextInput
            style={styles.input}
            placeholder="Adresse *"
            value={adresse}
            onChangeText={setAdresse}
          />

          <TextInput
            style={styles.input}
            placeholder="Mot de passe (min 6 caractères) *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {/* Champs spécifiques EPICIER */}
          {role === 'EPICIER' && (
            <View style={styles.epicierSection}>
              <Text style={styles.sectionTitle}>
                📍 Informations de votre épicerie
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Nom de l'épicerie *"
                value={nomEpicerie}
                onChangeText={setNomEpicerie}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description de votre épicerie *"
                value={descriptionEpicerie}
                onChangeText={setDescriptionEpicerie}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              
              <Text style={styles.hint}>
                💡 Décrivez vos produits, spécialités, horaires...
              </Text>
            </View>
          )}

          {/* Message pour LIVREUR */}
          {role === 'LIVREUR' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                🚚 En tant que livreur, vous serez contacté par les épiciers pour effectuer des livraisons.
              </Text>
            </View>
          )}

          {/* Message pour CLIENT */}
          {role === 'CLIENT' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                🛒 Commandez vos produits depuis les épiceries locales et faites-vous livrer rapidement !
              </Text>
            </View>
          )}

          {/* Bouton d'inscription */}
          <TouchableOpacity
            style={[
              styles.button,
              loading && styles.buttonDisabled
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>S'inscrire</Text>
            )}
          </TouchableOpacity>

          {/* Lien vers connexion */}
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>
              Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  emoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
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
    marginBottom: 15,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    paddingTop: 15,
  },
  epicierSection: {
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
    marginBottom: 15,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: -10,
    marginBottom: 10,
  },
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
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
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
});