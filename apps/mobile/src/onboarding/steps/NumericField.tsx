import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { sharedStyles as s } from './sharedStyles';

interface NumericFieldProps {
  label: string;
  placeholder: string;
  unit?: string;
  accessibilityLabel: string;
  value: number | undefined;
  onChange: (value: number) => void;
  error: string | null;
  isDarkMode: boolean;
  hint?: string;
  unitMinWidth?: number;
}

export default function NumericField({
  label,
  placeholder,
  unit,
  accessibilityLabel,
  value,
  onChange,
  error,
  isDarkMode,
  hint,
  unitMinWidth = 40,
}: NumericFieldProps) {
  const [textValue, setTextValue] = useState(
    value !== undefined ? String(value) : '',
  );

  return (
    <View>
      <Text style={[s.label, isDarkMode && s.labelDark]}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          style={[
            s.input,
            isDarkMode ? s.inputDark : s.inputLight,
            error !== null && s.inputError,
          ]}
          value={textValue}
          onChangeText={(text) => {
            setTextValue(text);
            onChange(Number(text));
          }}
          keyboardType="numeric"
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
          accessibilityLabel={accessibilityLabel}
        />
        {unit !== undefined && (
          <Text style={[s.unit, isDarkMode && s.unitDark, { minWidth: unitMinWidth }]}>
            {unit}
          </Text>
        )}
      </View>
      {hint !== undefined && (
        <Text style={[s.hint, isDarkMode && s.hintDark]}>{hint}</Text>
      )}
      {error !== null && (
        <Text style={[s.error, isDarkMode && s.errorDark]}>{error}</Text>
      )}
    </View>
  );
}
