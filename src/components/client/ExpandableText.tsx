import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

/**
 * ExpandableText — texte tronqué à N lignes avec bouton "Voir plus" / "Voir moins".
 *
 * <p>Détecte automatiquement si le texte dépasse la limite via `onTextLayout`
 * (RN expose le nombre de lignes effectivement rendues). Si overflow → on
 * affiche un bouton sous le texte pour basculer en mode déplié.</p>
 *
 * <p>Quand le texte tient déjà dans la limite, le bouton n'est pas affiché —
 * pas de bruit visuel inutile.</p>
 */
export interface ExpandableTextProps {
  /** Le contenu textuel à afficher. */
  children: string;
  /** Nombre de lignes max en mode tronqué. Défaut : 2. */
  numberOfLines?: number;
  /** Libellé du bouton "Voir plus" (localisé). */
  expandLabel: string;
  /** Libellé du bouton "Voir moins" (localisé). */
  collapseLabel: string;
  /** Style du texte. */
  textStyle?: TextStyle;
  /** Couleur du bouton expand/collapse (typiquement brand.primary). */
  accentColor?: string;
}

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  children,
  numberOfLines = 2,
  expandLabel,
  collapseLabel,
  textStyle,
  accentColor = '#1976D2',
}) => {
  const [expanded, setExpanded] = useState(false);
  /**
   * `null` = pas encore mesuré (1er rendu).
   * `true` = le texte dépasse la limite → on affiche le toggle.
   * `false` = le texte tient → pas de toggle.
   *
   * On mesure avec `numberOfLines + 1` au 1er rendu pour distinguer "tient
   * exactement" vs "déborde". Si la couche native rend plus de lignes que
   * la limite cible, c'est un overflow.
   */
  const [overflow, setOverflow] = useState<boolean | null>(null);

  // Onglet mesure (invisible) : rend le texte complet pour compter les lignes.
  // Une fois la mesure faite, on ne re-rend plus cet helper pour économiser
  // un layout pass à chaque toggle.
  if (overflow === null) {
    return (
      <View>
        <Text
          style={[styles.text, textStyle, styles.measuringText]}
          onTextLayout={(e) => {
            setOverflow(e.nativeEvent.lines.length > numberOfLines);
          }}
        >
          {children}
        </Text>
        {/* On rend aussi la version visible tronquée pour ne pas avoir un
            flash de contenu vide pendant la mesure (sub-frame). */}
        <Text style={[styles.text, textStyle]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text
        style={[styles.text, textStyle]}
        numberOfLines={expanded ? undefined : numberOfLines}
      >
        {children}
      </Text>
      {overflow && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={6}
          style={({ pressed }) => [styles.toggleBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.toggleLabel, { color: accentColor }]}>
            {expanded ? collapseLabel : expandLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  /** Le texte de mesure occupe l'espace pour que onTextLayout soit appelé,
   *  mais il est rendu hors-flux pour ne pas doubler la hauteur visible. */
  measuringText: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
  },
  toggleBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
