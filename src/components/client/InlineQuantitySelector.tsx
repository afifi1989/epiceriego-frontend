import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * InlineQuantitySelector — pastille +/- inline pour ajuster la quantité d'un
 * produit directement depuis la liste épicerie, sans ouvrir la fiche détail.
 *
 * <p>Pattern UX standard sur Glovo / Deliveroo / Uber Eats / Picnic / JOW :
 * <ul>
 *   <li>Avant le 1er ajout : bouton compact "🛒" (ou "+") avec la couleur de
 *       marque de l'épicerie.</li>
 *   <li>Après 1 clic : pill horizontale [−][N][+] qui permet d'ajuster la
 *       quantité sans naviguer vers le détail. Quand on retombe à 0, on
 *       redevient le bouton initial.</li>
 * </ul>
 *
 * <p><strong>Variantes</strong> : pour les produits qui ont plusieurs unités
 * de vente (1L vs 500ml), on ne peut pas trancher inline laquelle ajouter.
 * Dans ce cas le tap sur "+" délègue à {@code onAddVariant} (typiquement
 * ouvrir la modal de sélection). Si le produit est déjà dans le cart on
 * affiche quand même le compteur global (somme cross-variantes) pour donner
 * du feedback, mais le decrement est désactivé — l'utilisateur va dans le
 * panier pour ajuster finement par variante.</p>
 */
export interface InlineQuantitySelectorProps {
  /** Quantité actuelle du produit dans le panier (somme cross-variantes). 0 = pas encore ajouté. */
  currentQuantity: number;
  /** Indique si le produit a plusieurs variantes (1L/500ml/etc.). Change le
   *  comportement du "+" et désactive le decrement inline. */
  hasVariants?: boolean;
  /** Stock max disponible. Si défini et atteint → "+" désactivé. */
  maxQuantity?: number;
  /** Ajouter 1 (produits sans variantes). */
  onIncrement: () => void;
  /** Retirer 1 (produits sans variantes uniquement). */
  onDecrement: () => void;
  /** Ouvre la modal de sélection de variante (produits avec variantes uniquement). */
  onAddVariant?: () => void;
  /** Désactive complètement (rupture de stock, produit non disponible). */
  disabled?: boolean;
  /** Couleur principale — typiquement brand.primary de l'épicerie. */
  color: string;
  /** Couleur du contenu sur color (texte / icône). */
  textColor: string;
  /** Variante visuelle : "compact" (mode liste, plus petit) ou "normal" (mode grille). */
  size?: 'compact' | 'normal';
}

export const InlineQuantitySelector: React.FC<InlineQuantitySelectorProps> = ({
  currentQuantity,
  hasVariants = false,
  maxQuantity,
  onIncrement,
  onDecrement,
  onAddVariant,
  disabled = false,
  color,
  textColor,
  size = 'normal',
}) => {
  const isInCart = currentQuantity > 0;
  const atMax = maxQuantity != null && currentQuantity >= maxQuantity;
  const compact = size === 'compact';

  // Tap "+" : si variantes → ouvre la modal ; sinon ajoute direct (sauf si
  // disabled ou stock atteint).
  const handlePlus = () => {
    if (disabled) return;
    if (hasVariants && onAddVariant) {
      onAddVariant();
      return;
    }
    if (!atMax) onIncrement();
  };

  // ─── Avant 1er ajout : bouton "+" simple ────────────────────────────────
  if (!isInCart) {
    return (
      <Pressable
        onPress={handlePlus}
        disabled={disabled}
        style={({ pressed }) => [
          compact ? styles.singleBtnCompact : styles.singleBtn,
          { backgroundColor: color, shadowColor: color },
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Ajouter au panier"
        hitSlop={6}
      >
        <Text style={[
          compact ? styles.singleBtnIconCompact : styles.singleBtnIcon,
          { color: textColor },
        ]}>
          +
        </Text>
      </Pressable>
    );
  }

  // ─── Après 1er ajout : pill [−][N][+] ───────────────────────────────────
  // Pour les produits avec variantes : "−" disabled (l'utilisateur ajuste
  // finement par variante depuis le panier).
  const minusDisabled = hasVariants || disabled;
  const plusDisabled = disabled || atMax;

  return (
    <View
      style={[
        compact ? styles.pillCompact : styles.pill,
        { backgroundColor: color, shadowColor: color },
      ]}
    >
      <Pressable
        onPress={onDecrement}
        disabled={minusDisabled}
        style={({ pressed }) => [
          compact ? styles.pillBtnCompact : styles.pillBtn,
          pressed && !minusDisabled && styles.pillBtnPressed,
          minusDisabled && styles.pillBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Réduire la quantité"
        hitSlop={6}
      >
        <Text style={[
          compact ? styles.pillBtnLabelCompact : styles.pillBtnLabel,
          { color: textColor, opacity: minusDisabled ? 0.4 : 1 },
        ]}>
          −
        </Text>
      </Pressable>

      <View style={compact ? styles.pillCountCompact : styles.pillCount}>
        <Text style={[
          compact ? styles.pillCountTextCompact : styles.pillCountText,
          { color: textColor },
        ]} numberOfLines={1}>
          {currentQuantity > 99 ? '99+' : currentQuantity}
        </Text>
      </View>

      <Pressable
        onPress={handlePlus}
        disabled={plusDisabled}
        style={({ pressed }) => [
          compact ? styles.pillBtnCompact : styles.pillBtn,
          pressed && !plusDisabled && styles.pillBtnPressed,
          plusDisabled && styles.pillBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={atMax ? 'Quantité maximale atteinte' : 'Augmenter la quantité'}
        hitSlop={6}
      >
        <Text style={[
          compact ? styles.pillBtnLabelCompact : styles.pillBtnLabel,
          { color: textColor, opacity: plusDisabled ? 0.4 : 1 },
        ]}>
          +
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Bouton seul (état "pas dans le panier") ──────────────────────────────
  singleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  singleBtnCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  singleBtnIcon: { fontSize: 26, fontWeight: '700', lineHeight: 28 },
  singleBtnIconCompact: { fontSize: 22, fontWeight: '700', lineHeight: 24 },

  // ── Pill (état "dans le panier") ─────────────────────────────────────────
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 2,
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 2,
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pillBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pillBtnDisabled: {
    // L'opacity du label suffit visuellement ; pas besoin de griser le bg
    // qui est déjà la couleur de marque (cohérence visuelle).
  },
  pillBtnLabel: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  pillBtnLabelCompact: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  pillCount: {
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pillCountCompact: {
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pillCountText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pillCountTextCompact: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
