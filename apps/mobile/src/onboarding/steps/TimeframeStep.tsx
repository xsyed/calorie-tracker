import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { sharedStyles as s } from './sharedStyles';

type Unit = 'days' | 'weeks' | 'months';

const UNIT_OPTIONS: { label: string; value: Unit }[] = [
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Months', value: 'months' },
];

const UNIT_MULTIPLIER: Record<Unit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
};

interface TimeframeStepProps {
  value: number | undefined;
  onChange: (value: number) => void;
  error: string | null;
  isDarkMode: boolean;
}

function deduceUnit(days: number): Unit {
  if (days % 30 === 0 && days >= 30) return 'months';
  if (days % 7 === 0 && days >= 7) return 'weeks';
  return 'days';
}

function deduceNumber(days: number, unit: Unit): string {
  return String(days / UNIT_MULTIPLIER[unit]);
}

export default function TimeframeStep({ value, onChange, error, isDarkMode }: TimeframeStepProps) {
  const initialUnit = useMemo(() => {
    if (value !== undefined && value > 0) return deduceUnit(value);
    return 'days' as Unit;
  }, [value]);

  const [numberText, setNumberText] = useState(() => {
    if (value !== undefined && value > 0) {
      const u = deduceUnit(value);
      return deduceNumber(value, u);
    }
    return '';
  });
  const [unit, setUnit] = useState<Unit>(initialUnit);

  const updateValue = (num: string, u: Unit) => {
    const parsed = Number(num);
    if (num !== '' && !isNaN(parsed) && parsed > 0) {
      onChange(parsed * UNIT_MULTIPLIER[u]);
    } else {
      onChange(NaN);
    }
  };

  return (
    <View>
      <Text style={[s.label, isDarkMode && s.labelDark]}>
        What is your timeframe?
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            s.input,
            isDarkMode ? s.inputDark : s.inputLight,
            error !== null && s.inputError,
          ]}
          value={numberText}
          onChangeText={(text) => {
            setNumberText(text);
            updateValue(text, unit);
          }}
          keyboardType="numeric"
          returnKeyType="done"
          placeholder="12"
          placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
          accessibilityLabel="Timeframe duration"
        />
      </View>
      <View style={styles.unitRow}>
        {UNIT_OPTIONS.map((opt) => {
          const selected = unit === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setUnit(opt.value);
                updateValue(numberText, opt.value);
              }}
              style={[
                styles.unitButton,
                isDarkMode ? s.optionDark : s.optionLight,
                selected
                  ? isDarkMode
                    ? s.optionSelectedDark
                    : s.optionSelectedLight
                  : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  s.optionText,
                  isDarkMode ? s.optionTextDark : s.optionTextLight,
                  selected
                    ? isDarkMode
                      ? s.optionTextSelectedDark
                      : s.optionTextSelectedLight
                    : null,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error !== null && (
        <Text style={[s.error, isDarkMode && s.errorDark]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 16,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
});
