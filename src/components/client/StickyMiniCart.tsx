import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * StickyMiniCart — barre flottante en bas de l'écran qui résume le panier de
 * l'épicerie courante et amène au checkout en 1 tap. Pattern UX standard sur
 * Glovo / Deliveroo / Uber Eats / JOW : dès qu'il y a ≥ 1 article, la barre
 * apparaît ; quand le panier se vide, elle disparaît.
 *
 * <p>Pourquoi un composant dédié plutôt qu'un bloc inline dans `[id].tsx` :</p>
 * <ul>
 *   <li>Réutilisable : on pourra l'utiliser sur la fiche détail produit, sur la
 *       page Toutes les épiceries (cart global), etc.</li>
 *   <li>Animations isolées : slide-up à l'apparition / slide-down à la dispa-
 *       rition sans polluer le composant parent.</li>
 *   <li>Safe area : gère le padding bottom du Home Indicator iOS / nav system
 *       Android sans que l'appelant ait à s'en soucier.</li>
 * </ul>
 *
 * <p>Le composant est volontairement <em>non opinionated</em> sur le contenu
 * du panier : il reçoit déjà `itemCount` et `subtotal` calculés. L'appelant
 * fait son propre filtrage (par exemple via `groupCartByEpicerie`).</p>
 */
export interface StickyMiniCartProps {
  /** Nombre total d'articles (somme des quantités, pas le nombre de lignes). */
  itemCount: number;
  /** Sous-total en devise locale, déjà formaté côté caller via formatPrice. */
  subtotalLabel: string;
  /** Libellé d'action ("Voir le panier", traduit côté caller). */
  ctaLabel: string;
  /** Libellé articles ("X article(s)", traduit côté caller). */
  itemsLabel: string;
  /** Action au tap. Typiquement `router.push('/(client)/cart')`. */
  onPress: () => void;
  /**
   * Couleur de fond de la barre. Permet d'aligner sur le branding de
   * l'épicerie courante (cf. brand.primary). Défaut : vert AbridGO.
   */
  backgroundColor?: string;
  /** Couleur du texte sur fond — doit contraster avec backgroundColor. */
  textColor?: string;
}

export const StickyMiniCart: React.FC<StickyMiniCartProps> = ({
  itemCount,
  subtotalLabel,
  ctaLabel,
  itemsLabel,
  onPress,
  backgroundColor = '#4CAF50',
  textColor = '#FFFFFF',
}) => {
  const insets = useSafeAreaInsets();
  const visible = itemCount > 0;

  // Animation slide-up à l'apparition / slide-down à la disparition.
  // useRef + Animated.Value pour éviter de recréer la valeur à chaque render.
  const translateY = useRef(new Animated.Value(visible ? 0 : 120)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : 120,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, opacity]);

  // On évite de retourner null pour ne pas perdre l'animation de sortie.
  // À la place, on garde le composant monté mais translaté hors-écran.
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom + 10, 16),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor },
          pressed && styles.barPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${itemsLabel}, ${subtotalLabel}. ${ctaLabel}`}
      >
        {/* Pastille icône + compteur — design "badge" inspiré Glovo/Deliveroo */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>🛒</Text>
          <View style={[styles.countBadge, { backgroundColor: textColor }]}>
            <Text style={[styles.countBadgeText, { color: backgroundColor }]}>
              {itemCount > 99 ? '99+' : itemCount}
            </Text>
          </View>
        </View>

        {/* Bloc central : label articles + total */}
        <View style={styles.middle}>
          <Text style={[styles.middleItems, { color: textColor, opacity: 0.85 }]}>
            {itemsLabel}
          </Text>
          <Text style={[styles.middleTotal, { color: textColor }]} numberOfLines={1}>
            {subtotalLabel}
          </Text>
        </View>

        {/* CTA + chevron — invitation claire à l'action */}
        <View style={styles.cta}>
          <Text style={[styles.ctaLabel, { color: textColor }]} numberOfLines={1}>
            {ctaLabel}
          </Text>
          <Text style={[styles.ctaChevron, { color: textColor }]}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 4,
    // Z-index élevé pour passer au-dessus des FlatList / overlay produits.
    zIndex: 100,
    elevation: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    // Ombre prononcée pour que la barre semble "flotter" au-dessus de la liste.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
  barPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconEmoji: { fontSize: 24 },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  middle: { flex: 1, minWidth: 0 },
  middleItems: { fontSize: 12, fontWeight: '600' },
  middleTotal: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
  },
  ctaLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  ctaChevron: { fontSize: 22, fontWeight: '700', lineHeight: 22 },
});
