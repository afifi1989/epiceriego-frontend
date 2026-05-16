import React, { useCallback, useEffect, useState } from 'react';
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

  const onPrint = useCallback(async () => {
    if (!card?.qrToken) return;
    try {
      // Lazy import so the screen doesn't crash on builds where expo-print
      // isn't installed yet — the user sees a localized alert instead.
      const Print = await import('expo-print');
      const html = buildPrintHtml(card, t);
      await Print.printAsync({ html });
    } catch (e) {
      console.error('[cardDetail] print failed', e);
      Alert.alert(t('cards.printNotAvailable'));
    }
  }, [card, t]);

  const onShare = useCallback(async () => {
    if (!card?.qrToken) return;
    try {
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');
      const html = buildPrintHtml(card, t);
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
  }, [card, t]);

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

const buildPrintHtml = (card: LoyaltyCard, t: (key: string) => string): string => {
  const title = String(card.epicerieName || '').replace(/</g, '&lt;');
  const qr = encodeURIComponent(card.qrToken || '');
  // Use Google Chart's QR (free, stable since 2007). Image fetched at print
  // time — recipient must have internet, but that's already the case for the
  // app to have loaded the card to begin with.
  const qrImg = `https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${qr}&chld=H|0`;
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
        <img src="${qrImg}" style="width: 320px; height: 320px;"/>
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
