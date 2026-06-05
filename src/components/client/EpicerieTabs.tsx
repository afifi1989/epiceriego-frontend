import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * EpicerieTabs — onglets horizontaux sticky en haut de l'écran épicerie.
 *
 * <p>Trois onglets : <strong>Produits</strong> (la liste/grille), <strong>Avis</strong>
 * (rating + commentaires clients), <strong>Infos</strong> (description longue,
 * horaires, contact, adresse). Pattern UX standard sur Glovo, Deliveroo,
 * Uber Eats : sépare ce qui pousse à l'achat (produits) de l'info contextuelle
 * (avis, infos pratiques) sans encombrer le hero.</p>
 *
 * <p>Composant volontairement non-opinionated sur le contenu de chaque tab —
 * c'est le parent qui rend le bon Body. Le tabs lui-même est juste un switcher.</p>
 */
export type EpicerieTab = 'products' | 'reviews' | 'info';

export interface EpicerieTabsProps {
  activeTab: EpicerieTab;
  onTabChange: (tab: EpicerieTab) => void;
  /** Couleur de l'indicateur actif (alignée brand.primary de l'épicerie). */
  activeColor: string;
  /** Labels traduits selon la langue active. */
  labels: {
    products: string;
    reviews: string;
    info: string;
  };
  /** Optionnel : badge compteur à côté du label Avis ("4.8" par ex.). */
  reviewsBadge?: string;
}

export const EpicerieTabs: React.FC<EpicerieTabsProps> = ({
  activeTab,
  onTabChange,
  activeColor,
  labels,
  reviewsBadge,
}) => {
  const tabs: Array<{ id: EpicerieTab; label: string; icon: string; badge?: string }> = [
    { id: 'products', label: labels.products, icon: '🛒' },
    { id: 'reviews', label: labels.reviews, icon: '⭐', badge: reviewsBadge },
    { id: 'info', label: labels.info, icon: 'ℹ️' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabIcon, active && { opacity: 1 }]}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  active && { color: activeColor, fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {tab.label}
                {tab.badge ? ` · ${tab.badge}` : ''}
              </Text>
            </View>
            {active && (
              <View style={[styles.tabIndicator, { backgroundColor: activeColor }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabPressed: { opacity: 0.7 },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabIcon: { fontSize: 14, opacity: 0.75 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
  },
});
