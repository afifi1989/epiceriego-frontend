/**
 * Barcode Management Tab Component
 * Permet d'ajouter/modifier/supprimer les codes-barres d'un produit
 * Support du scan et de la saisie manuelle
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import barcodeService, { BarcodeInfo } from '@/src/services/barcodeService';
import epicierProductService from '@/src/services/epicierProductService';
import Toast from 'react-native-toast-message';

interface Barcode {
  id: number;
  barcode: string;
  format: string;
  isExternal: boolean;
}

interface Props {
  productId: number;
  onRefresh?: () => void;
}

export const BarcodeManagementTab: React.FC<Props> = ({ productId, onRefresh }) => {
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [barcodeError, setBarcodeError] = useState('');

  useEffect(() => {
    loadBarcodes();
  }, [productId]);

  const loadBarcodes = async () => {
    try {
      setIsLoading(true);
      const data = await epicierProductService.getProductBarcodes(productId);
      setBarcodes(data || []);
    } catch (error) {
      console.error('Error loading barcodes:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger les codes-barres',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateAndAddBarcode = async (barcode: string) => {
    const cleaned = barcodeService.cleanBarcode(barcode);

    // Validate barcode
    if (!barcodeService.isValidBarcode(cleaned)) {
      setBarcodeError('Code-barre invalide. Format accepté: EAN-13, UPC-A, UPC-E ou interne');
      return;
    }

    // Check if barcode already exists
    if (barcodes.some((b) => b.barcode === cleaned)) {
      setBarcodeError('Ce code-barre existe déjà pour ce produit');
      return;
    }

    try {
      setIsSaving(true);
      const barcodeInfo = barcodeService.getBarcodeInfo(cleaned);

      // Add barcode via API
      await epicierProductService.addProductBarcode(productId, {
        barcode: cleaned,
        format: barcodeInfo.format,
      });

      // Update local state
      setBarcodes([
        ...barcodes,
        {
          id: Date.now(), // Temporary ID
          barcode: cleaned,
          format: barcodeInfo.format,
          isExternal: barcodeInfo.format !== 'INTERNAL',
        },
      ]);

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Code-barre ajouté avec succès',
      });

      setManualBarcode('');
      setBarcodeError('');
      setShowAddModal(false);

      // Reload to get the server ID
      await loadBarcodes();
      onRefresh?.();
    } catch (error) {
      console.error('Error adding barcode:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible d\'ajouter le code-barre',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBarcode = async (barcodeId: number, barcode: string) => {
    Alert.alert(
      'Confirmation',
      `Êtes-vous sûr de vouloir supprimer le code-barre ${barcode} ?`,
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              setIsSaving(true);
              await epicierProductService.deleteProductBarcode(productId, barcodeId);

              setBarcodes(barcodes.filter((b) => b.id !== barcodeId));

              Toast.show({
                type: 'success',
                text1: 'Supprimé',
                text2: 'Code-barre supprimé avec succès',
              });

              onRefresh?.();
            } catch (error) {
              console.error('Error deleting barcode:', error);
              Toast.show({
                type: 'error',
                text1: 'Erreur',
                text2: 'Impossible de supprimer le code-barre',
              });
            } finally {
              setIsSaving(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const getBarcodeIcon = (format: string) => {
    switch (format) {
      case 'EAN13':
        return 'barcode';
      case 'INTERNAL':
        return 'layers';
      default:
        return 'barcode';
    }
  };

  const getBarcodeColor = (format: string) => {
    switch (format) {
      case 'EAN13':
        return '#4CAF50';
      case 'INTERNAL':
        return '#2196F3';
      case 'UPC_A':
      case 'UPC_E':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Codes-barres du produit</Text>
          <Text style={styles.headerSubtitle}>
            {barcodes.length} code{barcodes.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          disabled={isSaving}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Barcodes List */}
      {barcodes.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="barcode-off" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>Aucun code-barre</Text>
          <Text style={styles.emptyStateSubtext}>
            Appuyez sur + pour ajouter un code-barre
          </Text>
        </View>
      ) : (
        <FlatList
          data={barcodes}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.barcodeCard}>
              <View style={styles.barcodeContent}>
                <View
                  style={[
                    styles.barcodeIconContainer,
                    { backgroundColor: getBarcodeColor(item.format) + '20' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={getBarcodeIcon(item.format)}
                    size={24}
                    color={getBarcodeColor(item.format)}
                  />
                </View>
                <View style={styles.barcodeInfo}>
                  <Text style={styles.barcodeValue}>{item.barcode}</Text>
                  <View style={styles.formatTag}>
                    <Text style={[styles.formatText, { color: getBarcodeColor(item.format) }]}>
                      {item.format}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteBarcode(item.id, item.barcode)}
                disabled={isSaving}
              >
                <MaterialCommunityIcons name="trash-can" size={20} color="#f44336" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add Barcode Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un code-barre</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setManualBarcode('');
                  setBarcodeError('');
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              {/* Tab Buttons */}
              <View style={styles.methodTabs}>
                <TouchableOpacity style={styles.methodTab} disabled>
                  <MaterialCommunityIcons name="keyboard" size={20} color="#2196F3" />
                  <Text style={styles.methodTabText}>Saisie manuelle</Text>
                </TouchableOpacity>
              </View>

              {/* Manual Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Code-barre</Text>
                <TextInput
                  style={[styles.input, barcodeError ? styles.inputError : {}]}
                  placeholder="Entrez ou scannez un code-barre"
                  placeholderTextColor="#999"
                  value={manualBarcode}
                  onChangeText={(text) => {
                    setManualBarcode(text);
                    setBarcodeError('');
                  }}
                  editable={!isSaving}
                  autoFocus
                />
                {barcodeError ? (
                  <Text style={styles.errorText}>{barcodeError}</Text>
                ) : null}
              </View>

              {/* Format Info */}
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information" size={20} color="#1976d2" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Formats acceptés</Text>
                  <Text style={styles.infoText}>
                    • EAN-13: 13 chiffres{'\n'}
                    • UPC-A: 12 chiffres{'\n'}
                    • UPC-E: 8 chiffres{'\n'}
                    • Interne: 11 chiffres commençant par 2
                  </Text>
                </View>
              </View>

              {/* Validation Feedback */}
              {manualBarcode && !barcodeError && (
                <View style={styles.validationBox}>
                  {(() => {
                    const info = barcodeService.getBarcodeInfo(manualBarcode);
                    return (
                      <>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                        <View style={styles.validationContent}>
                          <Text style={styles.validationTitle}>Format valide</Text>
                          <Text style={styles.validationText}>
                            Format détecté: {info.format}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setManualBarcode('');
                  setBarcodeError('');
                }}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addBarcodeButton, isSaving && styles.buttonDisabled]}
                onPress={() => validateAndAddBarcode(manualBarcode)}
                disabled={!manualBarcode.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                    <Text style={styles.addBarcodeButtonText}>Ajouter</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  barcodeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  barcodeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barcodeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeInfo: {
    flex: 1,
  },
  barcodeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  formatTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  formatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingTop: 16,
    flexDirection: 'column',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    flex: 1,
    padding: 16,
    paddingBottom: 24,
  },
  methodTabs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 6,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#0d47a1',
    lineHeight: 18,
  },
  validationBox: {
    flexDirection: 'row',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  validationContent: {
    flex: 1,
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 2,
  },
  validationText: {
    fontSize: 12,
    color: '#1b5e20',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  addBarcodeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addBarcodeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
