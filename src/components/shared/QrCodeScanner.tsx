/**
 * QrCodeScanner — composant partagé épicier / livreur
 * Utilise expo-camera pour scanner un QR Code de validation de commande.
 * Affiche en modal plein-écran avec cadre de visée animé.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Vibration,
  SafeAreaView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';

interface QrCodeScannerProps {
  visible: boolean;
  onScanned: (data: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

export const QrCodeScanner: React.FC<QrCodeScannerProps> = ({
  visible,
  onScanned,
  onClose,
  title = 'Scanner QR Code',
  subtitle = 'Pointez la caméra vers le QR Code du client',
  isLoading = false,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const cooldownRef = useRef(false);

  // Réinitialiser l'état de scan à chaque ouverture
  useEffect(() => {
    if (visible) {
      setScanned(false);
      cooldownRef.current = false;
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // Anti-double-scan : ignorer pendant 2s après un scan
    if (scanned || cooldownRef.current) return;
    cooldownRef.current = true;
    setScanned(true);
    Vibration.vibrate(200);
    onScanned(data);
  };

  const handleReScan = () => {
    setScanned(false);
    cooldownRef.current = false;
  };

  if (!visible) return null;

  // Pas encore de réponse sur la permission
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </SafeAreaView>
      </Modal>
    );
  }

  // Permission refusée
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <MaterialCommunityIcons name="camera-off" size={64} color={Colors.textSecondary} />
            <Text style={styles.permissionTitle}>Accès caméra requis</Text>
            <Text style={styles.permissionText}>
              L'accès à la caméra est nécessaire pour scanner le QR Code du client.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Caméra plein écran */}
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned || isLoading ? undefined : handleBarCodeScanned}
        />

        {/* Overlay sombre autour du cadre */}
        <View style={styles.overlay}>
          {/* Bande du haut */}
          <View style={styles.overlayTop}>
            {/* Header */}
            <SafeAreaView>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>

          {/* Ligne du milieu : zones sombres + cadre transparent */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            {/* Cadre de visée */}
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>

          {/* Bande du bas */}
          <View style={styles.overlayBottom}>
            {isLoading ? (
              <View style={styles.statusBox}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.statusText}>Validation en cours...</Text>
              </View>
            ) : scanned ? (
              <View style={styles.statusBox}>
                <MaterialCommunityIcons name="check-circle" size={24} color={Colors.success} />
                <Text style={styles.statusText}>QR Code détecté</Text>
                <TouchableOpacity style={styles.reScanButton} onPress={handleReScan}>
                  <Text style={styles.reScanText}>Scanner à nouveau</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.statusBox}>
                <MaterialCommunityIcons name="qrcode-scan" size={24} color="#fff" />
                <Text style={styles.statusText}>Cadrez le QR Code dans le cadre</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FRAME_SIZE = 240;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Permission screen
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSizes.base,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.base,
  },
  // Camera overlay
  overlay: {
    flex: 1,
  },
  overlayTop: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingTop: Platform.OS === 'android' ? Spacing.xl : Spacing.md,
  },
  closeButton: {
    padding: Spacing.sm,
    marginRight: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlaySide: {
    flex: 1,
    height: FRAME_SIZE,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  statusBox: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  statusText: {
    fontSize: FontSizes.base,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  reScanButton: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  reScanText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },
});
