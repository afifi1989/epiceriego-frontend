/**
 * Modal pour afficher l'image produit en grand avec zoom
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
  PanResponder,
  Animated,
} from 'react-native';
import { productService } from '../../services/productService';

interface ProductImageModalProps {
  visible: boolean;
  photoUrl: string | null;
  productName: string;
  onClose: () => void;
}

export const ProductImageModal: React.FC<ProductImageModalProps> = ({
  visible,
  photoUrl,
  productName,
  onClose,
}) => {
  const [scale] = useState(new Animated.Value(1));
  const [zoomLevel, setZoomLevel] = useState(1);

  // Zoomer
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.5, 3);
    setZoomLevel(newZoom);
    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
    }).start();
  };

  // Dé-zoomer
  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.5, 1);
    setZoomLevel(newZoom);
    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
    }).start();
  };

  // Réinitialiser le zoom
  const handleResetZoom = () => {
    setZoomLevel(1);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  if (!photoUrl) {
    return null;
  }

  const imageUrl = productService.getImageUrl(photoUrl);

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{productName}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Image avec zoom */}
        <View style={styles.imageContainer}>
          <Animated.Image
            source={{ uri: imageUrl }}
            style={[
              styles.image,
              {
                transform: [{ scale }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Contrôles de zoom */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, styles.zoomOutButton]}
            onPress={handleZoomOut}
            disabled={zoomLevel <= 1}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>

          <View style={styles.zoomLevel}>
            <Text style={styles.zoomLevelText}>{(zoomLevel * 100).toFixed(0)}%</Text>
          </View>

          <TouchableOpacity
            style={[styles.zoomButton, styles.zoomInButton]}
            onPress={handleZoomIn}
            disabled={zoomLevel >= 3}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>

          {zoomLevel > 1 && (
            <TouchableOpacity
              style={[styles.zoomButton, styles.resetButton]}
              onPress={handleResetZoom}
            >
              <Text style={styles.resetButtonText}>↺</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.footer}>
          <Text style={styles.instructionText}>
            Utilisez les boutons pour zoomer • Appuyez en dehors pour fermer
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  zoomButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomOutButton: {
    backgroundColor: '#f44336',
  },
  zoomInButton: {
    backgroundColor: '#4CAF50',
  },
  resetButton: {
    backgroundColor: '#2196F3',
  },
  zoomButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  resetButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  zoomLevel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  zoomLevelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  instructionText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
});
