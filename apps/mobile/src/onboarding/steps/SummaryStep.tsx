import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { OnboardingResults } from '../types';
import { sharedStyles as s } from './sharedStyles';

interface SummaryStepProps {
  results: OnboardingResults;
  onConfirm: () => void;
  onBack: () => void;
  isSaving: boolean;
  saveError: string | null;
  isDarkMode: boolean;
}

function goalLabel(goal: OnboardingResults['goal']): string {
  switch (goal) {
    case 'lose':
      return 'Weight Loss';
    case 'maintain':
      return 'Maintenance';
    case 'gain':
      return 'Weight Gain';
  }
}

export default function SummaryStep({
  results,
  onConfirm,
  onBack,
  isSaving,
  saveError,
  isDarkMode,
}: SummaryStepProps) {
  return (
    <View>
      <Text style={[s.label, isDarkMode && s.labelDark]}>Your Plan</Text>

      <View style={[styles.card, isDarkMode ? styles.cardDark : styles.cardLight]}>
        <View style={styles.row}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>
            Daily Target
          </Text>
          <Text style={[styles.value, isDarkMode && styles.valueDark]}>
            {results.daily_target_calories} kcal/day
          </Text>
        </View>

        <View style={[styles.divider, isDarkMode && styles.dividerDark]} />

        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Macros
        </Text>
        <View style={styles.row}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>Protein</Text>
          <Text style={[styles.value, isDarkMode && styles.valueDark]}>
            {results.protein_g}g
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>Carbs</Text>
          <Text style={[styles.value, isDarkMode && styles.valueDark]}>
            {results.carbs_g}g
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>Fat</Text>
          <Text style={[styles.value, isDarkMode && styles.valueDark]}>
            {results.fat_g}g
          </Text>
        </View>

        <View style={[styles.divider, isDarkMode && styles.dividerDark]} />

        <View style={styles.row}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>Goal</Text>
          <Text style={[styles.value, isDarkMode && styles.valueDark]}>
            {goalLabel(results.goal)}
          </Text>
        </View>

        {results.timeframe_days !== null && (
          <View style={styles.row}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              Timeframe
            </Text>
            <Text style={[styles.value, isDarkMode && styles.valueDark]}>
              {results.timeframe_days} days
            </Text>
          </View>
        )}
      </View>

      {results.calorie_floor_warned && (
        <Text style={[styles.warning, isDarkMode && styles.warningDark]}>
          Calorie target below minimum. Target has been adjusted up to ensure safety.
        </Text>
      )}

      {saveError !== null && (
        <Text style={[s.error, isDarkMode && s.errorDark]}>{saveError}</Text>
      )}

      <View style={styles.buttonRow}>
        <Pressable
          onPress={onConfirm}
          disabled={isSaving}
          style={[
            s.button,
            s.buttonPrimary,
            isDarkMode ? s.buttonPrimaryDark : s.buttonPrimaryLight,
            isSaving && s.buttonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Confirm"
        >
          {isSaving ? (
            <ActivityIndicator
              color={isDarkMode ? '#000000' : '#FFFFFF'}
            />
          ) : (
            <Text
              style={[
                s.buttonText,
                isDarkMode ? s.buttonTextSecondaryDark : s.buttonTextSecondaryLight,
              ]}
            >
              Confirm
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={onBack}
          disabled={isSaving}
          style={[
            s.button,
            isDarkMode ? s.buttonSecondaryDark : s.buttonSecondaryLight,
            isSaving && s.buttonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[s.buttonText, isDarkMode && s.buttonTextDark]}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardLight: {
    backgroundColor: '#F5F5F5',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  labelDark: {
    color: '#AAAAAA',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  valueDark: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  sectionTitleDark: {
    color: '#888888',
  },
  divider: {
    height: 1,
    backgroundColor: '#DDDDDD',
    marginVertical: 12,
  },
  dividerDark: {
    backgroundColor: '#333333',
  },
  warning: {
    fontSize: 14,
    color: '#996600',
    marginBottom: 16,
    lineHeight: 20,
  },
  warningDark: {
    color: '#FFCC00',
  },
  buttonRow: {
    gap: 12,
  },
});
