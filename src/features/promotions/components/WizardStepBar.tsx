import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { interpolate } from '../utils';

interface Props {
  currentStep: number;  // 1-based
  totalSteps: number;
  labels?: string[];
}

/**
 * Barre de progression pour le wizard : dots + label "Étape N / Total".
 */
export function WizardStepBar({ currentStep, totalSteps, labels }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: totalSteps }).map((_, i) => {
          const state = i + 1 < currentStep
            ? 'done'
            : i + 1 === currentStep
            ? 'current'
            : 'todo';
          return (
            <React.Fragment key={i}>
              <View
                style={[
                  styles.dot,
                  state === 'done' && styles.dotDone,
                  state === 'current' && styles.dotCurrent,
                ]}
              />
              {i < totalSteps - 1 && (
                <View style={[styles.line, state !== 'todo' && styles.lineActive]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <Text style={styles.label}>
        {interpolate(t('promotions.wizard.stepOf'), {
          n: currentStep,
          total: totalSteps,
        })}
        {labels?.[currentStep - 1] ? ` · ${labels[currentStep - 1]}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  dotDone: {
    backgroundColor: '#4CAF50',
  },
  dotCurrent: {
    backgroundColor: '#2196F3',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  lineActive: {
    backgroundColor: '#4CAF50',
  },
  label: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
});
