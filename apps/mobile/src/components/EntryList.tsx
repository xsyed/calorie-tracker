import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

export interface EntryListFoodEntry {
  id: string;
  rawText: string;
  status: 'pending' | 'complete' | 'failed';
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>;
}

export interface EntryListExerciseEntry {
  id: string;
  foodEntryId: string | null;
  type: string;
  durationMinutes: number;
  caloriesBurned: number;
  timestamp: string;
}

interface EntryListProps {
  foodEntries: EntryListFoodEntry[];
  exerciseEntries: EntryListExerciseEntry[];
  onOpenEntryActions: (entryId: string) => void;
}

type TimelineItem =
  | { type: 'food'; entry: EntryListFoodEntry }
  | { type: 'exercise'; entry: EntryListExerciseEntry };

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config = {
    complete: {
      label: 'Complete',
      bg: '#E8F5E9',
      text: '#2E7D32',
      bgDark: '#1B3A1B',
      textDark: '#4CAF50',
    },
    pending: {
      label: 'Pending',
      bg: '#F5F5F5',
      text: '#757575',
      bgDark: '#2C2C2E',
      textDark: '#999999',
    },
    failed: {
      label: 'Failed',
      bg: '#FFEBEE',
      text: '#C62828',
      bgDark: '#3A1A1A',
      textDark: '#FF5252',
    },
  }[status] ?? {
    label: status,
    bg: '#F5F5F5',
    text: '#757575',
    bgDark: '#2C2C2E',
    textDark: '#999999',
  };

  return (
    <View
      style={{
        backgroundColor: isDark ? config.bgDark : config.bg,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: isDark ? config.textDark : config.text,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}

export default function EntryList({
  foodEntries,
  exerciseEntries,
  onOpenEntryActions,
}: EntryListProps) {
  const isDark = useColorScheme() === 'dark';
  const exerciseFoodEntryIds = new Set(exerciseEntries.map((entry) => entry.foodEntryId));

  const timeline: TimelineItem[] = [
    ...foodEntries
      .filter((entry) => shouldShowFoodEntry(entry, exerciseFoodEntryIds))
      .map((entry) => ({
        type: 'food' as const,
        entry,
        ts: entry.createdAt,
      })),
    ...exerciseEntries.map((entry) => ({
      type: 'exercise' as const,
      entry,
      ts: entry.timestamp,
    })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

  if (timeline.length === 0) {
    return (
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
          No entries for this day.
        </Text>
        <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
          Tap the input bar below to log your first meal or exercise.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
        Today's Entries
      </Text>
      {timeline.map((item, _index) => {
        if (item.type === 'food') {
          return renderFoodEntry(
            item.entry,
            isDark,
            onOpenEntryActions,
          );
        }
        return renderExerciseEntry(item.entry, isDark, onOpenEntryActions);
      })}
    </View>
  );
}

function renderFoodEntry(
  entry: EntryListFoodEntry,
  isDark: boolean,
  onOpenEntryActions: (entryId: string) => void,
) {
  const isFailed = entry.status === 'failed';
  const isPending = entry.status === 'pending';
  const isDimmed = isFailed || isPending;

  const content = (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.entryHeader}>
        <Text
          style={[
            styles.entryTitle,
            isDark && styles.entryTitleDark,
            isDimmed && styles.dimmed,
          ]}
          numberOfLines={3}
        >
          {entry.rawText}
        </Text>
        <StatusBadge status={entry.status} isDark={isDark} />
      </View>

      {isCompleteEntry(entry) && entry.items.length > 0 && (
        <View style={styles.itemsList}>
          {entry.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={[styles.itemText, isDark && styles.itemTextDark]}>
                {'\u2022'} {item.name}
              </Text>
              <Text style={[styles.itemSummaryText, isDark && styles.itemTextDark]}>
                {formatFoodItemSummary(item)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {isCompleteEntry(entry) && entry.items.length === 0 && (
        <Text style={[styles.subtext, isDark && styles.subtextDark]}>
          No items parsed.
        </Text>
      )}

      {isPending && (
        <Text style={[styles.processingText, isDark && styles.processingTextDark]}>
          Processing...
        </Text>
      )}

      {isFailed && (
        <Text style={[styles.subtext, isDark && styles.subtextDark]}>
          Tap for entry actions
        </Text>
      )}
    </View>
  );

  return (
    <Pressable key={`food-${entry.id}`} onPress={() => onOpenEntryActions(entry.id)}>
      {content}
    </Pressable>
  );
}

function shouldShowFoodEntry(entry: EntryListFoodEntry, exerciseFoodEntryIds: Set<string | null>): boolean {
  return !isCompleteEntry(entry) || entry.items.length > 0 || !exerciseFoodEntryIds.has(entry.id);
}

function isCompleteEntry(entry: EntryListFoodEntry): boolean {
  return entry.status === 'complete';
}

function formatFoodItemSummary(item: EntryListFoodEntry['items'][number]): string {
  return [
    `${formatNumber(item.calories)} kcal`,
    ...formatMacroParts(item),
  ].join(' \u00b7 ');
}

function formatMacroParts(item: EntryListFoodEntry['items'][number]): string[] {
  return [
    formatMacroPart('P', item.proteinG),
    formatMacroPart('C', item.carbsG),
    formatMacroPart('F', item.fatG),
  ].filter((part): part is string => part !== null);
}

function formatMacroPart(label: string, value: number): string | null {
  return value > 0 ? `${label}${formatNumber(value)}g` : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function renderExerciseEntry(
  entry: EntryListExerciseEntry,
  isDark: boolean,
  onOpenEntryActions: (entryId: string) => void,
) {
  const content = (
    <View key={`exercise-${entry.id}`} style={[styles.card, isDark && styles.cardDark]}>
      <Text style={[styles.entryTitle, isDark && styles.entryTitleDark]}>
        {entry.durationMinutes} min {entry.type} - {entry.caloriesBurned} kcal
      </Text>
      <Text style={[styles.subtext, isDark && styles.subtextDark]}>
        {formatTime(entry.timestamp)}
      </Text>
    </View>
  );

  const foodEntryId = entry.foodEntryId;
  if (foodEntryId === null) return content;

  return (
    <Pressable key={`exercise-${entry.id}`} onPress={() => onOpenEntryActions(foodEntryId)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#333333',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitleDark: {
    color: '#888888',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  entryTitleDark: {
    color: '#FFFFFF',
  },
  dimmed: {
    opacity: 0.5,
  },
  itemsList: {
    marginTop: 8,
    paddingLeft: 4,
  },
  itemRow: {
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#666666',
  },
  itemSummaryText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 1,
  },
  itemTextDark: {
    color: '#999999',
  },
  subtext: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
  },
  subtextDark: {
    color: '#666666',
  },
  processingText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#999999',
    marginTop: 4,
  },
  processingTextDark: {
    color: '#666666',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  emptyTitleDark: {
    color: '#999999',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitleDark: {
    color: '#666666',
  },
});
