/**
 * Écran QR Code — CLIENT
 * Affiche le QR Code de validation de la commande.
 * Le client présente cet écran à l'épicier (PICKUP) ou au livreur (HOME_DELIVERY).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { orderService } from '../../../src/services/orderService';
import { QrTokenResponse } from '../../../src/type';

const CLIENT_GREEN = '#4CAF50';
const PICKUP_COLOR = '#FF9800';
const DELIVERY_COLOR = '#2196F3';

export default function OrderQrCodeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const orderId = parseInt(Array.isArray(id) ? id[0] : (id as string));

  const [qrData, setQrData] = useState<QrTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQrToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getQrToken(orderId);
      setQrData(data);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Impossible de générer le QR Code');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadQrToken();
  }, [loadQrToken]);

  // Recharger si le QR a été invalidé (après validation)
  useFocusEffect(
    useCallback(() => {
      loadQrToken();
    }, [loadQrToken])
  );

  const isPickup = qrData?.deliveryType === 'PICKUP';
  const accentColor = isPickup ? PICKUP_COLOR : DELIVERY_COLOR;

  const handleShare = async () => {
    if (!qrData) return;
    try {
      await Share.share({
        message: `Mon QR Code de commande #${orderId} — AbridGO`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={CLIENT_GREEN} />
        <Text style={styles.loadingText}>Génération du QR Code...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#F44336" />
        <Text style={styles.errorTitle}>QR Code indisponible</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadQrToken}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!qrData) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Bannière type livraison */}
      <View style={[styles.typeBanner, { backgroundColor: accentColor }]}>
        <MaterialCommunityIcons
          name={isPickup ? 'store' : 'truck-delivery'}
          size={28}
          color="#fff"
        />
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>
            {isPickup ? 'Retrait en magasin' : 'Livraison à domicile'}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {isPickup
              ? "Présentez ce QR Code à l'épicier lors du retrait"
              : 'Présentez ce QR Code au livreur lors de la livraison'}
          </Text>
        </View>
      </View>

      {/* Numéro de commande */}
      <View style={styles.orderBadge}>
        <Text style={styles.orderBadgeLabel}>Commande</Text>
        <Text style={styles.orderBadgeNumber}>#{qrData.orderId}</Text>
      </View>

      {/* QR Code */}
      <View style={styles.qrWrapper}>
        <View style={styles.qrContainer}>
          <QRCode
            value={qrData.qrToken}
            size={240}
            color="#212121"
            backgroundColor="#fff"
            quietZone={16}
          />
        </View>
        <Text style={styles.qrHint}>
          Ce QR Code est valable 24h et à usage unique
        </Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>Comment ça marche ?</Text>
        {isPickup ? (
          <>
            <InstructionStep
              icon="numeric-1-circle"
              color={accentColor}
              text="Votre commande est prête à retirer"
            />
            <InstructionStep
              icon="numeric-2-circle"
              color={accentColor}
              text="Présentez ce QR Code à l'épicier"
            />
            <InstructionStep
              icon="numeric-3-circle"
              color={accentColor}
              text="L'épicier scanne et valide votre retrait"
            />
            <InstructionStep
              icon="numeric-4-circle"
              color={accentColor}
              text="La commande est marquée comme retirée"
            />
          </>
        ) : (
          <>
            <InstructionStep
              icon="numeric-1-circle"
              color={accentColor}
              text="Le livreur se présente à votre adresse"
            />
            <InstructionStep
              icon="numeric-2-circle"
              color={accentColor}
              text="Présentez ce QR Code au livreur"
            />
            <InstructionStep
              icon="numeric-3-circle"
              color={accentColor}
              text="Le livreur scanne et confirme la livraison"
            />
            <InstructionStep
              icon="numeric-4-circle"
              color={accentColor}
              text="La commande est marquée comme livrée"
            />
          </>
        )}
      </View>

      {/* Sécurité */}
      <View style={styles.securityNote}>
        <MaterialCommunityIcons name="shield-check" size={18} color={CLIENT_GREEN} />
        <Text style={styles.securityText}>
          Ce QR Code est sécurisé et ne peut être utilisé qu'une seule fois.
          Ne le partagez pas.
        </Text>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: accentColor }]}
        onPress={loadQrToken}
      >
        <MaterialCommunityIcons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.actionButtonText}>Actualiser le QR Code</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>Retour à la commande</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InstructionStep({
  icon,
  color,
  text,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  text: string;
}) {
  return (
    <View style={styles.instructionStep}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={styles.instructionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: CLIENT_GREEN,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
  // Bannière type
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 28,
    gap: 14,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  // Badge commande
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderBadgeLabel: {
    fontSize: 15,
    color: '#666',
  },
  orderBadgeNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  // QR Code
  qrWrapper: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrHint: {
    marginTop: 16,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // Instructions
  instructionsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  // Sécurité
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#388E3C',
    lineHeight: 18,
  },
  // Boutons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backLinkText: {
    fontSize: 15,
    color: '#666',
    textDecorationLine: 'underline',
  },
});
