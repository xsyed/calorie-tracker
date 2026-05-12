import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SafetyGateResult } from '../types';
import { sharedStyles as s } from './sharedStyles';

interface SafetyGateStepProps {
  result: SafetyGateResult & { passed: false };
  onAccept: () => void;
  onRevise: () => void;
  isDarkMode: boolean;
}

export default function SafetyGateStep({
  result,
  onAccept,
  onRevise,
  isDarkMode,
}: SafetyGateStepProps) {
  return (
    <View>
      <Text style={[s.label, isDarkMode && s.labelDark]}>Hold on a moment</Text>
      <Text style={[styles.message, isDarkMode && styles.messageDark]}>
        This is too fast. A safe timeframe is {result.safeDays} days.
      </Text>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onAccept}
          style={[
            s.button,
            s.buttonPrimary,
            isDarkMode ? s.buttonPrimaryDark : s.buttonPrimaryLight,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Accept ${result.safeDays} days`}
        >
          <Text
            style={[
              s.buttonText,
              isDarkMode ? s.buttonTextSecondaryDark : s.buttonTextSecondaryLight,
            ]}
          >
            Accept {result.safeDays} days
          </Text>
        </Pressable>
        <Pressable
          onPress={onRevise}
          style={[
            s.button,
            isDarkMode ? s.buttonSecondaryDark : s.buttonSecondaryLight,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Revise goal"
        >
          <Text style={[s.buttonText, isDarkMode && s.buttonTextDark]}>
            Revise goal
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 17,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 32,
  },
  messageDark: {
    color: '#CCCCCC',
  },
  buttonRow: {
    gap: 12,
  },
});
