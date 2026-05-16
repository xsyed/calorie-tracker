import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WeightEntry } from '../database';

import { formatDate, formatSignedWeight, formatWeight } from './weightFormatUtils';

interface WeightHistoryRowProps {
  delta: string | null;
  entry: WeightEntry;
  isDarkMode: boolean;
  onDelete: (entry: WeightEntry) => void;
}

export function WeightHistoryRow({ delta, entry, isDarkMode, onDelete }: WeightHistoryRowProps) {
  return (
    <View style={[styles.historyRow, isDarkMode && styles.historyRowDark]}>
      <View>
        <Text style={[styles.rowWeight, isDarkMode && styles.rowWeightDark]}>
          {formatWeight(entry.weight_kg)} kg
        </Text>
        <Text style={[styles.rowDate, isDarkMode && styles.rowDateDark]}>
          {formatDate(entry.date)}
        </Text>
      </View>
      {delta !== null && (
        <Text style={[styles.rowDelta, isDarkMode && styles.rowDeltaDark]}>
          {delta}
        </Text>
      )}
      <Pressable
        accessibilityLabel={`Delete ${formatWeight(entry.weight_kg)} kg weigh-in from ${formatDate(entry.date)}`}
        onPress={() => onDelete(entry)}
        style={[styles.deleteButton, isDarkMode && styles.deleteButtonDark]}
      >
        <Text style={[styles.deleteText, isDarkMode && styles.deleteTextDark]}>
          Delete
        </Text>
      </Pressable>
    </View>
  );
}

export function getHistoryDelta(entries: WeightEntry[], index: number): string | null {
  const entry = entries[index];
  if (entry === undefined || entries.length < 2) return null;

  const previousChronological = entries[index + 1];
  if (previousChronological !== undefined) {
    return `${formatSignedWeight(entry.weight_kg - previousChronological.weight_kg)} vs previous`;
  }

  const nextNewer = entries[index - 1];
  if (nextNewer === undefined) return null;
  return `${formatSignedWeight(entry.weight_kg - nextNewer.weight_kg)} vs next`;
}

const styles = StyleSheet.create({
  historyRow: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyRowDark: {
    backgroundColor: '#1C1C1E',
  },
  rowWeight: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },
  rowWeightDark: {
    color: '#FFFFFF',
  },
  rowDate: {
    marginTop: 4,
    fontSize: 14,
    color: '#666666',
  },
  rowDateDark: {
    color: '#A0A0A0',
  },
  rowDelta: {
    flexShrink: 0,
    fontSize: 14,
    color: '#555555',
  },
  rowDeltaDark: {
    color: '#BBBBBB',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  deleteButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  deleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
  },
  deleteTextDark: {
    color: '#BBBBBB',
  },
});
