import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';
import { LoyaltyCard } from '../../services/loyaltyCardService';
import { useLanguage } from '../../context/LanguageContext';
import { Language } from '../../i18n/translations';
import { formatDate } from '../../utils/dateFormat';
import { tFmt } from '../../services/chatbotService';

/**
 * Visual representation of a single loyalty card. Used in two places:
 *  - Compact mode for the list page (no QR, hint to tap for details).
 *  - Full mode for the detail page (QR centered, footer with issued date).
 *
 * The header tint is derived from the épicerie id so each card looks distinct
 * without requiring per-store assets — épiciers can later upload a real logo
 * (already supported via {@code epicerieLogoUrl}) and it'll overlay nicely on
 * the colored background.
 *
 * Compact mode is keyboard/touch-friendly: wrap in a {@code TouchableOpacity}
 * at the call site.
 */
export interface LoyaltyCardVisualProps {
  card: LoyaltyCard;
  /** When true, omits the QR block and shrinks the footer for list rows. */
  compact?: boolean;
  /** Pixel size of the QR. Defaults to 220 (good print resolution at 300dpi). */
  qrSize?: number;
  style?: ViewStyle;
}

export const LoyaltyCardVisual: React.FC<LoyaltyCardVisualProps> = ({
  card,
  compact = false,
  qrSize = 220,
  style,
}) => {
  const { t, language } = useLanguage();
  const tint = colorFromId(card.epicerieId);
  const issuedDate = formatIssuedDate(card.issuedAt, language);

  // Bascule vers les initiales si l'URL renvoie un 404 ou si le chargement
  // echoue (cas SSL/cert Android observe ailleurs dans le projet — cf.
  // memoire "Image upload mobile utilise fetch a cause SSL React Native").
  // Sans ce fallback, le header bleu restait vide et donnait l'impression
  // que le logo etait casse.
  const [logoFailed, setLogoFailed] = useState(false);
  const hasLogoUrl = !!card.epicerieLogoUrl && card.epicerieLogoUrl.trim() !== '';
  const showLogoImage = hasLogoUrl && !logoFailed;

  return (
    <View style={[styles.card, style]}>
      {/* Colored header */}
      <View style={[styles.header, { backgroundColor: tint }]}>
        <View style={styles.headerRow}>
          {showLogoImage ? (
            // expo-image gere mieux les certs HTTPS sur Android que <Image> RN,
            // et a un cache integre — cf. EpicerieCard pour le meme pattern.
            <ExpoImage
              source={{ uri: card.epicerieLogoUrl! }}
              style={styles.logo}
              contentFit="cover"
              transition={150}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoFallbackText}>
                {initials(card.epicerieName)}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.brandName} numberOfLines={1}>
              {card.epicerieName}
            </Text>
            <Text style={styles.cardKind}>
              {t('cards.headerTitle').replace(/^[^\s]+\s/, '')}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              card.active ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text style={styles.statusChipText}>
              {card.active ? t('cards.statusActive') : t('cards.statusInactive')}
            </Text>
          </View>
        </View>
      </View>

      {/* QR block — full mode only */}
      {!compact && (
        <View style={styles.qrBlock}>
          {card.active && card.qrToken ? (
            <>
              <View style={styles.qrFrame}>
                <QRCode
                  value={card.qrToken}
                  size={qrSize}
                  color="#212121"
                  backgroundColor="#fff"
                  quietZone={12}
                />
              </View>
              <Text style={styles.qrHint}>{t('cards.qrHint')}</Text>
            </>
          ) : (
            <View style={styles.revokedOverlay}>
              <Text style={styles.revokedText}>{t('cards.qrRevokedOverlay')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <Text style={styles.footerText}>
          {tFmt(t, 'cards.issuedOn', { date: issuedDate })}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Stable color from an integer id. Uses a deterministic palette so two cards
 * with the same id always render the same tint — good for visual recognition
 * across sessions.
 */
const PALETTE = [
  '#1E88E5', // blue
  '#43A047', // green
  '#E53935', // red
  '#FB8C00', // orange
  '#8E24AA', // purple
  '#00897B', // teal
  '#5E35B1', // deep purple
  '#D81B60', // pink
  '#3949AB', // indigo
  '#7CB342', // light green
];

const colorFromId = (id: number): string => {
  if (!Number.isFinite(id)) return PALETTE[0];
  // Mix high and low bits so consecutive ids get different colors.
  const hash = Math.abs(id * 2654435761) % PALETTE.length;
  return PALETTE[hash];
};

const initials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
};

// Date d'émission localisée selon la langue de l'app (et non la locale
// système) — cohérent avec le reste des dates client (src/utils/dateFormat).
const formatIssuedDate = (iso: string, language: Language): string => {
  if (!iso) return '';
  const formatted = formatDate(iso, language);
  return formatted || iso;
};

// ─────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    // Mild shadow that reads on both Android and iOS without LinearGradient.
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginEnd: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  logoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerText: {
    flex: 1,
  },
  brandName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardKind: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginStart: 8,
  },
  statusActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statusInactive: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  statusChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  qrBlock: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  qrFrame: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qrHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  revokedOverlay: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  revokedText: {
    color: '#B00020',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerCompact: {
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
  },
});
