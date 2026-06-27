import { Colors } from '../../../constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  emoji?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyPromoState({
  emoji = '📢',
  title,
  subtitle,
  ctaLabel,
  onCta,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCta ? (
        <TouchableOpacity style={styles.cta} onPress={onCta} activeOpacity={0.7}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 50,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.55,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 280,
  },
  cta: {
    marginTop: 22,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
