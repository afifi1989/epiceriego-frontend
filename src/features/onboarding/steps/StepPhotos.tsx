/**
 * StepPhotos — Étape "Photos" du wizard d'onboarding.
 *
 * Deux uploads séparés :
 *  - Logo (photo de profil) : carré, miniature dans listings
 *  - Bannière (photo de présentation) : large, en-tête de la fiche
 *
 * Chaque upload est indépendant — l'épicier peut ne mettre qu'un des
 * deux. La sauvegarde est faite immédiatement à la sélection (pour
 * que l'utilisateur voie le résultat avant de "Continuer"). Le
 * submit() final n'a alors plus rien à uploader, juste à signaler
 * l'étape complete au backend (fait par le wizard).
 */

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { epicerieService } from '../../../services/epicerieService';
import { colors, radii, space, typography } from '../theme';
import type { StepHandle, StepProps } from './stepProps';

type Slot = 'profile' | 'presentation';

export const StepPhotos = forwardRef<StepHandle, StepProps>(
  function StepPhotos({ epicerie, busy }, ref) {
    const [profileUrl, setProfileUrl] = useState(epicerie.photoUrl ?? null);
    const [presentationUrl, setPresentationUrl] = useState(
      epicerie.presentationPhotoUrl ?? null,
    );
    const [uploading, setUploading] = useState<Slot | null>(null);

    const pickAndUpload = async (slot: Slot) => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Autorisation refusée',
          'Activez l\'accès à vos photos pour pouvoir en sélectionner une.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: slot === 'profile' ? [1, 1] : [16, 9],
        quality: 0.85,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setUploading(slot);
      try {
        const updated = slot === 'profile'
          ? await epicerieService.uploadProfilePhoto(asset.uri)
          : await epicerieService.uploadPresentationPhoto(epicerie.id, asset.uri);
        if (slot === 'profile') {
          setProfileUrl(updated.photoUrl ?? null);
        } else {
          setPresentationUrl(updated.presentationPhotoUrl ?? null);
        }
      } catch (err: any) {
        Alert.alert('Upload échoué', err?.message ?? 'Réessayez plus tard.');
      } finally {
        setUploading(null);
      }
    };

    useImperativeHandle(ref, () => ({
      // Rien à faire au submit : les uploads ont été persistés au moment
      // de la sélection. On retourne juste true pour laisser le wizard
      // marquer l'étape comme complete.
      async submit() {
        return true;
      },
    }));

    return (
      <View>
        {/* ── Logo ── */}
        <Text style={styles.sectionTitle}>Logo de l'épicerie</Text>
        <Text style={styles.sectionHint}>
          Affiché en miniature dans les listes et la recherche.
        </Text>

        <PhotoSlot
          imageUrl={profileUrl}
          aspectRatio={1}
          uploading={uploading === 'profile'}
          disabled={busy || uploading !== null}
          onPick={() => pickAndUpload('profile')}
          placeholder="Choisir un logo"
        />

        {/* ── Bannière ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Bannière de présentation
        </Text>
        <Text style={styles.sectionHint}>
          Affichée en grand sur la fiche de votre épicerie. Format paysage recommandé.
        </Text>

        <PhotoSlot
          imageUrl={presentationUrl}
          aspectRatio={16 / 9}
          uploading={uploading === 'presentation'}
          disabled={busy || uploading !== null}
          onPick={() => pickAndUpload('presentation')}
          placeholder="Choisir une bannière"
        />
      </View>
    );
  }
);

interface PhotoSlotProps {
  imageUrl: string | null;
  aspectRatio: number;
  uploading: boolean;
  disabled: boolean;
  onPick: () => void;
  placeholder: string;
}

function PhotoSlot({
  imageUrl, aspectRatio, uploading, disabled, onPick, placeholder,
}: PhotoSlotProps) {
  return (
    <TouchableOpacity
      style={[styles.slot, { aspectRatio }]}
      onPress={onPick}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {imageUrl ? (
        <>
          <Image source={{ uri: imageUrl }} style={styles.slotImage} />
          <View style={styles.slotOverlay}>
            <Text style={styles.slotOverlayText}>
              {uploading ? '⏳ Envoi…' : '✏️ Modifier'}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.slotEmpty}>
          {uploading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <Text style={styles.slotIcon}>📷</Text>
              <Text style={styles.slotPlaceholder}>{placeholder}</Text>
              <Text style={styles.slotHint}>Cliquez pour parcourir</Text>
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 4,
    marginLeft: 2,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: space.md - 2,
    marginLeft: 2,
  },
  slot: {
    width: '100%',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    position: 'relative',
  },
  slotImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  slotOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  slotOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  slotEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: space.xl,
  },
  slotIcon: { fontSize: 36, opacity: 0.4 },
  slotPlaceholder: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  slotHint: {
    ...typography.micro,
    color: colors.textSubtle,
    fontSize: 11,
  },
});
