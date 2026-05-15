import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { FoodEntryWithItems, SavedMealWithItems } from '../database';

export interface HistorySection {
  title: string;
  data: FoodEntryWithItems[];
}

function truncatePreview(rawText: string): string {
  if (rawText.length <= 80) return rawText;
  return `${rawText.slice(0, 77)}...`;
}

function getLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDateLabel(dateValue: string): string {
  const date = getLocalDate(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function buildHistorySections(entries: FoodEntryWithItems[]): HistorySection[] {
  const grouped = new Map<string, FoodEntryWithItems[]>();

  for (const entry of entries) {
    const groupEntries = grouped.get(entry.entry.date) ?? [];
    groupEntries.push(entry);
    grouped.set(entry.entry.date, groupEntries);
  }

  return Array.from(grouped.entries()).map(([date, data]) => ({
    title: formatDateLabel(date),
    data,
  }));
}

export function HistoryContent({
  sections,
  isLoading,
  loadError,
  isDark,
  isBusy,
  onApply,
  onSaveAsMeal,
}: {
  sections: HistorySection[];
  isLoading: boolean;
  loadError: string | null;
  isDark: boolean;
  isBusy: boolean;
  onApply: (entry: FoodEntryWithItems) => void;
  onSaveAsMeal: (entry: FoodEntryWithItems) => void;
}) {
  if (isLoading) return <LoadingState isDark={isDark} />;
  if (loadError !== null) return <EmptyState message={loadError} isDark={isDark} />;

  if (sections.length === 0) {
    return <EmptyState message="Nothing here yet. Log some meals first!" isDark={isDark} />;
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.entry.id}
      renderItem={({ item }) => (
        <HistoryCard
          item={item}
          isDark={isDark}
          isDisabled={isBusy}
          onApply={() => onApply(item)}
          onSaveAsMeal={() => onSaveAsMeal(item)}
        />
      )}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
          {section.title}
        </Text>
      )}
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled={false}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
    />
  );
}

export function SavedMealsContent({
  meals,
  isLoading,
  loadError,
  isDark,
  isBusy,
  deletingId,
  onApply,
  onDelete,
}: {
  meals: SavedMealWithItems[];
  isLoading: boolean;
  loadError: string | null;
  isDark: boolean;
  isBusy: boolean;
  deletingId: string | null;
  onApply: (meal: SavedMealWithItems) => void;
  onDelete: (meal: SavedMealWithItems) => void;
}) {
  if (isLoading) return <LoadingState isDark={isDark} />;
  if (loadError !== null) return <EmptyState message={loadError} isDark={isDark} />;
  if (meals.length === 0) {
    return (
      <EmptyState
        message="No saved meals. Tap 'Save as meal' on any entry in History."
        isDark={isDark}
      />
    );
  }

  return (
    <FlatList
      data={meals}
      keyExtractor={(item) => item.savedMeal.id}
      ListHeaderComponent={(
        <Text style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
          Saved Meals
        </Text>
      )}
      renderItem={({ item }) => renderSavedMeal({
        item,
        isDark,
        isBusy,
        deletingId,
        onApply,
        onDelete,
      })}
      contentContainerStyle={styles.listContent}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
    />
  );
}

function renderSavedMeal({
  item,
  isDark,
  isBusy,
  deletingId,
  onApply,
  onDelete,
}: {
  item: SavedMealWithItems;
  isDark: boolean;
  isBusy: boolean;
  deletingId: string | null;
  onApply: (meal: SavedMealWithItems) => void;
  onDelete: (meal: SavedMealWithItems) => void;
}) {
  return (
    <SavedMealCard
      meal={item}
      isDark={isDark}
      isDisabled={isBusy}
      isDeleting={deletingId === item.savedMeal.id}
      onApply={() => onApply(item)}
      onDelete={() => onDelete(item)}
    />
  );
}

function LoadingState({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#000000'} />
    </View>
  );
}

function EmptyState({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        {message}
      </Text>
    </View>
  );
}

function HistoryCard({
  item,
  isDark,
  isDisabled,
  onApply,
  onSaveAsMeal,
}: {
  item: FoodEntryWithItems;
  isDark: boolean;
  isDisabled: boolean;
  onApply: () => void;
  onSaveAsMeal: () => void;
}) {
  return (
    <View style={[styles.card, isDark && styles.cardDark, isDisabled && styles.cardDisabled]}>
      <Text
        style={[styles.cardTitle, isDark && styles.cardTitleDark]}
        numberOfLines={2}
      >
        {truncatePreview(item.entry.raw_text)}
      </Text>
      <FoodItemList items={item.items} isDark={isDark} />
      <View style={styles.actionRow}>
        <ActionButton label="Use" isDisabled={isDisabled} onPress={onApply} />
        <ActionButton label="Save as Meal" isDisabled={isDisabled} onPress={onSaveAsMeal} />
      </View>
    </View>
  );
}

function SavedMealCard({
  meal,
  isDark,
  isDisabled,
  isDeleting,
  onApply,
  onDelete,
}: {
  meal: SavedMealWithItems;
  isDark: boolean;
  isDisabled: boolean;
  isDeleting: boolean;
  onApply: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, isDark && styles.cardDark, isDisabled && styles.cardDisabled]}>
      <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
        {meal.savedMeal.name}
      </Text>
      <FoodItemList items={meal.items} isDark={isDark} />
      <View style={styles.actionRow}>
        <ActionButton label="Use" isDisabled={isDisabled} onPress={onApply} />
        <ActionButton
          label={isDeleting ? 'Deleting...' : 'Delete'}
          isDisabled={isDisabled}
          isDestructive
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  isDisabled,
  isDestructive = false,
  onPress,
}: {
  label: string;
  isDisabled: boolean;
  isDestructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.actionButton, isDestructive && styles.destructiveActionButton]}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={8}
    >
      <Text style={[styles.actionButtonText, isDestructive && styles.destructiveActionText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FoodItemList({
  items,
  isDark,
}: {
  items: Array<{ id: string; name: string; calories: number }>;
  isDark: boolean;
}) {
  return (
    <View style={styles.itemList}>
      {items.map((food) => (
        <Text
          key={food.id}
          style={[styles.itemText, isDark && styles.itemTextDark]}
        >
          {food.name} · {food.calories} kcal
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#C7C7CC',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionHeader: {
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#666666',
  },
  sectionHeaderDark: {
    color: '#C7C7CC',
  },
  card: {
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    borderColor: '#333333',
    backgroundColor: '#2C2C2E',
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  cardTitleDark: {
    color: '#FFFFFF',
  },
  itemList: {
    marginTop: 8,
    gap: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#666666',
  },
  itemTextDark: {
    color: '#C7C7CC',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  destructiveActionButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  destructiveActionText: {
    color: '#FFFFFF',
  },
});
