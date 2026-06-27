export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Personnalisation visuelle de l'épicerie — version mobile épicier.
 *
 * <p>Pendant mobile de la page web {@code /epicier/personnalisation}.
 * Permet à l'épicier de choisir un thème prédéfini (5 presets) + un slogan
 * optionnel. Le branding s'applique à l'app cliente mobile (écran détail
 * épicerie) — pas au back-office épicier.</p>
 *
 * <p><b>UI</b> : grille de cards preset (2 colonnes mobile), input slogan,
 * bouton CTA. Pas de live preview phone mockup ici (compact mobile-first).
 * L'épicier peut tester en ouvrant l'app client.</p>
 */

import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { epicerieService } from '../../src/services/epicerieService';
import {
  brandingService,
  BrandingPreset,
} from '../../src/services/brandingService';

export default function PersonnalisationEpicerieScreen() {
  const router = useRouter();

  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [selectedCode, setSelectedCode] = useState<BrandingPreset['code']>('DEFAULT');
  const [brandStatement, setBrandStatement] = useState('');
  const [epicerieName, setEpicerieName] = useState('Ma boutique');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [presetList, epicerie] = await Promise.all([
          brandingService.listPresets(),
          epicerieService.getMyEpicerie(),
        ]);
        setPresets(presetList);
        if (epicerie?.nomEpicerie) setEpicerieName(epicerie.nomEpicerie);
        if (epicerie?.brandStatement) setBrandStatement(epicerie.brandStatement);
        // Aligner la sélection visuelle sur le preset déjà sauvegardé.
        const currentCode = (epicerie?.themePreset as BrandingPreset['code']) ?? 'DEFAULT';
        const found = presetList.find(p => p.code === currentCode);
        setSelectedCode(found?.code ?? 'DEFAULT');
      } catch (err: any) {
        console.error('[PersonnalisationEpicerie] load error:', err);
        Alert.alert('Erreur', "Impossible de charger les thèmes.");
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await brandingService.updateBranding({
        themePresetCode: selectedCode,
        brandStatement: brandStatement.trim() || undefined,
      });
      Alert.alert(
        'Personnalisation enregistrée',
        'Vos clients verront immédiatement votre nouveau thème dans l\'app.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      const message = err?.response?.data?.message
        ?? err?.message
        ?? 'Erreur lors de la sauvegarde.';
      Alert.alert('Échec', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Personnalisation' }} />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </SafeAreaView>
    );
  }

  const selected = presets.find(p => p.code === selectedCode);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Personnalisation' }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>🎨 Personnalisation visuelle</Text>
          <Text style={styles.headerSubtitle}>
            Choisissez le thème de votre boutique. Vos clients verront ces couleurs
            sur la page de votre épicerie dans l'app.
          </Text>
        </View>

        {/* ── Grille presets (2 colonnes mobile) ── */}
        <Text style={styles.sectionTitle}>Choisissez votre thème</Text>
        <View style={styles.grid}>
          {presets.map(preset => {
            const isSelected = preset.code === selectedCode;
            return (
              <TouchableOpacity
                key={preset.code}
                style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                onPress={() => setSelectedCode(preset.code)}
                activeOpacity={0.8}
              >
                {/* Aperçu visuel : header primary + bandeau subtle + dot accent */}
                <View style={[styles.preview, { backgroundColor: preset.primaryColor }]}>
                  <View style={[styles.previewDot, { backgroundColor: preset.accentColor }]} />
                  <View style={[styles.previewBand, { backgroundColor: preset.primarySubtle }]} />
                </View>
                <Text style={styles.presetLabel}>{preset.label}</Text>
                {preset.description ? (
                  <Text style={styles.presetDesc} numberOfLines={2}>
                    {preset.description}
                  </Text>
                ) : null}
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Slogan ── */}
        <Text style={styles.sectionTitle}>Slogan (optionnel)</Text>
        <View style={styles.statementBox}>
          <TextInput
            style={styles.statementInput}
            value={brandStatement}
            onChangeText={setBrandStatement}
            placeholder="Ex : Fraîcheur garantie depuis 1995"
            placeholderTextColor="#9ca3af"
            maxLength={255}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{brandStatement.length}/255</Text>
        </View>
        <Text style={styles.hint}>
          Affiché sous le nom de votre boutique dans l'app cliente.
        </Text>

        {/* ── Aperçu compact ── */}
        {selected && (
          <>
            <Text style={styles.sectionTitle}>Aperçu</Text>
            <View style={[styles.previewBanner, { backgroundColor: selected.primaryColor }]}>
              <View style={[styles.previewLogo, { backgroundColor: selected.accentColor }]}>
                <Text style={[styles.previewLogoText, { color: selected.onPrimaryColor }]}>
                  {epicerieName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.previewName, { color: selected.onPrimaryColor }]}
                  numberOfLines={1}
                >
                  {epicerieName}
                </Text>
                {brandStatement.trim() ? (
                  <Text
                    style={[styles.previewTagline, { color: selected.onPrimaryColor }]}
                    numberOfLines={2}
                  >
                    {brandStatement.trim()}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.previewStrip, { backgroundColor: selected.primaryColor }]} />
            </View>
          </>
        )}

        {/* ── Save ── */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: selected?.primaryColor ?? '#4CAF50' },
            saving && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Enregistrer mon thème</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  headerBlock: { marginBottom: 20, paddingHorizontal: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  headerSubtitle: { fontSize: 13, color: '#6b7280', lineHeight: 19 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 8,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Grille presets (2 colonnes) ──
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  presetCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  presetCardSelected: {
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  preview: {
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  previewDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  previewBand: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  presetLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  presetDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 3,
    lineHeight: 15,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Slogan ──
  statementBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 6,
  },
  statementInput: {
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 48,
  },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  hint: { fontSize: 12, color: '#9ca3af', marginBottom: 8, paddingHorizontal: 4 },

  // ── Aperçu ──
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  previewLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  previewLogoText: { fontSize: 22, fontWeight: '700' },
  previewName: { fontSize: 18, fontWeight: '800' },
  previewTagline: { fontSize: 12, fontStyle: 'italic', opacity: 0.9, marginTop: 3 },
  previewStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    filter: 'brightness(0.85)' as any,
  },

  // ── Save ──
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
