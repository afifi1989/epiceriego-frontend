/**
 * Hook de garde de permission pour les ecrans Expo Router.
 *
 * <p>Consulte d'abord la liste {@code permissions[]} du backend (source de verite,
 * stockee dans le LoginResponse depuis V97+), puis retombe sur la matrice statique
 * cote client si la liste est absente.</p>
 *
 * <p><b>Check synchrone</b> quand le user est deja en cache (cas typique post-login
 * via {@link useCurrentUser}) : evite les fetches mort-nes pendant que le routage
 * asynchrone vers /dashboard se met en place. Pour le 1er render froid, on tombe
 * sur AsyncStorage et on attend.</p>
 *
 * Usage :
 *   const ready = useRequirePermission('stats:view');
 *   if (!ready) return null; // redirige automatiquement vers dashboard
 *
 * Pour eviter les fetches premature, gate aussi vos useEffect/useFocusEffect sur
 * {@code ready} : {@code if (!ready) return;}.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../constants/config';
import {
  Feature,
  FEATURE_TO_BACKEND,
  getUserProfile,
  PROFILE_PERMISSIONS,
} from './usePermissions';
import { LoginResponse } from '../type';
import { getCachedUser } from './useCurrentUser';

function isAllowed(loginData: LoginResponse | null, feature: Feature): boolean {
  if (loginData?.permissions && Array.isArray(loginData.permissions)) {
    return loginData.permissions.includes(FEATURE_TO_BACKEND[feature]);
  }
  const profile = getUserProfile(loginData);
  return PROFILE_PERMISSIONS[profile].includes(feature);
}

export function useRequirePermission(feature: Feature): boolean {
  const router = useRouter();

  // 1er passage : check synchrone via le cache module-level si dispo.
  // C'est le cas le plus courant (l'app charge useCurrentUser au mount du layout).
  const syncAllowed = useMemo(() => {
    const cached = getCachedUser();
    if (cached === undefined) return null; // pas encore charge
    return isAllowed(cached, feature);
  }, [feature]);

  const [ready, setReady] = useState<boolean>(syncAllowed === true);

  useEffect(() => {
    // Si on a deja statue en sync, on agit immediatement
    if (syncAllowed === true) {
      setReady(true);
      return;
    }
    if (syncAllowed === false) {
      router.replace('/(epicier)/dashboard');
      return;
    }
    // syncAllowed === null : cache pas encore peuple, on lit AsyncStorage
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      const loginData: LoginResponse | null = raw ? JSON.parse(raw) : null;
      if (isAllowed(loginData, feature)) {
        setReady(true);
      } else {
        router.replace('/(epicier)/dashboard');
      }
    });
  }, [syncAllowed, feature, router]);

  return ready;
}
