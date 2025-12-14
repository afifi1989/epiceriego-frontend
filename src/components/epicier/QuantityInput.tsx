/**
 * QuantityInput component - handles quantity input with +/- buttons
 * Used for stock adjustments and order item quantities
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/src/constants/colors';

interface QuantityInputProps {
  initialValue: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit: string;
  onValueChange: (value: number) => void;
  editable?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  initialValue,
  minValue = 0,
  maxValue = 99999,
  step = 1,
  unit,
  onValueChange,
  editable = true,
  size = 'medium',
}) => {
  const [quantity, setQuantity] = useState(initialValue.toString());

  const sizeConfig = {
    small: { btnSize: 28, fontSize: FontSizes.sm, spacing: Spacing.sm },
    medium: { btnSize: 36, fontSize: FontSizes.base, spacing: Spacing.md },
    large: { btnSize: 44, fontSize: FontSizes.lg, spacing: Spacing.lg },
  }[size];

  const handleDecrement = () => {
    const current = parseFloat(quantity) || 0;
    const newValue = Math.max(minValue, current - step);
    const formatted = newValue.toFixed(2).replace(/\.?0+$/, '');
    setQuantity(formatted);
    onValueChange(parseFloat(formatted));
  };

  const handleIncrement = () => {
    const current = parseFloat(quantity) || 0;
    const newValue = Math.min(maxValue, current + step);
    const formatted = newValue.toFixed(2).replace(/\.?0+$/, '');
    setQuantity(formatted);
    onValueChange(parseFloat(formatted));
  };

  const handleInputChange = (text: string) => {
    // Allow only numbers and decimal point
    const sanitized = text.replace(/[^0-9.]/g, '');
    if (sanitized === '' || !isNaN(parseFloat(sanitized))) {
      setQuantity(sanitized);
    }
  };

  const handleInputBlur = () => {
    if (quantity === '' || quantity === '.') {
      setQuantity(minValue.toString());
      onValueChange(minValue);
    } else {
      const value = parseFloat(quantity);
      if (value < minValue) {
        Alert.alert('Erreur', `La valeur minimum est ${minValue}`);
        setQuantity(minValue.toString());
        onValueChange(minValue);
      } else if (value > maxValue) {
        Alert.alert('Erreur', `La valeur maximum est ${maxValue}`);
        setQuantity(maxValue.toString());
        onValueChange(maxValue);
      } else {
        onValueChange(value);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quantité ({unit})</Text>

      <View
        style={[
          styles.inputContainer,
          { gap: sizeConfig.spacing },
        ]}
      >
        {/* Decrement Button */}
        <TouchableOpacity
          style={[
            styles.button,
            { width: sizeConfig.btnSize, height: sizeConfig.btnSize },
          ]}
          onPress={handleDecrement}
          disabled={!editable || parseFloat(quantity || '0') <= minValue}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="minus"
            size={sizeConfig.btnSize / 2}
            color={Colors.textInverse}
          />
        </TouchableOpacity>

        {/* Input Field */}
        <TextInput
          style={[
            styles.input,
            { fontSize: sizeConfig.fontSize },
          ]}
          value={quantity}
          onChangeText={handleInputChange}
          onBlur={handleInputBlur}
          editable={editable}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.textTertiary}
          textAlign="center"
        />

        {/* Increment Button */}
        <TouchableOpacity
          style={[
            styles.button,
            { width: sizeConfig.btnSize, height: sizeConfig.btnSize },
          ]}
          onPress={handleIncrement}
          disabled={!editable || parseFloat(quantity || '0') >= maxValue}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="plus"
            size={sizeConfig.btnSize / 2}
            color={Colors.textInverse}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
});
