import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { STORAGE_KEYS } from '../src/constants/config';
import api from '../src/services/api';

type Status = 'ok' | 'warn' | 'error' | 'unknown';

type PermState = {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
};

const COLORS: Record<Status, string> = {
  ok: '#2E7D32',
  warn: '#EF6C00',
  error: '#C62828',
  unknown: '#546E7A',
};

const BG: Record<Status, string> = {
  ok: '#E8F5E9',
  warn: '#FFF3E0',
  error: '#FFEBEE',
  unknown: '#ECEFF1',
};

function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[status], borderColor: COLORS[status] }]}>
      <Text style={[styles.badgeText, { color: COLORS[status] }]}>{label}</Text>
    </View>
  );
}

function Row({ label, value, status }: { label: string; value: string; status?: Status }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue} selectable numberOfLines={3}>
          {value}
        </Text>
        {status && <StatusBadge status={status} label={status.toUpperCase()} />}
      </View>
    </View>
  );
}

export default function PushDiagnosticScreen() {
  const router = useRouter();

  const [isPhysical, setIsPhysical] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [osLabel, setOsLabel] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [packageName, setPackageName] = useState<string>('');

  const [perm, setPerm] = useState<PermState | null>(null);
  const [expoToken, setExpoToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [jwtPresent, setJwtPresent] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [loadingToken, setLoadingToken] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [loadingTestPush, setLoadingTestPush] = useState(false);

  const refresh = useCallback(async () => {
    setIsPhysical(Device.isDevice);
    setDeviceLabel(`${Device.brand || '?'} ${Device.modelName || '?'}`);
    setOsLabel(`${Platform.OS} ${Device.osVersion || ''}`.trim());

    const pid =
      Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || null;
    setProjectId(pid ?? null);

    const pkg =
      (Constants.expoConfig as any)?.android?.package ||
      (Constants as any).platform?.android?.package ||
      '';
    setPackageName(pkg);

    try {
      const p = await Notifications.getPermissionsAsync();
      setPerm({
        status: p.status,
        granted: p.status === 'granted',
        canAskAgain: !!p.canAskAgain,
      });
    } catch (e: any) {
      setPerm({ status: `error: ${e?.message}`, granted: false, canAskAgain: false });
    }

    const jwt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    setJwtPresent(!!jwt);
    setRole(await AsyncStorage.getItem(STORAGE_KEYS.ROLE));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      Alert.alert('Permissions', `Résultat : ${status}`);
      await refresh();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de demander les permissions');
    }
  };

  const fetchToken = async () => {
    setTokenError(null);
    setExpoToken(null);
    setLoadingToken(true);
    try {
      if (!isPhysical) {
        const testToken = `ExponentPushToken[TEST_${Date.now()}]`;
        setExpoToken(testToken);
        return;
      }
      if (!projectId) {
        setTokenError('projectId manquant dans app.json → extra.eas.projectId');
        return;
      }
      if (perm?.status !== 'granted') {
        setTokenError(`Permissions non accordées (${perm?.status}). Cliquez "Demander les permissions".`);
        return;
      }
      const res = await Notifications.getExpoPushTokenAsync({ projectId });
      setExpoToken(res?.data ?? null);
      if (!res?.data) setTokenError('Expo a répondu sans token.');
    } catch (e: any) {
      // Erreurs typiques sur Android standalone sans Firebase :
      // - "Default FirebaseApp is not initialized in this process"
      // - "FIS_AUTH_ERROR" / "SERVICE_NOT_AVAILABLE"
      setTokenError(`${e?.code || 'Error'} — ${e?.message || e}`);
    } finally {
      setLoadingToken(false);
    }
  };

  const copyToken = async () => {
    if (!expoToken) return;
    await Clipboard.setStringAsync(expoToken);
    Alert.alert('Copié', 'Le token a été copié dans le presse-papiers.');
  };

  const registerOnBackend = async () => {
    if (!expoToken) {
      Alert.alert('Token manquant', 'Cliquez d\'abord sur "Récupérer le token Expo".');
      return;
    }
    if (!jwtPresent) {
      Alert.alert('Non connecté', 'Vous devez être connecté pour enregistrer le device.');
      return;
    }
    setLoadingRegister(true);
    try {
      const payload = {
        expoPushToken: expoToken,
        deviceType: osLabel || 'Unknown',
        platform: deviceLabel || Platform.OS,
      };
      const res = await api.post('/notifications/register-device', payload);
      Alert.alert('Succès', `HTTP ${res.status}\n${JSON.stringify(res.data).substring(0, 200)}`);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      Alert.alert('Échec', `HTTP ${status ?? '?'}\n${msg}`);
    } finally {
      setLoadingRegister(false);
    }
  };

  const sendTestPush = async () => {
    if (!expoToken) {
      Alert.alert('Token manquant', 'Cliquez d\'abord sur "Récupérer le token Expo".');
      return;
    }
    setLoadingTestPush(true);
    try {
      const body = {
        to: expoToken,
        sound: 'default',
        title: 'Test diagnostic',
        body: 'Si vous voyez ça, les push fonctionnent ✅',
        priority: 'high',
        channelId: 'default',
        data: { type: 'ALERT', diagnostic: true },
      };
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      Alert.alert(
        'Envoi via Expo',
        `Status HTTP ${resp.status}\n${JSON.stringify(json).substring(0, 400)}`,
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Envoi impossible');
    } finally {
      setLoadingTestPush(false);
    }
  };

  const showLocalNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Notif locale',
          body: 'Ce test ne passe pas par Expo — il valide juste l\'affichage.',
          data: { type: 'LOCAL' },
        },
        trigger: null,
      });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de planifier');
    }
  };

  // Statuts dérivés
  const deviceStatus: Status = isPhysical ? 'ok' : 'warn';
  const projectStatus: Status = projectId ? 'ok' : 'error';
  const permStatus: Status =
    perm?.granted ? 'ok' : perm?.status === 'denied' ? 'error' : 'warn';
  const tokenStatus: Status = expoToken ? 'ok' : tokenError ? 'error' : 'unknown';
  const jwtStatus: Status = jwtPresent ? 'ok' : 'warn';

  return (
    <>
      <Stack.Screen options={{ title: 'Diagnostic Push' }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Device */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Appareil</Text>
          <Row
            label="Type"
            value={isPhysical ? 'Physique' : 'Émulateur / Simulator'}
            status={deviceStatus}
          />
          <Row label="Modèle" value={deviceLabel} />
          <Row label="OS" value={osLabel} />
        </View>

        {/* Expo config */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Config Expo</Text>
          <Row
            label="projectId"
            value={projectId || '❌ absent'}
            status={projectStatus}
          />
          <Row label="package / bundleId" value={packageName || '—'} />
          <Row
            label="expo-notifications"
            value={
              (Constants.expoConfig?.plugins as any)?.some((p: any) =>
                Array.isArray(p) ? p[0] === 'expo-notifications' : p === 'expo-notifications',
              )
                ? 'présent'
                : 'absent'
            }
          />
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Permissions</Text>
          <Row label="Statut" value={perm?.status || '—'} status={permStatus} />
          <Row
            label="canAskAgain"
            value={perm?.canAskAgain === undefined ? '—' : String(perm.canAskAgain)}
          />
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Demander les permissions</Text>
          </TouchableOpacity>
        </View>

        {/* Token Expo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎟️ Token Expo Push</Text>
          <Row
            label="Token"
            value={
              expoToken
                ? expoToken
                : tokenError
                ? `❌ ${tokenError}`
                : 'Pas encore récupéré'
            }
            status={tokenStatus}
          />
          <TouchableOpacity
            style={[styles.button, loadingToken && styles.buttonDisabled]}
            onPress={fetchToken}
            disabled={loadingToken}
          >
            {loadingToken ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Récupérer le token Expo</Text>
            )}
          </TouchableOpacity>
          {expoToken && (
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={copyToken}>
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Copier le token</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Auth */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Authentification</Text>
          <Row label="JWT présent" value={jwtPresent ? 'oui' : 'non'} status={jwtStatus} />
          <Row label="Rôle" value={role || '—'} />
        </View>

        {/* Actions backend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Tests</Text>

          <TouchableOpacity
            style={[styles.button, loadingRegister && styles.buttonDisabled]}
            onPress={registerOnBackend}
            disabled={loadingRegister}
          >
            {loadingRegister ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Enregistrer sur le backend</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loadingTestPush && styles.buttonDisabled]}
            onPress={sendTestPush}
            disabled={loadingTestPush}
          >
            {loadingTestPush ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Envoyer un push test (Expo → ce device)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={showLocalNotification}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              Notif locale (vérifie l'affichage)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={refresh}>
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Rafraîchir l'état</Text>
          </TouchableOpacity>
        </View>

        {/* Aide */}
        <View style={[styles.section, { backgroundColor: '#FFF8E1' }]}>
          <Text style={styles.sectionTitle}>💡 Que faire si le token échoue ?</Text>
          <Text style={styles.helpLine}>• Le token commence par ExponentPushToken[...] → OK.</Text>
          <Text style={styles.helpLine}>• Token "TEST_..." → vous êtes sur un émulateur.</Text>
          <Text style={styles.helpLine}>
            • Erreur « FirebaseApp is not initialized » → il manque google-services.json + credentials
            FCM V1 uploadés chez Expo (voir app.json "googleServicesFile" et `eas credentials`).
          </Text>
          <Text style={styles.helpLine}>
            • Permissions refusées définitivement → Paramètres Android &gt; Notifications &gt;
            AbridGO.
          </Text>
          <Text style={styles.helpLine}>
            • « Enregistrer sur le backend » répond HTTP 401 → JWT expiré, reconnectez-vous.
          </Text>
          <Text style={styles.helpLine}>
            • Push test Expo reçoit "DeviceNotRegistered" → reinstaller l'app ou rebuilder avec les
            bons credentials.
          </Text>
        </View>

        {!router.canGoBack() ? null : (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary, { marginHorizontal: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Retour</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B2A4A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  rowLabel: {
    fontSize: 13,
    color: '#546E7A',
    flex: 1,
    fontWeight: '500',
  },
  rowRight: {
    flex: 2,
    alignItems: 'flex-end',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    color: '#212121',
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonSecondary: {
    backgroundColor: '#ECEFF1',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  buttonTextSecondary: {
    color: '#1B2A4A',
  },
  helpLine: {
    fontSize: 12,
    color: '#5D4037',
    marginBottom: 6,
    lineHeight: 18,
  },
});
