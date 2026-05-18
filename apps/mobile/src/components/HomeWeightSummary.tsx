import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { formatWeight } from '../screens/weightFormatUtils';

interface HomeWeightSummaryProps {
  currentWeightKg: number | null;
  previousWeightKg: number | null;
  onLogWeight: () => void;
}

function getWeightLabel(weightKg: number | null): string {
  return weightKg === null ? '--' : `${formatWeight(weightKg)} kg`;
}

export default function HomeWeightSummary({
  currentWeightKg,
  previousWeightKg,
  onLogWeight,
}: HomeWeightSummaryProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>Weight</Text>
        <Pressable
          accessibilityLabel="Log weight"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onLogWeight}
        >
          <Text style={[styles.logButtonText, { color: accentColor }]}>Log</Text>
        </Pressable>
      </View>

      <View style={styles.valuesRow}>
        <View style={styles.valueBlock}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>Previous</Text>
          <Text style={[styles.value, isDarkMode && styles.titleDark]} numberOfLines={1}>
            {getWeightLabel(previousWeightKg)}
          </Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>Current</Text>
          <Text style={[styles.value, isDarkMode && styles.titleDark]} numberOfLines={1}>
            {getWeightLabel(currentWeightKg)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  logButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  valuesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  valueBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 2,
  },
  labelDark: {
    color: '#999999',
  },
  card: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
});
