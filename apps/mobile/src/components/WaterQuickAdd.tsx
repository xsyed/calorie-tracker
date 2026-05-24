import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { formatWaterAmount } from '../waterFormat';

export const DEFAULT_WATER_GOAL = 2000;
export const QUICK_ADD_AMOUNT_ML = 250;

interface WaterQuickAddProps {
  dailyTotal: number;
  waterGoal: number;
  onAddWater: (amountMl: number) => Promise<void>;
  onRemoveWater: () => Promise<void>;
  addingAmountMl: number | null;
  onOpenWater: () => void;
}

export default function WaterQuickAdd({
  dailyTotal,
  waterGoal,
  onAddWater,
  onRemoveWater,
  addingAmountMl,
  onOpenWater,
}: WaterQuickAddProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const effectiveGoal = waterGoal > 0 ? waterGoal : DEFAULT_WATER_GOAL;
  const barWidth = Math.min((dailyTotal / effectiveGoal) * 100, 100);
  const debounceRef = useRef(false);

  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';
  const buttonsDisabled = addingAmountMl !== null;
  const removeDisabled = buttonsDisabled || dailyTotal <= 0;

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

  async function handleQuickRemove() {
    if (debounceRef.current || removeDisabled) return;

    debounceRef.current = true;
    try {
      await onRemoveWater();
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>Water</Text>
          <Pressable onPress={onOpenWater} hitSlop={8}>
            <Text style={[styles.openLink, { color: accentColor }]}>View</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.controlRow}>
        <Pressable
          onPress={handleQuickRemove}
          disabled={removeDisabled}
          hitSlop={8}
          style={removeDisabled && styles.controlButtonDisabled}
        >
          <Text style={[styles.controlButton, { color: accentColor }]}>-</Text>
        </Pressable>
        <Text style={[styles.statsLabel, isDarkMode && styles.statsLabelDark]} numberOfLines={1}>
          {formatWaterAmount(dailyTotal)}/{formatWaterAmount(effectiveGoal)}
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
        {addingAmountMl === null ? '0.25L each' : 'Updating...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
