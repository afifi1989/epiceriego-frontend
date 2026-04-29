/**
 * Service d'impression de ticket de caisse — Axe POS / Sprint 5.
 *
 * <h3>Architecture en port / adapter</h3>
 * Le service expose une API unifiée {@code printReceipt(orderId)}. L'implémentation
 * choisit le backend selon la configuration stockée par {@link printerSettingsService}.
 *
 * Backends disponibles :
 *   - {@code SYSTEM_SHARE}  PDF téléchargé du serveur + partagé via {@code expo-sharing}
 *                            (WhatsApp, Mail, AirPrint, Android Print…) — fonctionne immédiatement
 *   - {@code BLUETOOTH}     Impression directe via imprimante ESC/POS 58/80mm
 *                            (nécessite native module, à ajouter via EAS build)
 *
 * <p>Le backend Bluetooth n'est pas implémenté en S5. Le port est prêt et
 * la configuration persistée ; il suffira d'ajouter l'adapter concret.</p>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

export type PrinterBackend = 'SYSTEM_SHARE' | 'BLUETOOTH' | 'NONE';
export type PaperWidth = 58 | 80;

export interface PrinterSettings {
  backend: PrinterBackend;
  paperWidth: PaperWidth;
  autoPrint: boolean;
  /** MAC address BT (utilisé uniquement si backend = BLUETOOTH). */
  bluetoothDeviceId?: string | null;
  /** Nom lisible du device BT (affichage). */
  bluetoothDeviceName?: string | null;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  backend: 'SYSTEM_SHARE',
  paperWidth: 58,
  autoPrint: false,
  bluetoothDeviceId: null,
  bluetoothDeviceName: null
};

const STORAGE_KEY = 'printerSettings.v1';

// ────────────────────────────────────────────────────────────────────────
// Settings persistence
// ────────────────────────────────────────────────────────────────────────
export const printerSettingsService = {
  async load(): Promise<PrinterSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  async save(settings: Partial<PrinterSettings>): Promise<PrinterSettings> {
    const current = await this.load();
    const next = { ...current, ...settings };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  },

  async reset(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
};

// ────────────────────────────────────────────────────────────────────────
// Téléchargement PDF ticket depuis le backend
// ────────────────────────────────────────────────────────────────────────
const downloadReceiptPdf = async (orderId: number): Promise<string> => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) throw new Error('Non authentifié');

  const fileUri = (FileSystem as any).documentDirectory
      + `ticket-${orderId}-${Date.now()}.pdf`;

  const result = await FileSystem.downloadAsync(
    `${API_CONFIG.BASE_URL}/orders/${orderId}/receipt.pdf`,
    fileUri,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!result || result.status !== 200) {
    throw new Error('Impossible de télécharger le ticket');
  }
  return result.uri;
};

// ────────────────────────────────────────────────────────────────────────
// Port / Backend implementations
// ────────────────────────────────────────────────────────────────────────

/**
 * Backend SYSTEM_SHARE : télécharge le PDF, ouvre la feuille de partage native.
 * L'épicier peut imprimer via AirPrint (iOS), Android Print Service, ou
 * partager via WhatsApp / Mail.
 */
const shareViaSystem = async (orderId: number, silent: boolean = false): Promise<void> => {
  const uri = await downloadReceiptPdf(orderId);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    if (!silent) Alert.alert('Partage non disponible', `Fichier téléchargé : ${uri}`);
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Ticket #${orderId}`,
    UTI: 'com.adobe.pdf'
  });
};

/**
 * Backend BLUETOOTH — stub. Nécessite l'ajout d'un native module
 * (ex: react-native-bluetooth-escpos-printer) via EAS build.
 *
 * Design attendu pour l'implémentation future :
 *   1. Récupérer les settings (paperWidth, bluetoothDeviceId)
 *   2. Récupérer les lignes de la commande + épicerie (via orderService)
 *   3. Construire les commandes ESC/POS (entête, items, total, QR code…)
 *   4. Envoyer au device via le native module
 */
const printViaBluetooth = async (_orderId: number): Promise<void> => {
  throw new Error(
      'Impression Bluetooth pas encore activée. '
    + 'Ajoute react-native-bluetooth-escpos-printer via EAS build.'
  );
};

// ────────────────────────────────────────────────────────────────────────
// API publique
// ────────────────────────────────────────────────────────────────────────
export const receiptPrinterService = {
  /**
   * Imprime / partage le ticket selon la configuration.
   *
   * @param orderId identifiant de la commande
   * @param silent  si true, n'affiche pas d'alerte en cas d'absence de backend
   */
  async printReceipt(orderId: number, silent: boolean = false): Promise<void> {
    const settings = await printerSettingsService.load();
    switch (settings.backend) {
      case 'SYSTEM_SHARE':
        return shareViaSystem(orderId, silent);
      case 'BLUETOOTH':
        return printViaBluetooth(orderId);
      case 'NONE':
      default:
        if (!silent) {
          Alert.alert(
            'Impression désactivée',
            'Configurez une imprimante depuis Paramètres › Imprimante.'
          );
        }
        return;
    }
  },

  /**
   * Version silencieuse pour l'auto-print post-vente : swallows errors
   * pour ne pas bloquer l'UX de la vente.
   */
  async printReceiptSilent(orderId: number): Promise<boolean> {
    try {
      const settings = await printerSettingsService.load();
      if (!settings.autoPrint) return false;
      await this.printReceipt(orderId, true);
      return true;
    } catch (e) {
      console.warn('[Receipt] Auto-print échoué:', e);
      return false;
    }
  },

  /** Test d'impression — utilisé depuis l'écran paramètres avec un orderId réel. */
  async testPrint(orderId: number): Promise<void> {
    await this.printReceipt(orderId, false);
  }
};
