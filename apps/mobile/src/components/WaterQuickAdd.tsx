import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

export const DEFAULT_WATER_GOAL = 2000;

interface WaterQuickAddProps {
  dailyTotal: number;
  waterGoal: number;
  onAddWater: (amountMl: number) => Promise<void>;
  addingAmountMl: number | null;
  dateLabel: string;
  onOpenWater: () => void;
}

export default function WaterQuickAdd({
  dailyTotal,
  waterGoal,
  onAddWater,
  addingAmountMl,
  dateLabel,
  onOpenWater,
}: WaterQuickAddProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const effectiveGoal = waterGoal > 0 ? waterGoal : DEFAULT_WATER_GOAL;
  const percentage = Math.min(
    Math.round((dailyTotal / effectiveGoal) * 100),
    100,
  );
  const barWidth = Math.min((dailyTotal / effectiveGoal) * 100, 100);
  const debounceRef = useRef(false);

  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';
  const buttonsDisabled = addingAmountMl !== null;

  async function handleQuickAdd(amountMl: number) {
    if (debounceRef.current || addingAmountMl !== null) return;

    debounceRef.current = true;
    try {
      await onAddWater(amountMl);
    } catch {
      return;
    } finally {
      setTimeout(() => {
        debounceRef.current = false;
      }, 500);
    }
  }

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>Water</Text>
        <Pressable onPress={onOpenWater} hitSlop={8}>
          <Text style={[styles.openLink, { color: accentColor }]}>View</Text>
        </Pressable>
      </View>

      <Text style={[styles.contextLabel, isDarkMode && styles.contextLabelDark]}>
        Logging to {dateLabel}
      </Text>
      <Text style={[styles.statsLabel, isDarkMode && styles.statsLabelDark]}>
        {dailyTotal}ml / {effectiveGoal}ml ({percentage}%)
      </Text>

      <View style={[styles.track, isDarkMode && styles.trackDark]}>
        <View
          style={[
            styles.bar,
            { width: `${barWidth}%`, backgroundColor: accentColor },
          ]}
        />
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => handleQuickAdd(200)}
          disabled={buttonsDisabled}
          style={[
            styles.pillButton,
            { borderColor: accentColor },
            buttonsDisabled && styles.pillButtonDisabled,
          ]}
        >
          <Text style={[styles.pillButtonText, { color: accentColor }]}>
            {addingAmountMl === 200 ? 'Adding...' : '+200ml'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleQuickAdd(500)}
          disabled={buttonsDisabled}
          style={[
            styles.pillButton,
            { borderColor: accentColor },
            buttonsDisabled && styles.pillButtonDisabled,
          ]}
        >
          <Text style={[styles.pillButtonText, { color: accentColor }]}>
            {addingAmountMl === 500 ? 'Adding...' : '+500ml'}
          </Text>
        </Pressable>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  openLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  contextLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  contextLabelDark: {
    color: '#999999',
  },
  statsLabel: {
    fontSize: 14,
    color: '#000000',
    marginTop: 12,
    marginBottom: 4,
  },
  statsLabelDark: {
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillButtonDisabled: {
    opacity: 0.4,
  },
  pillButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
