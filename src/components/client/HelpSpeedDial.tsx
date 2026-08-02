import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * HelpSpeedDial — FAB « Aide » unique qui déploie plusieurs actions
 * d'assistance (WhatsApp, assistant IA…) au tap. Désencombre le bas de l'écran
 * en fusionnant les FAB éparpillés en un seul point d'entrée clair.
 *
 * <p>Chaque action apparait avec un léger stagger (translate + fade) au-dessus
 * du bouton principal. useNativeDriver pour transform/opacity → animation fluide
 * même pendant le scroll de la liste. Si une seule action est fournie, le
 * speed-dial se comporte comme un FAB simple qui la déclenche directement.</p>
 */
export interface SpeedDialAction {
  key: string;
  /** Emoji affiché dans la pastille de l'action. */
  emoji: string;
  label: string;
  /** Couleur de fond de la pastille de l'action. */
  color: string;
  onPress: () => void;
}

export interface HelpSpeedDialProps {
  actions: SpeedDialAction[];
  /** Libellé accessibilité + tooltip du bouton principal. */
  mainLabel: string;
  /** Couleur de fond du bouton principal (marque de l'épicerie). */
  accentColor: string;
  /** Couleur de l'icône/texte sur le bouton principal. */
  accentOnColor: string;
  /** Décalage bas dynamique (mini-cart visible). Défaut 20. */
  bottom?: number;
}

export const HelpSpeedDial: React.FC<HelpSpeedDialProps> = ({
  actions,
  mainLabel,
  accentColor,
  accentOnColor,
  bottom = 20,
}) => {
  const [open, setOpen] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;

  const setOpenAnimated = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      Animated.spring(anim, {
        toValue: next ? 1 : 0,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    },
    [anim],
  );

  if (actions.length === 0) return null;

  // Une seule action → FAB direct (pas de déploiement inutile).
  const single = actions.length === 1;

  const handleMainPress = () => {
    if (single) {
      actions[0].onPress();
      return;
    }
    setOpenAnimated(!open);
  };

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  return (
    <>
      {/* Scrim invisible pour refermer au tap extérieur */}
      {open && !single && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpenAnimated(false)}
          accessibilityElementsHidden
        />
      )}

      <View style={[styles.container, { bottom }]} pointerEvents="box-none">
        {!single &&
          actions.map((action, idx) => {
            const translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [20 + idx * 6, 0],
            });
            return (
              <Animated.View
                key={action.key}
                pointerEvents={open ? 'auto' : 'none'}
                style={[
                  styles.actionRow,
                  { opacity: anim, transform: [{ translateY }] },
                ]}
              >
                <View style={styles.actionLabelWrap}>
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: action.color }]}
                  onPress={() => {
                    setOpenAnimated(false);
                    action.onPress();
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <Text style={styles.actionEmoji}>{action.emoji}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: accentColor }]}
          onPress={handleMainPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={mainLabel}
          accessibilityState={{ expanded: open }}
        >
          {single ? (
            <>
              <Text style={styles.mainEmoji}>{actions[0].emoji}</Text>
              <Text style={[styles.mainLabel, { color: accentOnColor }]} numberOfLines={1}>
                {actions[0].label}
              </Text>
            </>
          ) : (
            <>
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Ionicons name="add" size={24} color={accentOnColor} />
              </Animated.View>
              <Text style={[styles.mainLabel, { color: accentOnColor }]} numberOfLines={1}>
                {mainLabel}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionLabelWrap: {
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 180,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  actionEmoji: { fontSize: 22 },
  mainBtn: {
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  mainEmoji: { fontSize: 22 },
  mainLabel: { fontSize: 13, fontWeight: 'bold' },
});
