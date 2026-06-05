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
 * pluriel, etc.).</p>
 */
export interface MetaPill {
  /** Libellé court visible. Ex: "⭐ 4.8 (123)" ou "🟢 Ouvert · Ferme à 21h". */
  label: string;
  /** Couleur de fond. Défaut : gris neutre. Vert pour "ouvert", rouge pour "fermé", etc. */
  bgColor?: string;
  /** Couleur du texte. Défaut : dérivée du bgColor pour le contraste. */
  textColor?: string;
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
      {pills.map((pill, idx) => (
        <View
          key={`pill-${idx}-${pill.label}`}
          style={[
            styles.pill,
            { backgroundColor: pill.bgColor ?? '#F4F4F5' },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: pill.textColor ?? '#1f2937' },
            ]}
            numberOfLines={1}
          >
            {pill.label}
          </Text>
        </View>
      ))}
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
