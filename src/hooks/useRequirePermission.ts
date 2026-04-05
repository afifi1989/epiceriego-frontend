/**
 * Hook de garde de permission pour les écrans Expo Router.
 *
 * Usage :
 *   const ready = useRequirePermission('stats:view');
 *   if (!ready) return null; // redirige automatiquement vers dashboard
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants/config';
import { Feature, getUserProfile, PROFILE_PERMISSIONS } from './usePermissions';
import { LoginResponse } from '../type';

export function useRequirePermission(feature: Feature): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER).then(raw => {
      const loginData: LoginResponse | null = raw ? JSON.parse(raw) : null;
      const profile = getUserProfile(loginData);
      const allowed = PROFILE_PERMISSIONS[profile].includes(feature);

      if (!allowed) {
        // Pas de permission → retour au dashboard
        router.replace('/(epicier)/dashboard');
      } else {
        setReady(true);
      }
    });
  }, []);

  return ready;
}
