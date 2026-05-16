import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

export const DEFAULT_WATER_GOAL = 2000;
const QUICK_ADD_AMOUNT_ML = 250;

interface WaterQuickAddProps {
  dailyTotal: number;
  waterGoal: number;
  onAddWater: (amountMl: number) => Promise<void>;
  addingAmountMl: number | null;
  onOpenWater: () => void;
}

export default function WaterQuickAdd({
  dailyTotal,
  waterGoal,
  onAddWater,
  addingAmountMl,
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

      <View style={styles.controlRow}>
        <Text style={[styles.controlButton, styles.controlButtonDisabled]}>-</Text>
        <Text style={[styles.statsLabel, isDarkMode && styles.statsLabelDark]} numberOfLines={1}>
          {dailyTotal}ml/{effectiveGoal}ml ({percentage}%)
        </Text>
        <Pressable
          onPress={() => handleQuickAdd(QUICK_ADD_AMOUNT_ML)}
          disabled={buttonsDisabled}
          hitSlop={8}
          style={buttonsDisabled && styles.controlButtonDisabled}
        >
          <Text style={[styles.controlButton, { color: accentColor }]}>+</Text>
        </Pressable>
      </View>

      <View style={[styles.track, isDarkMode && styles.trackDark]}>
        <View
          style={[
            styles.bar,
            { width: `${barWidth}%`, backgroundColor: accentColor },
          ]}
        />
      </View>

      <Text style={[styles.incrementLabel, isDarkMode && styles.contextLabelDark]}>
        {addingAmountMl === QUICK_ADD_AMOUNT_ML ? 'Adding...' : '0.25L each'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  openLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  contextLabelDark: {
    color: '#999999',
  },
  statsLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  statsLabelDark: {
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
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  controlButton: {
    minWidth: 20,
    fontSize: 18,
    fontWeight: '700',
    color: '#8E8E93',
    textAlign: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  incrementLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginTop: 2,
  },
});
