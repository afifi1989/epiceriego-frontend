/**
 * BarcodeScanner component
 * Hybrid scanner: supports manual input + camera scanning (when ready)
 * Validates EAN-13, UPC-A, UPC-E, and internal barcodes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  SafeAreaView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';
import barcodeService from '@/src/services/barcodeService';

interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  showManualInput?: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeScanned,
  onCancel,
  title = 'Scanner code-barre',
  subtitle = 'Entrez ou scannez le code-barre',
  showManualInput = true,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle manual input submission
  const handleManualInput = () => {
    setError(null);

    if (!manualInput.trim()) {
      setError('Veuillez entrer un code-barre');
      return;
    }

    const cleanedBarcode = barcodeService.cleanBarcode(manualInput);
    const barcodeInfo = barcodeService.getBarcodeInfo(cleanedBarcode);

    if (!barcodeInfo.isValid) {
      setError(`Format non reconnu: ${cleanedBarcode}`);
      return;
    }

    // Vibration feedback on successful scan
    Vibration.vibrate(100);

    // Show confirmation briefly
    setLastScanned(cleanedBarcode);
    setManualInput('');

    // Delay callback to show visual feedback
    setTimeout(() => {
      onBarcodeScanned(cleanedBarcode);
    }, 300);
  };

  // Handle keyboard submit (Enter key)
  const handleKeyPress = () => {
    handleManualInput();
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={28}
                color={Colors.text}
              />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Scanner Area */}
          <View style={styles.scannerArea}>
            <MaterialCommunityIcons
              name="barcode"
              size={80}
              color={Colors.primary}
              style={styles.barcodeIcon}
            />

            {/* Manual Input Section */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Entrez le code-barre:</Text>
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="barcode-scan"
                  size={20}
                  color={Colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="12345678901234"
                  placeholderTextColor={Colors.textSecondary}
                  value={manualInput}
                  onChangeText={setManualInput}
                  onSubmitEditing={handleKeyPress}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus
                />
                {manualInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setManualInput('')}
                    style={styles.clearButton}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={16}
                    color={Colors.danger}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Last Scanned Feedback */}
              {lastScanned && (
                <View style={styles.successContainer}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={Colors.success}
                  />
                  <Text style={styles.successText}>
                    {lastScanned} - Validé
                  </Text>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleManualInput}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="check"
                size={20}
                color={Colors.textInverse}
                style={{ marginRight: Spacing.sm }}
              />
              <Text style={styles.submitButtonText}>Valider le code</Text>
            </TouchableOpacity>

            {/* Camera Option Note */}
            <View style={styles.noteContainer}>
              <MaterialCommunityIcons
                name="information"
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.noteText}>
                La caméra sera disponible dans une prochaine version
              </Text>
            </View>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  scannerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  barcodeIcon: {
    marginBottom: Spacing.xl,
    opacity: 0.3,
  },
  inputSection: {
    width: '100%',
    gap: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  clearButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '20',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.danger,
    fontWeight: '600',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  successText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.success,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  submitButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
  },
});
