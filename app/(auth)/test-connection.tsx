import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import axios from 'axios';
import { API_CONFIG } from '../../src/constants/config';

export default function TestConnectionScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [testEmail, setTestEmail] = useState('epicier@test.com');
  const [testPassword, setTestPassword] = useState('password123');

  const testConnection = async () => {
    setLoading(true);
    setResult('🔄 Test en cours...\n');

    try {
      // Test 1: Vérifier la configuration
      setResult(prev => prev + '✅ 1. Configuration chargée\n');
      setResult(prev => prev + `   URL: ${API_CONFIG.BASE_URL}\n`);
      setResult(prev => prev + `   Timeout: ${API_CONFIG.TIMEOUT}ms\n\n`);

      // Test 2: Créer une instance axios simple
      setResult(prev => prev + '🔄 2. Création du client HTTP...\n');
      const client = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: API_CONFIG.TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Test 3: Tester la réponse du serveur
      setResult(prev => prev + '🔄 3. Test de connexion au serveur...\n');
      const healthResponse = await client.get('/health').catch(() => null);
      if (healthResponse) {
        setResult(prev => prev + `   ✅ Serveur répond (status: ${healthResponse.status})\n\n`);
      } else {
        setResult(prev => prev + `   ⚠️ Pas d'endpoint /health, on continue...\n\n`);
      }

      // Test 4: Tenter une connexion
      setResult(prev => prev + '🔄 4. Test de connexion avec credentials...\n');
      setResult(prev => prev + `   Email: ${testEmail}\n`);
      setResult(prev => prev + `   Password: ${testPassword}\n\n`);

      const loginResponse = await client.post('/auth/login', {
        email: testEmail,
        password: testPassword,
      });

      setResult(prev => prev + `✅ Connexion réussie!\n`);
      setResult(prev => prev + `   Status: ${loginResponse.status}\n`);
      setResult(prev => prev + `   Token reçu: ${loginResponse.data.token ? 'OUI' : 'NON'}\n`);
      setResult(prev => prev + `   Role: ${loginResponse.data.role}\n`);
    } catch (error: any) {
      console.error('Test Error:', error);
      setResult(prev => prev + `❌ ERREUR:\n`);
      setResult(prev => prev + `   Code: ${error.code}\n`);
      setResult(prev => prev + `   Message: ${error.message}\n`);
      setResult(prev => prev + `   Status: ${error.response?.status}\n`);
      setResult(prev => prev + `   Data: ${JSON.stringify(error.response?.data)}\n`);

      // Détails supplémentaires
      if (error.code === 'ECONNREFUSED') {
        setResult(prev => prev + `\n💡 Le serveur refuse la connexion\n`);
        setResult(prev => prev + `   Vérifier que l'IP et le port sont corrects\n`);
      } else if (error.code === 'ENOTFOUND') {
        setResult(prev => prev + `\n💡 Adresse IP/domaine non trouvé\n`);
      } else if (error.message.includes('certificate')) {
        setResult(prev => prev + `\n💡 Problème de certificat SSL\n`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Test de Connexion</Text>
        <Text style={styles.subtitle}>Diagnostic du backend HTTPS</Text>
      </View>

      <View style={styles.configSection}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.configBox}>
          <Text style={styles.configText}>URL: {API_CONFIG.BASE_URL}</Text>
          <Text style={styles.configText}>Timeout: {API_CONFIG.TIMEOUT}ms</Text>
        </View>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>Credentials de test</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={testEmail}
          onChangeText={setTestEmail}
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          value={testPassword}
          onChangeText={setTestPassword}
          placeholderTextColor="#999"
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={testConnection}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>▶️ Lancer le test</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resultSection}>
        <Text style={styles.sectionTitle}>Résultat</Text>
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{result || 'Cliquez sur "Lancer le test"'}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Conseil: Consultez les logs Expo pour plus de détails</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  configSection: {
    padding: 15,
  },
  inputSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  configBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  configText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#FF9800',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultSection: {
    padding: 15,
  },
  resultBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  footer: {
    padding: 15,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
