import { StyleSheet, Text, useColorScheme, View } from 'react-native';

interface DailySummaryProps {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  exerciseCalories: number;
  dateLabel: string;
  hasEntries: boolean;
}

function getPercentage(consumed: number, target: number | null): number | null {
  if (target === null || target === 0) return null;
  return Math.round((consumed / target) * 100);
}

function ProgressRow({
  label,
  consumed,
  target,
  unit,
  color,
  isDark,
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit: string;
  color: string;
  isDark: boolean;
}) {
  const percent = getPercentage(consumed, target);

  if (target === null || target === 0) {
    return (
      <View style={styles.row}>
        <Text style={[styles.label, isDark && styles.labelDark]}>
          {label}: Set up your daily target
        </Text>
      </View>
    );
  }

  const barWidth = Math.min(percent!, 100);

  return (
    <View style={styles.row}>
      <Text style={[styles.label, isDark && styles.labelDark]}>
        {label}: {consumed}{unit} / {target}{unit} ({percent}%)
      </Text>
      <View style={[styles.track, isDark && styles.trackDark]}>
        <View
          style={[
            styles.bar,
            { width: `${barWidth}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

export default function DailySummary({
  totalCalories,
  totalProtein,
  totalCarbs,
  totalFat,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  exerciseCalories,
  dateLabel,
  hasEntries,
}: DailySummaryProps) {
  const isDark = useColorScheme() === 'dark';

  const calorieColor = isDark ? '#0A84FF' : '#007AFF';
  const proteinColor = isDark ? '#FF453A' : '#FF3B30';
  const carbsColor = isDark ? '#FFD60A' : '#FF9500';
  const fatColor = isDark ? '#FFD60A' : '#FFCC00';

  if (!hasEntries) {
    const message =
      targetCalories !== null
        ? `No entries for ${dateLabel}. Tap the input bar to log your first meal.`
        : 'Set up your daily target to see progress.';
    return (
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Daily Summary
        </Text>
        <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <Text style={[styles.title, isDark && styles.titleDark]}>
        Daily Summary
      </Text>
      <ProgressRow
        label="Calories"
        consumed={totalCalories}
        target={targetCalories}
        unit=""
        color={calorieColor}
        isDark={isDark}
      />
      <ProgressRow
        label="Protein"
        consumed={totalProtein}
        target={targetProtein}
        unit="g"
        color={proteinColor}
        isDark={isDark}
      />
      <ProgressRow
        label="Carbs"
        consumed={totalCarbs}
        target={targetCarbs}
        unit="g"
        color={carbsColor}
        isDark={isDark}
      />
      <ProgressRow
        label="Fat"
        consumed={totalFat}
        target={targetFat}
        unit="g"
        color={fatColor}
        isDark={isDark}
      />
      {exerciseCalories > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, isDark && styles.labelDark]}>
            Exercise: {exerciseCalories} kcal burned
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  row: {
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  labelDark: {
    color: '#FFFFFF',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  trackDark: {
    backgroundColor: '#3A3A3C',
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyTextDark: {
    color: '#999999',
  },
});
