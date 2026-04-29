import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  ratio: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ ratio, color = '#4CAF50', height = 6 }: Props) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#ECEFF1',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
  },
});
