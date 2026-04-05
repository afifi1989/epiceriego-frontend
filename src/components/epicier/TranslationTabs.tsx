/**
 * TranslationTabs — Saisie multi-langue pour l'épicier
 *
 * Affiche 4 onglets (FR / AR / EN / TZ) permettant de saisir le nom et la
 * description d'un produit ou d'une catégorie dans chaque langue supportée.
 *
 * Règles UX :
 *  - Le français (FR) est obligatoire — indiqué par un astérisque rouge.
 *  - Les autres langues sont optionnelles.
 *  - L'arabe utilise l'alignement RTL (textAlign: 'right').
 *  - Un indicateur visuel (point vert) signale les langues déjà renseignées.
 *
 * Usage :
 *   <TranslationTabs
 *     translations={translations}
 *     onChange={setTranslations}
 *   />
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EMPTY_TRANSLATIONS,
  SUPPORTED_LANGUAGES,
  type ProductTranslations,
  type SupportedLanguage,
} from '../../type';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface TranslationTabsProps {
  translations: ProductTranslations;
  onChange: (translations: ProductTranslations) => void;
  /** Langue qui affiche l'indicateur "requis" (par défaut 'fr') */
  requiredLanguage?: SupportedLanguage;
  /**
   * Callback déclenché quand l'épicier appuie sur "Traduire automatiquement".
   * La fonction doit retourner les traductions AR/EN/TZ générées.
   * Si absent, le bouton n'est pas affiché.
   */
  onAutoTranslate?: () => Promise<Partial<ProductTranslations>>;
  /** Vrai si la traduction est en cours (affiche un spinner) */
  translating?: boolean;
}

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

export const TranslationTabs: React.FC<TranslationTabsProps> = ({
  translations,
  onChange,
  requiredLanguage = 'fr',
  onAutoTranslate,
  translating = false,
}) => {
  const [activeLang, setActiveLang] = useState<SupportedLanguage>('fr');

  const current = translations[activeLang] ?? EMPTY_TRANSLATIONS[activeLang];
  const isRTL = SUPPORTED_LANGUAGES.find((l) => l.code === activeLang)?.dir === 'rtl';

  /** Mettre à jour un champ d'une langue */
  const updateField = (field: 'nom' | 'description', value: string) => {
    onChange({
      ...translations,
      [activeLang]: {
        ...translations[activeLang],
        [field]: value,
      },
    });
  };

  /** Un onglet langue est "rempli" si son nom n'est pas vide */
  const isFilled = (code: SupportedLanguage) =>
    (translations[code]?.nom ?? '').trim().length > 0;

  return (
    <View style={styles.container}>

      {/* ── Sélecteur de langue ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.langBar}
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = lang.code === activeLang;
          const filled = isFilled(lang.code);
          const required = lang.code === requiredLanguage;

          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langTab, active && styles.langTabActive]}
              onPress={() => setActiveLang(lang.code)}
              activeOpacity={0.7}
            >
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                {lang.label}
              </Text>
              {/* Indicateur : requis ou rempli */}
              {required && !filled ? (
                <View style={styles.dotRequired} />
              ) : filled ? (
                <View style={styles.dotFilled} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Bouton traduction automatique ── */}
      {onAutoTranslate && (
        <View style={styles.translateRow}>
          <TouchableOpacity
            style={[styles.translateBtn, translating && styles.translateBtnDisabled]}
            onPress={onAutoTranslate}
            disabled={translating}
            activeOpacity={0.75}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.translateBtnIcon}>🌐</Text>
            )}
            <Text style={styles.translateBtnText}>
              {translating ? 'Traduction en cours…' : 'Traduire automatiquement'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.translateHint}>AR · EN · TZ depuis le français</Text>
        </View>
      )}

      {/* ── Légende ── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotRequired]} />
          <Text style={styles.legendText}>Requis</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotFilled]} />
          <Text style={styles.legendText}>Renseigné</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotEmpty]} />
          <Text style={styles.legendText}>Optionnel</Text>
        </View>
      </View>

      {/* ── Champs de saisie pour la langue active ── */}
      <View style={styles.fields}>

        {/* Nom */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Nom
            {activeLang === requiredLanguage && (
              <Text style={styles.required}> *</Text>
            )}
            <Text style={styles.fieldLangHint}>  ({SUPPORTED_LANGUAGES.find((l) => l.code === activeLang)?.label})</Text>
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={current.nom}
            onChangeText={(v) => updateField('nom', v)}
            placeholder={activeLang === 'fr' ? 'Ex : Huile d\'olive…' : '…'}
            placeholderTextColor="#bbb"
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Description
            <Text style={styles.optional}> (optionnel)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textarea, isRTL && styles.inputRTL]}
            value={current.description}
            onChangeText={(v) => updateField('description', v)}
            placeholder="Courte description…"
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 14,
  },

  // Barre des onglets langue
  langBar: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 6,
    flexDirection: 'row',
  },
  langTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
  },
  langTabActive: {
    backgroundColor: '#1976d2',
  },
  langFlag: { fontSize: 16 },
  langLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  langLabelActive: { color: '#fff' },

  // Bouton traduction automatique
  translateRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 6,
  },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1976d2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  translateBtnDisabled: {
    opacity: 0.65,
  },
  translateBtnIcon: { fontSize: 16 },
  translateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  translateHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#999',
  },

  // Points d'indicateur
  dotRequired: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#e53935',
  },
  dotFilled: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#43a047',
  },
  dotEmpty: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ccc',
  },

  // Légende
  legend: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11, color: '#999' },

  // Champs
  fields: {
    padding: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    marginBottom: 6,
  },
  fieldLangHint: { fontSize: 11, fontWeight: '400', color: '#999' },
  required: { color: '#e53935' },
  optional: { fontSize: 11, fontWeight: '400', color: '#999' },

  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  inputRTL: {
    // Pour l'arabe : pas de changement de style supplémentaire,
    // textAlign est géré directement sur le TextInput
  },
  textarea: { height: 80, paddingTop: 10 },
});
