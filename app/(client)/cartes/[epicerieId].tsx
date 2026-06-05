import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { LoyaltyCardVisual } from '../../../src/components/client/LoyaltyCardVisual';
import {
  loyaltyCardService,
  LoyaltyCard,
  minutesUntilExpiry,
} from '../../../src/services/loyaltyCardService';
import { useLanguage } from '../../../src/context/LanguageContext';
import { tFmt } from '../../../src/services/chatbotService';

/**
 * Full-screen card detail with the QR. Three actions:
 *  - Refresh the QR (re-fetch from server, used after the 24h expiry).
 *  - Print as PDF via expo-print.
 *  - Share the same PDF via expo-sharing.
 *
 * The print/share flow generates a vector-quality PDF (the QR is rendered as
 * SVG by the html2canvas-free approach: we embed the QR as a remote image of
 * the JWT via google charts API). expo-print is loaded lazily so the screen
 * still works on builds where the native module is missing — the user gets a
 * localized "not available" alert instead of a crash.
 */
export default function CardDetailScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ epicerieId: string }>();
  const epicerieId = Number(params.epicerieId);

  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Référence vers le QRCode off-screen dédié à la génération PDF.
  // `react-native-qrcode-svg` expose `toDataURL(cb)` qui rend le QR en PNG
  // base64 — embed direct dans l'<img> du HTML, sans dépendance externe
  // (l'ancienne URL `chart.googleapis.com` est morte depuis 2019).
  const printQrRef = useRef<{ toDataURL: (cb: (dataURL: string) => void) => void } | null>(null);

  const loadCard = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      // The detail page hits refresh-qr to get a fresh token rather than
      // listing all cards — same data shape, less server work.
      const data = await loyaltyCardService.refreshQr(epicerieId);
      setCard(data);
    } catch (e: any) {
      console.error('[cardDetail] load failed', e);
      setErrorCode(e?.errorCode || 'LOYALTY_CARD_ERROR');
    } finally {
      setLoading(false);
    }
  }, [epicerieId]);

  useEffect(() => {
    if (Number.isFinite(epicerieId)) {
      loadCard();
    }
  }, [epicerieId, loadCard]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const data = await loyaltyCardService.refreshQr(epicerieId);
      setCard(data);
    } catch (e: any) {
      const code = e?.errorCode || 'LOYALTY_CARD_ERROR';
      Alert.alert(t('cards.refreshError'), t(`cards.error.${code}`));
      // Card revoked => navigate back; the list will hide the entry on focus.
      if (code === 'CARD_REVOKED') {
        router.back();
      }
    } finally {
      setRefreshing(false);
    }
  }, [epicerieId, refreshing, t, router]);

  /**
   * Convertit le QR off-screen en data URL PNG.
   * Le ref n'est dispo que si le composant a fini son render initial (donc
   * après que `card.qrToken` soit défini). Sur builds où la lib SVG manque
   * d'expose `toDataURL`, on rejette et le caller affichera une alerte.
   */
  const getQrDataUrl = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const ref = printQrRef.current;
      if (!ref || typeof ref.toDataURL !== 'function') {
        reject(new Error('QR ref unavailable'));
        return;
      }
      try {
        ref.toDataURL((dataURL: string) => {
          // toDataURL renvoie le base64 brut (sans préfixe data:image/png).
          if (!dataURL) reject(new Error('Empty QR dataURL'));
          else resolve(`data:image/png;base64,${dataURL}`);
        });
      } catch (e) {
        reject(e);
      }
    });
  }, []);

  const onPrint = useCallback(async () => {
    if (!card?.qrToken) return;
    try {
      // Lazy import so the screen doesn't crash on builds where expo-print
      // isn't installed yet — the user sees a localized alert instead.
      const Print = await import('expo-print');
      const qrDataUrl = await getQrDataUrl();
      const html = buildPrintHtml(card, t, qrDataUrl);
      await Print.printAsync({ html });
    } catch (e) {
      console.error('[cardDetail] print failed', e);
      Alert.alert(t('cards.printNotAvailable'));
    }
  }, [card, t, getQrDataUrl]);

  const onShare = useCallback(async () => {
    if (!card?.qrToken) return;
    try {
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');
      const qrDataUrl = await getQrDataUrl();
      const html = buildPrintHtml(card, t, qrDataUrl);
      const { uri } = await Print.printToFileAsync({ html });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t('cards.shareNotAvailable'));
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: tFmt(t, 'cards.pdfTitle', { store: card.epicerieName }),
      });
    } catch (e) {
      console.error('[cardDetail] share failed', e);
      Alert.alert(t('cards.shareNotAvailable'));
    }
  }, [card, t, getQrDataUrl]);

  // ─── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────
  if (errorCode || !card) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {t(`cards.error.${errorCode || 'LOYALTY_CARD_ERROR'}`)}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadCard}>
          <Text style={styles.retryBtnText}>{t('cards.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const minutesLeft = minutesUntilExpiry(card.qrExpiresAt);
  const expiryLabel =
    minutesLeft === null
      ? null
      : minutesLeft === 0
        ? t('cards.qrExpired')
        : tFmt(t, 'cards.qrExpiresIn', { minutes: minutesLeft });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LoyaltyCardVisual card={card} qrSize={240} />

      {/* QR off-screen dédié à l'impression : taille 400 pour une bonne
          résolution print, positionné hors champ visuel. Doit être monté
          pour que `toDataURL` fonctionne — c'est ici qu'on capture le PNG
          base64 utilisé dans le PDF. */}
      {card.active && card.qrToken ? (
        <View style={styles.offscreenQr} pointerEvents="none">
          <QRCode
            value={card.qrToken}
            size={400}
            color="#212121"
            backgroundColor="#fff"
            quietZone={20}
            getRef={(ref: any) => { printQrRef.current = ref; }}
          />
        </View>
      ) : null}

      {expiryLabel && card.active ? (
        <Text style={styles.expiryLabel}>{expiryLabel}</Text>
      ) : null}

      <View style={styles.actions}>
        <ActionButton
          icon="🔄"
          label={refreshing ? t('cards.qrRefreshing') : t('cards.refresh')}
          onPress={onRefresh}
          disabled={refreshing || !card.active}
        />
        <ActionButton
          icon="🖨"
          label={t('cards.print')}
          onPress={onPrint}
          disabled={!card.active}
        />
        <ActionButton
          icon="📤"
          label={t('cards.share')}
          onPress={onShare}
          disabled={!card.active}
        />
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Action button
// ─────────────────────────────────────────────────────────────────────────

interface ActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Text style={styles.actionIcon}>{icon}</Text>
    <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────
// PDF rendering — uses Google Charts QR API since we can't embed the SVG
// component into the print HTML. The QR data is the same JWT as the on-screen
// QR, so what's printed is what gets scanned.
// ─────────────────────────────────────────────────────────────────────────

const buildPrintHtml = (
  card: LoyaltyCard,
  t: (key: string) => string,
  qrDataUrl: string,
): string => {
  const title = String(card.epicerieName || '').replace(/</g, '&lt;');
  const titleText = (t('cards.pdfTitle') || '')
    .replace('{{store}}', title)
    .replace(/</g, '&lt;');
  const footerText = (t('cards.pdfFooter') || '')
    .replace('{{store}}', title)
    .replace(/</g, '&lt;');

  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"/><title>${titleText}</title></head>
      <body style="font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 32px; text-align: center;">
        <h1 style="font-size: 22px; margin: 0 0 8px;">${title}</h1>
        <p style="font-size: 14px; color: #666; margin: 0 0 24px;">${titleText}</p>
        <img src="${qrDataUrl}" style="width: 320px; height: 320px;" alt="QR"/>
        <p style="font-size: 13px; color: #555; margin-top: 24px;">${footerText}</p>
      </body>
    </html>
  `;
};

// ─────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 32,
  },
  expiryLabel: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: '#888',
  },
  // QR caché : monté dans l'arbre pour que `toDataURL` ait quelque chose
  // à sérialiser. On garde la taille réelle (le SVG a besoin d'un layout
  // valide pour générer ses pixels) mais on le pousse hors écran. Une taille
  // 0 + opacity 0 empêcherait le rendu et toDataURL renverrait du vide.
  offscreenQr: {
    position: 'absolute',
    top: -10000,
    left: -10000,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionLabelDisabled: {
    color: '#999',
  },
  errorText: {
    fontSize: 14,
    color: '#B00020',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
