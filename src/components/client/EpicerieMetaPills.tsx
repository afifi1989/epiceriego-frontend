import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * EpicerieMetaPills — rangée scrollable horizontalement de pastilles
 * compactes qui résument les méta-info clés d'une épicerie.
 *
 * <p>Pattern UX standard sur Glovo / Deliveroo / Uber Eats : un coup d'œil
 * suffit au client pour savoir si la boutique correspond à ses critères
 * (rating, statut ouvert/fermé, mode de livraison, frais). Beaucoup plus
 * scanable qu'une prose dispersée dans le hero.</p>
 *
 * <p>Le composant est non-opinionated sur le formatage des valeurs : c'est
 * le parent qui passe les chaînes déjà localisées et formatées (devise,
 * pluriel, etc.). Chaque pastille peut porter un <em>point coloré</em>
 * (statut) et/ou une <em>icône Ionicons</em> pour un scan encore plus rapide.</p>
 */
export interface MetaPill {
  /** Libellé court visible. Ex: "4.8 (123)" ou "Ferme dans ~20 min". */
  label: string;
  /** Couleur de fond. Défaut : gris neutre. Vert pour "ouvert", rouge pour "fermé", etc. */
  bgColor?: string;
  /** Couleur du texte. Défaut : dérivée du bgColor pour le contraste. */
  textColor?: string;
  /** Point coloré à gauche du label (signal ouvert/fermé instantané). */
  dotColor?: string;
  /** Icône Ionicons à gauche du label (prioritaire sur le point si les deux fournis). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Couleur de l'icône. Défaut : hérite de textColor. */
  iconColor?: string;
}

export interface EpicerieMetaPillsProps {
  pills: MetaPill[];
}

export const EpicerieMetaPills: React.FC<EpicerieMetaPillsProps> = ({ pills }) => {
  if (pills.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {pills.map((pill, idx) => {
        const textColor = pill.textColor ?? '#1f2937';
        return (
          <View
            key={`pill-${idx}-${pill.label}`}
            style={[
              styles.pill,
              { backgroundColor: pill.bgColor ?? '#F4F4F5' },
            ]}
          >
            {pill.icon ? (
              <Ionicons
                name={pill.icon}
                size={12}
                color={pill.iconColor ?? textColor}
                style={styles.pillIcon}
              />
            ) : pill.dotColor ? (
              <View style={[styles.pillDot, { backgroundColor: pill.dotColor }]} />
            ) : null}
            <Text
              style={[styles.pillText, { color: textColor }]}
              numberOfLines={1}
            >
              {pill.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pillIcon: {
    marginBottom: -1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
