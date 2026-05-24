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

function CompactProgress({
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
      <View style={styles.metric}>
        <Text style={[styles.metricLabel, isDark && styles.labelDark]}>{label}</Text>
        <Text style={[styles.metricValue, isDark && styles.labelDark]}>
          Set target
        </Text>
      </View>
    );
  }

  const barWidth = Math.min(percent!, 100);

  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, isDark && styles.labelDark]}>{label}</Text>
      <Text style={[styles.metricValue, isDark && styles.labelDark]} numberOfLines={1}>
        {consumed}{unit}/{target}{unit}
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
        <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.metricGrid}>
        <CompactProgress
          label="Calories"
          consumed={totalCalories}
          target={targetCalories}
          unit=""
          color={calorieColor}
          isDark={isDark}
        />
        <CompactProgress
          label="Protein"
          consumed={totalProtein}
          target={targetProtein}
          unit="g"
          color={proteinColor}
          isDark={isDark}
        />
        <CompactProgress
          label="Carbs"
          consumed={totalCarbs}
          target={targetCarbs}
          unit="g"
          color={carbsColor}
          isDark={isDark}
        />
        <CompactProgress
          label="Fat"
          consumed={totalFat}
          target={targetFat}
          unit="g"
          color={fatColor}
          isDark={isDark}
        />
      </View>
      {exerciseCalories > 0 && (
        <View style={styles.exerciseRow}>
          <Text style={[styles.exerciseText, isDark && styles.labelDark]}>
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
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 3,
  },
  labelDark: {
    color: '#FFFFFF',
  },
  track: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  trackDark: {
    backgroundColor: '#3A3A3C',
  },
  bar: {
    height: 2,
    borderRadius: 1,
  },
  exerciseRow: {
    marginTop: 6,
  },
  exerciseText: {
    fontSize: 11,
    color: '#000000',
  },
  emptyText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#999999',
  },
});
