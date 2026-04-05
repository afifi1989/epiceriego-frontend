/**
 * Écran Scanner QR — ÉPICIER
 * Scanne le QR Code d'un client pour valider un retrait en magasin (PICKUP).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QrCodeScanner } from '../../src/components/shared/QrCodeScanner';
import { orderService } from '../../src/services/orderService';
import { QrValidateResponse } from '../../src/type';

const EPICIER_BLUE = '#2196F3';

export default function EpicierScanQrScreen() {
  const router = useRouter();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastResult, setLastResult] = useState<QrValidateResponse | null>(null);

  const handleScanned = async (data: string) => {
    if (validating) return;
    try {
      setValidating(true);
      const result = await orderService.validateQrCode(data);
      setLastResult(result);
      setScannerVisible(false);

      Alert.alert(
        'Retrait validé !',
        `Commande #${result.orderId} de ${result.clientNom} marquée comme retirée.`,
        [
          {
            text: 'Scanner une autre',
            onPress: () => {
              setLastResult(null);
              setScannerVisible(true);
            },
          },
          {
            text: 'Retour aux commandes',
            onPress: () => router.push('/(epicier)/commandes'),
            style: 'cancel',
          },
        ]
      );
    } catch (err: any) {
      setScannerVisible(false);
      Alert.alert(
        'Erreur de validation',
        typeof err === 'string' ? err : 'QR Code invalide ou déjà utilisé.',
        [
          {
            text: 'Réessayer',
            onPress: () => setScannerVisible(true),
          },
          { text: 'Annuler', style: 'cancel' },
        ]
      );
    } finally {
      setValidating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner QR — Retrait</Text>
      </View>

      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustrationBox}>
          <MaterialCommunityIcons name="qrcode-scan" size={96} color={EPICIER_BLUE} />
        </View>

        <Text style={styles.title}>Valider un retrait en magasin</Text>
        <Text style={styles.description}>
          Scannez le QR Code affiché par le client sur son application pour confirmer
          le retrait de sa commande.
        </Text>

        {/* Résultat du dernier scan */}
        {lastResult && (
          <View style={styles.resultCard}>
            <MaterialCommunityIcons name="check-circle" size={28} color="#4CAF50" />
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>Dernier retrait validé</Text>
              <Text style={styles.resultDetail}>
                Commande #{lastResult.orderId} — {lastResult.clientNom}
              </Text>
            </View>
          </View>
        )}

        {/* Bouton principal */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setScannerVisible(true)}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="camera" size={24} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.scanButtonText}>Ouvrir le scanner</Text>
        </TouchableOpacity>

        {/* Aide */}
        <View style={styles.helpBox}>
          <MaterialCommunityIcons name="information-outline" size={18} color="#666" />
          <Text style={styles.helpText}>
            La commande doit être en statut <Text style={styles.bold}>PRÊTE</Text> pour
            pouvoir être validée par QR Code.
          </Text>
        </View>
      </View>

      {/* Scanner modal */}
      <QrCodeScanner
        visible={scannerVisible}
        onScanned={handleScanned}
        onClose={() => setScannerVisible(false)}
        title="Scanner QR Client"
        subtitle="Scannez le QR Code affiché par le client"
        isLoading={validating}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: EPICIER_BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  illustrationBox: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  // Résultat
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 13,
    color: '#388E3C',
  },
  // Scanner button
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EPICIER_BLUE,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    width: '100%',
    shadowColor: EPICIER_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 24,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  // Aide
  helpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#333',
  },
});
