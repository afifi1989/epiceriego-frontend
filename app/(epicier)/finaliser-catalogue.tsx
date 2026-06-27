export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
/**
 * Écran « Finaliser mon catalogue » — saisie du stock de départ des produits
 * importés/brouillon, hors onboarding (accessible via la bannière des écrans
 * Produits et Dashboard). Réutilise le composant FinaliserStockList.
 *
 * L'activation à la vente n'est PAS gérée ici : elle exige une photo et se
 * fait depuis la fiche produit.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { epicerieService } from '../../src/services/epicerieService';
import type { Epicerie } from '../../src/type';
import {
  FinaliserStockList,
  type FinaliserStockHandle,
} from '../../src/features/onboarding/components/FinaliserStockList';
import { colors } from '../../src/features/onboarding/theme';

export default function FinaliserCatalogueScreen() {
  const router = useRouter();
  const listRef = useRef<FinaliserStockHandle>(null);
  const [epicerie, setEpicerie] = useState<Epicerie | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    epicerieService.getMyEpicerie()
      .then(ep => { if (!cancelled) setEpicerie(ep); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (dirty === 0 || saving) return;
    setSaving(true);
    try {
      const res = await listRef.current?.save();
      const saved = res?.saved ?? 0;
      const failed = res?.failed ?? 0;
      if (failed > 0) {
        Alert.alert('Enregistré en partie', `${saved} produit(s) mis à jour, ${failed} en échec.`);
      } else {
        Alert.alert('Stock enregistré', `${saved} produit(s) approvisionné(s).`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Finaliser mon catalogue</Text>
        <View style={styles.backBtn} />
      </View>

      {loading || !epicerie ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.intro}>
              <Text style={styles.introText}>
                Réglez le stock de vos produits importés. L’activation à la vente
                se fait ensuite depuis chaque fiche, une fois la photo ajoutée.
              </Text>
            </View>
            <FinaliserStockList
              ref={listRef}
              epicerie={epicerie}
              onDirtyChange={setDirty}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSave}
              disabled={dirty === 0 || saving}
              style={({ pressed }) => [
                styles.saveBtn,
                (dirty === 0 || saving) && styles.saveBtnDisabled,
                pressed && dirty > 0 && !saving && styles.saveBtnPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {dirty > 0 ? `Enregistrer le stock (${dirty})` : 'Aucune modification'}
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 24, color: colors.text },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 32 },

  intro: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  introText: { fontSize: 13, lineHeight: 18, color: '#92400E' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: colors.borderStrong },
  saveBtnPressed: { backgroundColor: colors.primaryDark },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
