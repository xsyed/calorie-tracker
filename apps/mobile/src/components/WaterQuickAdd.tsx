import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

export const DEFAULT_WATER_GOAL = 2000;

interface WaterQuickAddProps {
  dailyTotal: number;
  waterGoal: number;
  onAddWater: (amountMl: number) => Promise<void>;
  isAdding: boolean;
}

export default function WaterQuickAdd({
  dailyTotal,
  waterGoal,
  onAddWater,
  isAdding,
}: WaterQuickAddProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const effectiveGoal = waterGoal > 0 ? waterGoal : DEFAULT_WATER_GOAL;
  const percentage = Math.min(
    Math.round((dailyTotal / effectiveGoal) * 100),
    100,
  );
  const barWidth = Math.min((dailyTotal / effectiveGoal) * 100, 100);

  const debounceRef = useRef(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';
  const hasWater = dailyTotal > 0;
  const buttonsDisabled = isAdding;

  async function handleQuickAdd(amount: number) {
    if (debounceRef.current || isAdding) return;
    debounceRef.current = true;
    try {
      await onAddWater(amount);
    } finally {
      setTimeout(() => {
        debounceRef.current = false;
      }, 500);
    }
  }

  async function handleCustomSubmit() {
    const trimmed = customAmount.trim();
    if (trimmed === '') return;
    const amount = parseInt(trimmed, 10);
    if (isNaN(amount) || amount < 1 || amount > 5000) {
      setCustomError('Enter 1–5000ml');
      return;
    }
    if (isAdding) return;
    try {
      await onAddWater(amount);
      setCustomAmount('');
      setShowCustom(false);
      setCustomError(null);
    } catch {
      // parent handles error, keep input visible for retry
    }
  }

  function handleCustomPress() {
    setShowCustom((prev) => !prev);
    setCustomError(null);
    if (showCustom) {
      setCustomAmount('');
    }
  }

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      <Text style={[styles.title, isDarkMode && styles.titleDark]}>Water</Text>

      {hasWater ? (
        <Text style={[styles.statsLabel, isDarkMode && styles.statsLabelDark]}>
          {dailyTotal}ml / {effectiveGoal}ml ({percentage}%)
        </Text>
      ) : (
        <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
          No water logged yet today
        </Text>
      )}

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
          <Text
            style={[
              styles.pillButtonText,
              { color: accentColor },
            ]}
          >
            +200ml
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
          <Text
            style={[
              styles.pillButtonText,
              { color: accentColor },
            ]}
          >
            +500ml
          </Text>
        </Pressable>

        <Pressable
          onPress={handleCustomPress}
          disabled={buttonsDisabled}
          style={[
            styles.pillButton,
            { borderColor: accentColor },
            buttonsDisabled && styles.pillButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.pillButtonText,
              { color: accentColor },
            ]}
          >
            +Custom
          </Text>
        </Pressable>
      </View>

      {showCustom && (
        <View style={styles.customContainer}>
          <View style={styles.customRow}>
            <TextInput
              style={[
                styles.customInput,
                isDarkMode && styles.customInputDark,
                customError !== null && styles.customInputError,
              ]}
              placeholder="ml"
              placeholderTextColor={isDarkMode ? '#888888' : '#999999'}
              value={customAmount}
              onChangeText={(text) => {
                setCustomAmount(text);
                setCustomError(null);
              }}
              keyboardType="number-pad"
              editable={!isAdding}
            />
            <Pressable
              onPress={handleCustomSubmit}
              disabled={isAdding}
              style={[
                styles.customSubmit,
                { backgroundColor: accentColor },
                isAdding && styles.customSubmitDisabled,
              ]}
            >
              <Text style={styles.customSubmitText}>Add</Text>
            </Pressable>
          </View>
          {customError !== null && (
            <Text style={styles.customError}>{customError}</Text>
          )}
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
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
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
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyTextDark: {
    color: '#999999',
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
  customContainer: {
    marginTop: 8,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    color: '#000000',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  customInputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  customInputError: {
    borderColor: '#FF3B30',
  },
  customSubmit: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  customSubmitDisabled: {
    opacity: 0.4,
  },
  customSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customError: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
});
