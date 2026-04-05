/**
 * Modal pour afficher l'image produit en grand avec zoom interactif
 * Support du pinch-to-zoom et pan
 */

import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Animated,
  Dimensions,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';

interface ProductImageModalProps {
  visible: boolean;
  photoUrl: string | null;
  productName: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ProductImageModal: React.FC<ProductImageModalProps> = ({
  visible,
  photoUrl,
  productName,
  onClose,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [currentScale, setCurrentScale] = useState(1);
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  // Gestion du pinch-to-zoom
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = Math.min(Math.max(lastScale.current * event.nativeEvent.scale, 1), 5);
      lastScale.current = newScale;
      setCurrentScale(newScale);

      scale.setValue(newScale);
    }
  };

  // Gestion du pan (déplacement)
  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastTranslateX.current += event.nativeEvent.translationX;
      lastTranslateY.current += event.nativeEvent.translationY;

      translateX.setOffset(lastTranslateX.current);
      translateY.setOffset(lastTranslateY.current);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };

  // Double tap pour zoomer/dézoomer
  const onDoubleTap = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const newScale = currentScale > 1 ? 1 : 2.5;

      Animated.parallel([
        Animated.spring(scale, {
          toValue: newScale,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: newScale === 1 ? 0 : lastTranslateX.current,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: newScale === 1 ? 0 : lastTranslateY.current,
          useNativeDriver: true,
        }),
      ]).start();

      if (newScale === 1) {
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        translateX.setOffset(0);
        translateY.setOffset(0);
      }

      lastScale.current = newScale;
      setCurrentScale(newScale);
    }
  };

  // Zoomer avec boutons
  const handleZoomIn = () => {
    const newScale = Math.min(lastScale.current + 0.5, 5);
    Animated.spring(scale, {
      toValue: newScale,
      useNativeDriver: true,
    }).start();
    lastScale.current = newScale;
    setCurrentScale(newScale);
  };

  // Dé-zoomer avec boutons
  const handleZoomOut = () => {
    const newScale = Math.max(lastScale.current - 0.5, 1);
    Animated.spring(scale, {
      toValue: newScale,
      useNativeDriver: true,
    }).start();

    if (newScale === 1) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
      translateX.setOffset(0);
      translateY.setOffset(0);
    }

    lastScale.current = newScale;
    setCurrentScale(newScale);
  };

  // Réinitialiser le zoom
  const handleResetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();

    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    translateX.setOffset(0);
    translateY.setOffset(0);
    setCurrentScale(1);
  };

  if (!photoUrl) {
    return null;
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <GestureHandlerRootView style={styles.overlay}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{productName}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Image avec zoom interactif */}
        <View style={styles.imageContainer}>
          <TapGestureHandler
            onHandlerStateChange={onDoubleTap}
            numberOfTaps={2}
          >
            <Animated.View style={styles.imageWrapper}>
              <PanGestureHandler
                onGestureEvent={onPanEvent}
                onHandlerStateChange={onPanStateChange}
                enabled={currentScale > 1}
              >
                <Animated.View style={styles.imageWrapper}>
                  <PinchGestureHandler
                    onGestureEvent={onPinchEvent}
                    onHandlerStateChange={onPinchStateChange}
                  >
                    <Animated.Image
                      source={{ uri: photoUrl }}
                      style={[
                        styles.image,
                        {
                          transform: [
                            { scale: scale },
                            { translateX: translateX },
                            { translateY: translateY },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </PinchGestureHandler>
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </TapGestureHandler>
        </View>

        {/* Contrôles de zoom */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, styles.zoomOutButton]}
            onPress={handleZoomOut}
            disabled={currentScale <= 1}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>

          <View style={styles.zoomLevel}>
            <Text style={styles.zoomLevelText}>{(currentScale * 100).toFixed(0)}%</Text>
          </View>

          <TouchableOpacity
            style={[styles.zoomButton, styles.zoomInButton]}
            onPress={handleZoomIn}
            disabled={currentScale >= 5}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>

          {currentScale > 1 && (
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
            Pincez pour zoomer • Double-tap pour zoomer • Glissez pour déplacer
          </Text>
        </View>
      </GestureHandlerRootView>
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
    overflow: 'hidden',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
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
