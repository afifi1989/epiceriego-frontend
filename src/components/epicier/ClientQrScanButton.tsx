import { Colors } from '../../constants/colors';
import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QrCodeScanner } from '../shared/QrCodeScanner';
import {
  loyaltyCardService,
  LoyaltyCardScanResult,
} from '../../services/loyaltyCardService';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Reusable QR-scan button for the épicier side. Wraps the shared
 * {@link QrCodeScanner} modal and the backend scan call into a single
 * drop-in component, so any place that needs "find a client by QR" gets
 * the same UX and error handling.
 *
 * <p>Used by:
 *  - Vente directe (autoselect the customer at the till)
 *  - Liste clients (jump straight to the customer detail screen)
 *  - Anywhere else in the future without duplicating the flow
 *
 * <p>The component is purely presentational about WHAT to do with the
 * resolved client — that's the parent's job via {@link onResolved}. Errors
 * are handled internally with localized alerts so the parent doesn't need
 * to know the error-code mapping.
 */
export interface ClientQrScanButtonProps {
  /** ID of the épicerie context — passed to the backend scan endpoint. */
  epicerieId: number;
  /** Called once the QR is successfully validated and the customer resolved. */
  onResolved: (result: LoyaltyCardScanResult) => void;
  /** Optional: hide the text label (icon-only button). */
  iconOnly?: boolean;
  style?: ViewStyle;
}

export const ClientQrScanButton: React.FC<ClientQrScanButtonProps> = ({
  epicerieId,
  onResolved,
  iconOnly = false,
  style,
}) => {
  const { t } = useLanguage();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleScanned = useCallback(
    async (qrToken: string) => {
      setVerifying(true);
      try {
        const result = await loyaltyCardService.scanCard(epicerieId, qrToken);
        setScannerVisible(false);
        // Defer onResolved to the next tick: closing the modal first lets the
        // host screen render the new selection without a flash of the camera.
        setTimeout(() => onResolved(result), 0);
      } catch (e: any) {
        const code = e?.errorCode || 'LOYALTY_CARD_ERROR';
        // Keep the scanner open so the épicier can immediately retry or scan
        // a different card without re-opening the modal — the QrCodeScanner
        // re-arms its anti-double-scan as soon as the alert is dismissed.
        Alert.alert(t('loyaltyScan.errorTitle'), t(`loyaltyScan.error.${code}`));
      } finally {
        setVerifying(false);
      }
    },
    [epicerieId, onResolved, t],
  );

  return (
    <>
      <TouchableOpacity
        style={[styles.button, iconOnly && styles.iconOnlyBtn, style]}
        onPress={() => setScannerVisible(true)}
        activeOpacity={0.8}
        // En mode icône seule la cible fait ~36px — hitSlop ramène la zone
        // tactile au-dessus des 44px recommandés (usage comptoir, une main).
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('loyaltyScan.buttonLabel')}
      >
        <MaterialCommunityIcons name="qrcode-scan" size={20} color="#fff" />
        {!iconOnly && <Text style={styles.label}>{t('loyaltyScan.buttonLabel')}</Text>}
      </TouchableOpacity>

      <QrCodeScanner
        visible={scannerVisible}
        onScanned={handleScanned}
        onClose={() => setScannerVisible(false)}
        title={t('loyaltyScan.scannerTitle')}
        subtitle={t('loyaltyScan.scannerSubtitle')}
        isLoading={verifying}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  iconOnlyBtn: {
    paddingHorizontal: 10,
    width: 40,
    height: 40,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
