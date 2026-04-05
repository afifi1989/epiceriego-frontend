/**
 * BarcodeProductScanner — scanner de codes-barres produits
 * Supporte EAN-13, UPC-A, UPC-E, Code-128, Code-39 et QR Code.
 * Utilisé pour l'approvisionnement de stock : scan → identifie produit + unité.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface BarcodeProductScannerProps {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  /** Couleur d'accent (selon le rôle) */
  accentColor?: string;
}

const BARCODE_TYPES: any[] = [
  'ean13', 'ean8', 'upc_a', 'upc_e',
  'code128', 'code39', 'code93',
  'itf14', 'qr',
];

export const BarcodeProductScanner: React.FC<BarcodeProductScannerProps> = ({
  visible,
  onScanned,
  onClose,
  title = 'Scanner un produit',
  subtitle = 'Pointez la caméra vers le code-barre du produit',
  isLoading = false,
  accentColor = '#2196F3',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      cooldownRef.current = false;
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || cooldownRef.current || isLoading) return;
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

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <ActivityIndicator size="large" color={accentColor} />
        </SafeAreaView>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <MaterialCommunityIcons name="camera-off" size={64} color="#999" />
            <Text style={styles.permissionTitle}>Accès caméra requis</Text>
            <Text style={styles.permissionText}>
              La caméra est nécessaire pour scanner les codes-barres des produits.
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: accentColor }]}
              onPress={requestPermission}
            >
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
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={scanned || isLoading ? undefined : handleBarCodeScanned}
        />

        <View style={styles.overlay}>
          {/* Header */}
          <View style={[styles.overlayTop, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
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

          {/* Cadre de visée élargi (barcode = rectangle horizontal) */}
          <View style={styles.overlayMiddle}>
            <View style={[styles.overlaySide, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
            <View style={styles.scanFrame}>
              {/* Coins */}
              <View style={[styles.corner, styles.cornerTL, { borderColor: accentColor }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: accentColor }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: accentColor }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: accentColor }]} />
              {/* Ligne de scan horizontale */}
              <View style={[styles.scanLine, { backgroundColor: accentColor }]} />
            </View>
            <View style={[styles.overlaySide, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
          </View>

          {/* Zone du bas */}
          <View style={[styles.overlayBottom, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
            {isLoading ? (
              <View style={styles.statusBox}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.statusText}>Recherche du produit…</Text>
              </View>
            ) : scanned ? (
              <View style={styles.statusBox}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.statusText}>Code détecté</Text>
                <TouchableOpacity
                  style={[styles.reScanButton, { borderColor: accentColor }]}
                  onPress={handleReScan}
                >
                  <Text style={[styles.reScanText, { color: accentColor }]}>Scanner un autre</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.statusBox}>
                <MaterialCommunityIcons name="barcode-scan" size={28} color="#fff" />
                <Text style={styles.statusText}>Cadrez le code-barre dans le rectangle</Text>
                <Text style={styles.supportedText}>EAN-13 · UPC · Code128 · QR</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FRAME_W = 300;
const FRAME_H = 150;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12,
  },
  permissionTitle: { fontSize: 18, fontWeight: '700', color: '#212121', textAlign: 'center' },
  permissionText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  permissionButton: {
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 8, marginTop: 12,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelButtonText: { color: '#999', fontSize: 14 },
  overlay: { flex: 1 },
  overlayTop: {},
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
  },
  closeButton: { padding: 8, marginRight: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 3 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  overlayMiddle: { flexDirection: 'row', alignItems: 'center' },
  overlaySide: { flex: 1, height: FRAME_H },
  scanFrame: {
    width: FRAME_W, height: FRAME_H,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    width: FRAME_W - 20,
    height: 2,
    opacity: 0.7,
  },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 3 },
  overlayBottom: {
    flex: 1, justifyContent: 'flex-start',
    alignItems: 'center', paddingTop: 24,
  },
  statusBox: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  statusText: { fontSize: 15, color: '#fff', fontWeight: '600', textAlign: 'center' },
  supportedText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  reScanButton: {
    marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  reScanText: { fontWeight: '600', fontSize: 13 },
});
