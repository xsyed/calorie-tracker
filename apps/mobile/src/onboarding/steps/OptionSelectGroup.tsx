import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sharedStyles as s } from './sharedStyles';

interface SelectableOption<T extends string> {
  label: string;
  value: T;
}

interface OptionSelectGroupProps<T extends string> {
  options: SelectableOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  isDarkMode: boolean;
  direction: 'row' | 'column';
  error: string | null;
}

export default function OptionSelectGroup<T extends string>({
  options,
  value,
  onChange,
  isDarkMode,
  direction,
  error,
}: OptionSelectGroupProps<T>) {
  return (
    <View>
      <View style={direction === 'row' ? styles.row : styles.column}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                s.option,
                isDarkMode ? s.optionDark : s.optionLight,
                selected
                  ? isDarkMode
                    ? s.optionSelectedDark
                    : s.optionSelectedLight
                  : null,
                direction === 'row' && styles.rowItem,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
});
