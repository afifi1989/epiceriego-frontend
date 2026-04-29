/**
 * OfflineBanner — Indicateur visuel du mode hors-ligne
 *
 * Affiche une barre contextuelle en haut de l'écran :
 * - Jaune : hors-ligne avec opérations en attente
 * - Rouge : hors-ligne sans cache disponible
 * - Bleu (animée) : synchronisation en cours
 * - Verte (fugace) : retour en ligne confirmé
 *
 * Se masque automatiquement 3s après le retour en ligne.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNetwork } from '../../context/NetworkContext';

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useNetwork();
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const shouldShow = !isOnline || isSyncing || (wasOffline.current && isOnline);

    if (!isOnline) {
      wasOffline.current = true;
    }

    if (shouldShow) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      // Si on revient online et pas de sync → masquer après 3s
      if (isOnline && !isSyncing && pendingCount === 0) {
        hideTimer.current = setTimeout(() => {
          hideBanner();
          wasOffline.current = false;
        }, 3000);
      }
    } else if (isOnline && !isSyncing && pendingCount === 0) {
      hideBanner();
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isOnline, isSyncing, pendingCount]);

  function hideBanner() {
    Animated.timing(slideAnim, {
      toValue: -60,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }

  if (!visible) return null;

  // Déterminer le style et le message
  let backgroundColor = '#FF9800'; // jaune-orange par défaut
  let message = 'Mode hors-ligne';
  let showRetry = false;

  if (isSyncing) {
    backgroundColor = '#2196F3';
    message = 'Synchronisation en cours...';
  } else if (isOnline && pendingCount === 0) {
    backgroundColor = '#4CAF50';
    message = 'Connexion restaurée';
  } else if (!isOnline && pendingCount > 0) {
    backgroundColor = '#FF9800';
    message = `Hors-ligne — ${pendingCount} op. en attente`;
    showRetry = false;
  } else if (!isOnline) {
    backgroundColor = '#FF9800';
    message = 'Mode hors-ligne';
  } else if (isOnline && pendingCount > 0) {
    backgroundColor = '#2196F3';
    message = `${pendingCount} op. en attente`;
    showRetry = true;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>
          {isSyncing ? '...' : isOnline ? '||' : '!'}
        </Text>
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
        {showRetry && (
          <TouchableOpacity onPress={triggerSync} style={styles.retryButton}>
            <Text style={styles.retryText}>Sync</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  message: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
