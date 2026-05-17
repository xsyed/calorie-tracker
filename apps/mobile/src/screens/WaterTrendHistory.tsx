import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WaterEntry } from '../database';
import { formatWaterAmount } from '../waterFormat';

export interface WaterTrendDay {
  date: string;
  total_ml: number;
}

export interface WaterHistoryGroup {
  date: string;
  entries: WaterEntry[];
}

interface WaterTrendHistoryProps {
  accentColor: string;
  goalMl: number;
  groups: WaterHistoryGroup[];
  isDarkMode: boolean;
  deletingId: string | null;
  onDelete: (entryId: string) => void;
  onFormatDate: (date: string) => string;
  onFormatTime: (timestamp: string) => string;
  trend: WaterTrendDay[];
}

function formatShortDay(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
  });
}

function getChartMax(goalMl: number, trend: WaterTrendDay[]): number {
  const maxTotal = Math.max(0, ...trend.map((day) => day.total_ml));
  return Math.max(goalMl, maxTotal, 1);
}

export function WaterTrendHistory({
  accentColor,
  goalMl,
  groups,
  isDarkMode,
  deletingId,
  onDelete,
  onFormatDate,
  onFormatTime,
  trend,
}: WaterTrendHistoryProps) {
  const chartMax = getChartMax(goalMl, trend);
  const goalOffset = `${100 - (Math.min(goalMl, chartMax) / chartMax) * 100}%` as `${number}%`;
  const hasEntries = groups.some((group) => group.entries.length > 0);

  return (
    <>
      <View style={[styles.card, isDarkMode && styles.cardDark]}>
        <View style={styles.titleRow}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.titleDark]}>7-day trend</Text>
          <Text style={[styles.goalText, isDarkMode && styles.mutedText]}>
            Goal {formatWaterAmount(goalMl)}
          </Text>
        </View>
        <View style={styles.chart}>
          <View style={[styles.goalLine, { top: goalOffset }]} />
          {trend.map((day) => (
            <View key={day.date} style={styles.barColumn}>
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.trendBar,
                    {
                      backgroundColor: accentColor,
                      height: `${(day.total_ml / chartMax) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.dayLabel, isDarkMode && styles.mutedText]}>{formatShortDay(day.date)}</Text>
              <Text style={[styles.amountLabel, isDarkMode && styles.mutedText]}>
                {formatWaterAmount(day.total_ml)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, isDarkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.titleDark]}>7-day history</Text>
        {hasEntries ? (
          groups.map((group) => (
            <View key={group.date} style={styles.historyGroup}>
              <Text style={[styles.historyDate, isDarkMode && styles.titleDark]}>{onFormatDate(group.date)}</Text>
              {group.entries.map((entry) => (
                <View key={entry.id} style={[styles.entryRow, isDarkMode && styles.entryRowDark]}>
                  <View>
                    <Text style={[styles.entryAmount, isDarkMode && styles.titleDark]}>
                      {formatWaterAmount(entry.amount_ml)}
                    </Text>
                    <Text style={[styles.entryTime, isDarkMode && styles.mutedText]}>
                      {onFormatTime(entry.timestamp)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onDelete(entry.id)}
                    disabled={deletingId !== null}
                    hitSlop={8}
                  >
                    <Text style={[styles.deleteText, deletingId !== null && styles.disabled]}>
                      {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, isDarkMode && styles.mutedText]}>
            No water logged in the last 7 days.
          </Text>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },
  cardDark: { backgroundColor: '#1C1C1E' },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: { color: '#FFFFFF' },
  mutedText: { color: '#999999' },
  goalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  chart: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 170,
    gap: 8,
    marginTop: 16,
    paddingTop: 8,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FF9500',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barSlot: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  trendBar: {
    minHeight: 2,
    borderRadius: 4,
  },
  dayLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  amountLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#666666',
  },
  historyGroup: {
    marginTop: 14,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  entryRowDark: { borderBottomColor: '#333333' },
  entryAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  entryTime: {
    marginTop: 2,
    fontSize: 13,
    color: '#666666',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CC0000',
  },
  disabled: { opacity: 0.4 },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
});
