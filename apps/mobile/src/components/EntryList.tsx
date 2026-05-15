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
  type: string;
  durationMinutes: number;
  caloriesBurned: number;
  timestamp: string;
}

interface EntryListProps {
  foodEntries: EntryListFoodEntry[];
  exerciseEntries: EntryListExerciseEntry[];
  onRetryEntry?: (entryId: string) => void;
  onEditEntry?: (entryId: string) => void;
  onSaveEntryAsMeal?: (entryId: string) => void;
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
  onRetryEntry,
  onEditEntry,
  onSaveEntryAsMeal,
}: EntryListProps) {
  const isDark = useColorScheme() === 'dark';

  const timeline: TimelineItem[] = [
    ...foodEntries.map((entry) => ({
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
          return renderFoodEntry(item.entry, isDark, onRetryEntry, onEditEntry, onSaveEntryAsMeal);
        }
        return renderExerciseEntry(item.entry, isDark);
      })}
    </View>
  );
}

function renderFoodEntry(
  entry: EntryListFoodEntry,
  isDark: boolean,
  onRetryEntry?: (entryId: string) => void,
  onEditEntry?: (entryId: string) => void,
  onSaveEntryAsMeal?: (entryId: string) => void,
) {
  const isFailed = entry.status === 'failed';
  const isPending = entry.status === 'pending';
  const isDimmed = isFailed || isPending;
  const isPressable = isFailed && onRetryEntry !== undefined;
  const canSaveAsMeal = isCompleteEntry(entry) && entry.items.length > 0 && onSaveEntryAsMeal !== undefined;

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
            <Text
              key={item.id}
              style={[styles.itemText, isDark && styles.itemTextDark]}
            >
              {'\u2022'} {item.name}  {item.calories} kcal  P{item.proteinG} C
              {item.carbsG} F{item.fatG}
            </Text>
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
          Tap to retry or edit
        </Text>
      )}

      {canSaveAsMeal && (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => onSaveEntryAsMeal(entry.id)}
            hitSlop={8}
          >
            <Text style={styles.actionButtonText}>Save as Meal</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (isPressable) {
    return (
      <Pressable
        key={`food-${entry.id}`}
        onPress={() => {
          onRetryEntry?.(entry.id);
          onEditEntry?.(entry.id);
        }}
      >
        {content}
      </Pressable>
    );
  }

  if (canSaveAsMeal) {
    return (
      <Pressable
        key={`food-${entry.id}`}
        onLongPress={() => onSaveEntryAsMeal(entry.id)}
        delayLongPress={350}
      >
        {content}
      </Pressable>
    );
  }

  return <View key={`food-${entry.id}`}>{content}</View>;
}

function isCompleteEntry(entry: EntryListFoodEntry): boolean {
  return entry.status === 'complete';
}

function renderExerciseEntry(
  entry: EntryListExerciseEntry,
  isDark: boolean,
) {
  return (
    <View key={`exercise-${entry.id}`} style={[styles.card, isDark && styles.cardDark]}>
      <Text style={[styles.entryTitle, isDark && styles.entryTitleDark]}>
        {entry.durationMinutes} min {entry.type} — {entry.caloriesBurned} kcal
      </Text>
      <Text style={[styles.subtext, isDark && styles.subtextDark]}>
        {formatTime(entry.timestamp)}
      </Text>
    </View>
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
  itemText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 3,
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
