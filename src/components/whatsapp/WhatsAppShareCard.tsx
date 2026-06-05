/**
 * Carte "Partager mon WhatsApp" cote epicier.
 *
 * Affiche un QR code + le numero + des actions :
 *   - Copier le lien wa.me
 *   - Partager le lien (sheet native iOS/Android)
 *   - Partager/Telecharger le QR au format PNG
 *
 * <p>Le QR est rendu par {@code react-native-qrcode-svg}, expose un toDataURL()
 * qui nous donne le PNG en base64 ; on l'ecrit dans le cache du device puis
 * on ouvre la sheet de partage via {@code expo-sharing} — l'utilisateur choisit
 * "Enregistrer dans Photos" pour l'imprimer ou "Envoyer via WhatsApp" pour
 * partager directement.</p>
 */

import { BorderRadius, Colors, FontSizes, Spacing } from '@/src/constants/colors';
import shopLinkService, { ShareLinkResponse } from '@/src/services/shopLinkService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
// Expo 54 a refactor expo-file-system vers une API à base de classes (File,
// Directory, Paths). Notre besoin (écrire un base64 PNG dans le cache puis
// le partager) reste plus court via l'API legacy, officiellement préservée
// sous /legacy. Si plus tard le projet migre toute la codebase vers la
// nouvelle API, ce composant suivra.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';

const WHATSAPP_GREEN = '#25D366';

export function WhatsAppShareCard() {
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<ShareLinkResponse | null>(null);
  // Ref vers l'instance QRCode pour exporter en PNG (toDataURL).
  const qrRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await shopLinkService.getMyShareLink();
        if (!cancelled) setLink(data);
      } catch (error: any) {
        // L'intercepteur 402 gere deja l'Alert d'upgrade. On ne re-toaste pas.
        if (!error?.__subscriptionGateHandled) {
          Toast.show({
            type: 'error',
            text1: 'Erreur',
            text2: 'Impossible de charger le lien WhatsApp',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyLink = async () => {
    if (!link?.waUrl) return;
    await Clipboard.setStringAsync(link.waUrl);
    Toast.show({
      type: 'success',
      text1: 'Copie',
      text2: 'Lien WhatsApp copie dans le presse-papier',
    });
  };

  const shareLink = async () => {
    if (!link?.waUrl) return;
    try {
      await Share.share({
        message: `Commandez chez nous sur WhatsApp :\n${link.waUrl}`,
        url: link.waUrl,
      });
    } catch (error) {
      // L'utilisateur a annule la sheet — pas une vraie erreur.
      console.warn('[WhatsAppShareCard] Share dismissed:', error);
    }
  };

  /**
   * Exporte le QR en PNG dans le cache puis ouvre la sheet de partage. Sur
   * iOS / Android recents la sheet propose "Enregistrer dans Photos", ce qui
   * permet a l'epicier de l'imprimer pour sa vitrine.
   */
  const shareQrPng = async () => {
    if (!link || !qrRef.current) return;
    try {
      // react-native-qrcode-svg passe le base64 *sans* le prefixe data:.
      qrRef.current.toDataURL(async (base64: string) => {
        try {
          const path = `${FileSystem.cacheDirectory}whatsapp-${link.token}.png`;
          await FileSystem.writeAsStringAsync(path, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const available = await Sharing.isAvailableAsync();
          if (!available) {
            Toast.show({
              type: 'error',
              text1: 'Erreur',
              text2: 'Le partage natif est indisponible sur cet appareil',
            });
            return;
          }
          await Sharing.shareAsync(path, {
            mimeType: 'image/png',
            dialogTitle: 'Partager le QR WhatsApp',
            UTI: 'public.png',
          });
        } catch (innerErr) {
          console.error('[WhatsAppShareCard] QR export failed:', innerErr);
          Toast.show({
            type: 'error',
            text1: 'Erreur',
            text2: 'Impossible de generer le QR',
          });
        }
      });
    } catch (error) {
      console.error('[WhatsAppShareCard] toDataURL failed:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingState]}>
        <ActivityIndicator color={WHATSAPP_GREEN} />
      </View>
    );
  }

  if (!link) {
    return null; // L'erreur a deja ete affichee par le toast
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Partager votre WhatsApp</Text>
          <Text style={styles.subtitle}>
            Imprimez ce QR pour votre vitrine ou partagez le lien — vos clients
            tombent directement sur la conversation.
          </Text>
        </View>
      </View>

      <View style={styles.qrBlock}>
        <View style={styles.qrFrame}>
          <QRCode
            value={link.waUrl}
            size={180}
            backgroundColor="#fff"
            color="#111"
            getRef={(c) => {
              qrRef.current = c;
            }}
          />
        </View>
        <Text style={styles.qrCaption}>Scannez pour commander</Text>
      </View>

      {!!link.displayPhone && (
        <View style={styles.phoneRow}>
          <MaterialCommunityIcons
            name="whatsapp"
            size={20}
            color={WHATSAPP_GREEN}
          />
          <Text style={styles.phoneText}>{link.displayPhone}</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.outlineButton]}
          onPress={copyLink}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="content-copy" size={18} color={Colors.text} />
          <Text style={styles.outlineButtonText}>Copier le lien</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.outlineButton]}
          onPress={shareQrPng}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="qrcode" size={18} color={Colors.text} />
          <Text style={styles.outlineButtonText}>Partager QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={shareLink}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Partager</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  loadingState: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  qrBlock: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  qrFrame: {
    padding: Spacing.md,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrCaption: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  phoneText: {
    fontSize: FontSizes.base,
    fontWeight: '600',
    color: Colors.text,
    // tabular-nums : alignement vertical des chiffres si on rerenforme.
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  outlineButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outlineButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  primaryButton: {
    backgroundColor: WHATSAPP_GREEN,
  },
  primaryButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
});

export default WhatsAppShareCard;
