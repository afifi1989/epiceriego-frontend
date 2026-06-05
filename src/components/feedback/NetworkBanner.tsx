import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authFeedbackBus } from '../../services/auth/authFeedbackBus';
import { useTheme } from '../../theme';

/**
 * Bandeau persistant qui apparait en haut d'ecran quand l'appareil perd la
 * connectivite. A monter une seule fois sous SafeAreaProvider/ToastProvider.
 *
 * <h3>Strategie</h3>
 * <ul>
 *   <li>Source primaire : {@link NetInfo}. {@code isConnected} + {@code isInternetReachable}.
 *       Sur Android/iOS, {@code isInternetReachable} = pingue 8.8.8.8 → reflete
 *       la vraie reachability (pas juste l'etat radio).</li>
 *   <li>Le bandeau s'affiche en orange (warning) et reste visible jusqu'au retour
 *       de connexion. Pas d'auto-dismiss : c'est un etat, pas un evenement.</li>
 *   <li>Emet sur {@link authFeedbackBus} pour declencher les toasts initiaux
 *       (passe en hors-ligne / retour en ligne) en complement du bandeau.</li>
 * </ul>
 *
 * <h3>Faux positifs</h3>
 * Le premier event NetInfo arrive ~100ms apres le mount avec un etat possiblement
 * partiel ({@code isConnected: true, isInternetReachable: null}). On debounce 800ms
 * sur OFFLINE pour eviter le clignotement au boot. Le ONLINE passe immediatement.
 */
export function NetworkBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const wasOfflineRef = useRef(false);
  const offlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      // isInternetReachable peut etre null le temps que le test ping aboutisse.
      // Tant qu'on est connecte au reseau (isConnected) on considere online.
      const offline = state.isConnected === false || state.isInternetReachable === false;

      if (offline) {
        // Debounce : evite le flash au boot quand l'etat est transitoire
        if (offlineDebounceRef.current) clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = setTimeout(() => {
          setIsOffline(true);
          if (!wasOfflineRef.current) {
            wasOfflineRef.current = true;
            authFeedbackBus.emit('network:offline');
          }
        }, 800);
      } else {
        if (offlineDebounceRef.current) {
          clearTimeout(offlineDebounceRef.current);
          offlineDebounceRef.current = null;
        }
        setIsOffline(false);
        if (wasOfflineRef.current) {
          wasOfflineRef.current = false;
          authFeedbackBus.emit('network:online');
        }
      }
    };

    // Etat initial
    NetInfo.fetch().then(apply);
    // Souscription continue
    const unsubscribe = NetInfo.addEventListener(apply);

    return () => {
      unsubscribe();
      if (offlineDebounceRef.current) clearTimeout(offlineDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      translateY.value = withTiming(-80, { duration: 200, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: 160 });
    }
  }, [isOffline, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Quand offline=false ET animation terminee, on garde le composant monte
  // mais pointerEvents=none ne le rend pas interactif.
  return (
    <Animated.View
      pointerEvents={isOffline ? 'auto' : 'none'}
      style={[
        styles.wrapper,
        { paddingTop: insets.top + 6 },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.banner,
          {
            backgroundColor: theme.colors.warning,
          },
        ]}
      >
        <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
        <Text style={styles.text} numberOfLines={1}>
          Hors ligne — les modifications seront perdues
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998, // sous les toasts (9999) mais au-dessus du contenu
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    flexShrink: 1,
  },
});
