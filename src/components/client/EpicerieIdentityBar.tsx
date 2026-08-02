import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EpicerieLogo } from './EpicerieLogo';

/**
 * EpicerieIdentityBar — bandeau blanc juste sous le hero qui porte l'identité
 * de l'épicerie : nom + adresse. Reprend le pattern des cartes de la page
 * d'accueil ({@code app/(client)/epiceries.tsx}) pour une cohérence visuelle
 * entre "j'arrive sur la liste" et "j'arrive sur une boutique".
 *
 * <p>Volontairement minimal : pas de rating, pas de pastilles ici — ces infos
 * sont portées par {@code EpicerieMetaPills} juste en dessous. La séparation
 * verticale claire (3 bandes : identité, méta, tabs) facilite le scan.</p>
 *
 * <p>Tap sur l'adresse → callback {@code onAddressPress} typiquement Google
 * Maps. Le geste est subtil (couleur d'accent), pas un gros bouton — l'objectif
 * est d'identifier la boutique, pas de pousser à l'itinéraire.</p>
 */
export interface EpicerieIdentityBarProps {
  /** Logo de l'épicerie (photoUrl). Fallback emoji géré par EpicerieLogo. */
  logoUrl?: string | null;
  /** Nom commercial — typo brand color, 20pt bold. */
  name: string;
  /** Slogan/tagline court de la boutique (brandStatement). Rendu discret en italique sous le nom. */
  brandStatement?: string;
  /** Adresse postale formatée. Tap dessus → onAddressPress si fourni. */
  address?: string;
  /** Couleur primaire de l'épicerie (sert au nom). */
  brandPrimary: string;
  onAddressPress?: () => void;
}

export const EpicerieIdentityBar: React.FC<EpicerieIdentityBarProps> = ({
  logoUrl,
  name,
  brandStatement,
  address,
  brandPrimary,
  onAddressPress,
}) => {
  return (
    <View style={styles.container}>
      <EpicerieLogo
        photoUrl={logoUrl}
        size={48}
        accessibilityLabel={name}
      />
      <View style={styles.textCol}>
        <Text style={[styles.name, { color: brandPrimary }]} numberOfLines={1}>
          {name}
        </Text>
        {!!brandStatement?.trim() && (
          <Text style={styles.tagline} numberOfLines={2}>
            {brandStatement.trim()}
          </Text>
        )}
        {!!address && (
          <Pressable
            onPress={onAddressPress}
            disabled={!onAddressPress}
            hitSlop={4}
          >
            <Text style={styles.address} numberOfLines={2}>
              <Text style={styles.pin}>📍 </Text>
              {address}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  tagline: {
    fontSize: 13,
    color: '#8A8A8A',
    fontStyle: 'italic',
    lineHeight: 17,
    marginBottom: 3,
  },
  address: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  pin: {
    fontSize: 12,
  },
});
