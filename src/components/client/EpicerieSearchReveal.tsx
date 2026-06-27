import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * EpicerieSearchReveal — barre de recherche qui apparaît en slide-down sous
 * les onglets quand l'utilisateur tape sur la loupe du hero ou du mini-header.
 *
 * <p>Au repos : composant <strong>non monté visuellement</strong> (translaté
 * hors-écran + opacity 0), pour ne pas voler de pixels aux produits. À l'appui
 * sur la loupe : slide-down 220ms + autoFocus du TextInput → frappe immédiate.
 * Le ✕ ferme la barre (efface ou non selon préférence de l'utilisateur).</p>
 *
 * <p>Sous la barre : chips des recherches récentes (8 max, MRU). Tap = ré-exécute
 * la requête, ✕ par chip = retire l'entrée de l'historique. Pattern Glovo/JOW :
 * la frappe est rare quand l'utilisateur ré-achète souvent les mêmes choses.</p>
 *
 * <p>Le composant est <em>contrôlé</em> par le parent — il ne stocke pas la
 * query ni l'historique. Cela permet au parent de garder la donnée au-delà
 * de la fermeture de la barre (utile pour le pre-fill au prochain reveal).</p>
 */
export interface EpicerieSearchRevealProps {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  /**
   * Optionnel : appelé quand l'utilisateur tape sur le ✕ à l'intérieur du
   * champ de recherche. Si absent, fallback à {@code onChange('')}. Utile pour
   * que le parent déclenche un re-fetch immédiat (sinon l'input se vide mais
   * la liste continue d'afficher les résultats filtrés).
   */
  onClear?: () => void;
  placeholder?: string;
  history?: string[];
  onHistoryPick?: (q: string) => void;
  onHistoryRemove?: (q: string) => void;
  /** Couleur d'accent (focus border, icône loupe). */
  accentColor: string;
  /** Labels traduits côté parent. */
  labels?: {
    recentSearches?: string;
  };
}

export const EpicerieSearchReveal: React.FC<EpicerieSearchRevealProps> = ({
  visible,
  value,
  onChange,
  onSubmit,
  onClose,
  onClear,
  placeholder,
  history = [],
  onHistoryPick,
  onHistoryRemove,
  accentColor,
  labels,
}) => {
  // Animations : translate-Y -60 → 0, opacity 0 → 1. useNativeDriver:true
  // car translate + opacity sont supportés en natif.
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(visible ? 0 : -60)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : -60,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    if (visible) {
      // Focus différé pour laisser l'animation démarrer (sinon le clavier
      // se cale mal sur certains Android).
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      inputRef.current?.blur();
    }
  }, [visible, translateY, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        // Safe area top : sur iPhone à encoche, sans cette compensation la
        // barre apparaît partiellement masquée par la status bar.
        { paddingTop: insets.top, transform: [{ translateY }], opacity },
      ]}
    >
      {/* Barre input principal */}
      <View style={styles.inputRow}>
        <View style={[styles.inputWrap, { borderColor: visible ? accentColor : '#E0E0E0' }]}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor="#AAA"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {value.length > 0 && (
            <Pressable
              onPress={() => (onClear ? onClear() : onChange(''))}
              hitSlop={8}
              style={styles.clearInsideBtn}
            >
              <Text style={styles.clearInsideText}>✕</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Fermer la recherche"
          hitSlop={6}
        >
          <Text style={[styles.closeText, { color: accentColor }]}>Annuler</Text>
        </Pressable>
      </View>

      {/* Recherches récentes — uniquement si l'input est vide */}
      {value.length === 0 && history.length > 0 && (
        <View style={styles.historyWrap}>
          <Text style={styles.historyLabel}>
            {labels?.recentSearches ?? 'Recherches récentes'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyContent}
          >
            {history.map((q) => (
              <View key={q} style={styles.historyChip}>
                <Pressable
                  onPress={() => onHistoryPick?.(q)}
                  style={styles.historyChipMain}
                  hitSlop={4}
                >
                  <Ionicons name="time-outline" size={13} color="#52575C" />
                  <Text style={styles.historyChipText} numberOfLines={1}>{q}</Text>
                </Pressable>
                {onHistoryRemove && (
                  <Pressable
                    onPress={() => onHistoryRemove(q)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 4 }}
                    style={styles.historyChipClose}
                  >
                    <Text style={styles.historyChipCloseText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    // Ombre subtile pour que la barre paraisse "flotter" légèrement
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // ── Ligne input + bouton fermer ─────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginEnd: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1F1F1F',
    padding: 0,
  },
  clearInsideBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 6,
  },
  clearInsideText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '700',
  },
  closeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Historique recherches ───────────────────────────────────────────
  historyWrap: {
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  historyLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  historyContent: {
    flexDirection: 'row',
    gap: 8,
    paddingEnd: 12,
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    borderRadius: 16,
    paddingStart: 10,
    paddingEnd: 4,
    height: 30,
  },
  historyChipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingEnd: 6,
  },
  historyChipText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    maxWidth: 140,
  },
  historyChipClose: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyChipCloseText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '700',
  },
});
