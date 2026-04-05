import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface Tab {
  label: string;
  icon: string;
  disabled?: boolean;
}

interface ProductTabsProps {
  tabs: Tab[];
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export const ProductTabs: React.FC<ProductTabsProps> = ({ tabs, activeIndex, onTabChange }) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {tabs.map((tab, idx) => {
          const isActive = idx === activeIndex;
          const isDisabled = tab.disabled;
          return (
            <TouchableOpacity
              key={tab.label}
              style={[
                styles.tab,
                isActive && styles.tabActive,
                isDisabled && styles.tabDisabled
              ]}
              onPress={() => !isDisabled && onTabChange(idx)}
              disabled={isDisabled}
              activeOpacity={isDisabled ? 1 : 0.7}
            >
              <Text style={[
                styles.tabIcon,
                isActive && styles.tabIconActive,
                isDisabled && styles.tabIconDisabled
              ]}>
                {tab.icon}
              </Text>
              <Text style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
                isDisabled && styles.tabLabelDisabled
              ]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  container: {
    paddingHorizontal: 4,
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
    minWidth: 80,
  },
  tabActive: {
    // styles applied via indicator bar
  },
  tabDisabled: {
    opacity: 0.38,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabIconActive: {},
  tabIconDisabled: {},
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
  },
  tabLabelActive: {
    color: '#2196F3',
    fontWeight: '700',
  },
  tabLabelDisabled: {
    color: '#bbb',
  },
  activeBar: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
});
