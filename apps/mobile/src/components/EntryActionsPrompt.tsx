import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { EntryListExerciseEntry, EntryListFoodEntry } from './EntryList';

interface EntryActionsPromptProps {
  entry: EntryListFoodEntry;
  linkedExercises: EntryListExerciseEntry[];
  isDark: boolean;
  isQueueActive: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSaveAsMeal: () => void;
  onDelete: () => void;
}

function getEditDisabledMessage(
  entry: EntryListFoodEntry,
  isQueueActive: boolean,
): string | null {
  if (entry.status === 'pending') {
    return 'Editing is available once processing completes.';
  }
  if (isQueueActive) {
    return 'Editing is available once processing completes.';
  }
  if (entry.status !== 'complete') {
    return 'Only complete entries can be edited.';
  }
  return null;
}

export default function EntryActionsPrompt({
  entry,
  linkedExercises,
  isDark,
  isQueueActive,
  onClose,
  onEdit,
  onSaveAsMeal,
  onDelete,
}: EntryActionsPromptProps) {
  const editDisabledMessage = getEditDisabledMessage(entry, isQueueActive);
  const canEdit = editDisabledMessage === null;
  const canSaveAsMeal = entry.status === 'complete' && entry.items.length > 0;
  const canDelete = entry.status === 'complete';

  return (
    <View style={styles.backdrop}>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            Entry Actions
          </Text>
          <Text style={[styles.label, isDark && styles.labelDark]}>
            Original prompt
          </Text>
          <Text style={[styles.rawText, isDark && styles.rawTextDark]}>
            {entry.rawText}
          </Text>

          <Text style={[styles.label, isDark && styles.labelDark]}>
            Parsed items
          </Text>
          {entry.items.length > 0 ? (
            entry.items.map((item) => (
              <Text key={item.id} style={[styles.detailText, isDark && styles.detailTextDark]}>
                {'\u2022'} {item.name}: {item.calories} kcal, P{item.proteinG} C{item.carbsG} F{item.fatG}
              </Text>
            ))
          ) : (
            <Text style={[styles.detailText, isDark && styles.detailTextDark]}>
              No food items parsed.
            </Text>
          )}

          {linkedExercises.length > 0 && (
            <>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                Linked exercises
              </Text>
              {linkedExercises.map((exercise) => (
                <Text key={exercise.id} style={[styles.detailText, isDark && styles.detailTextDark]}>
                  {'\u2022'} {exercise.durationMinutes} min {exercise.type}: {exercise.caloriesBurned} kcal
                </Text>
              ))}
            </>
          )}

          {editDisabledMessage !== null && (
            <Text style={[styles.helpText, isDark && styles.helpTextDark]}>
              {editDisabledMessage}
            </Text>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, !canEdit && styles.buttonDisabled]}
            onPress={onEdit}
            disabled={!canEdit}
          >
            <Text style={styles.primaryText}>Edit Prompt</Text>
          </Pressable>
          {canSaveAsMeal && (
            <Pressable style={styles.button} onPress={onSaveAsMeal}>
              <Text style={styles.primaryText}>Save as Meal</Text>
            </Pressable>
          )}
          {canDelete && (
            <Pressable style={[styles.button, styles.deleteButton]} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          )}
          <Pressable style={[styles.button, styles.closeButton]} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  card: {
    maxHeight: '86%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#2C2C2E',
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#666666',
  },
  labelDark: {
    color: '#BBBBBB',
  },
  rawText: {
    fontSize: 15,
    color: '#000000',
  },
  rawTextDark: {
    color: '#FFFFFF',
  },
  detailText: {
    marginBottom: 4,
    fontSize: 14,
    color: '#555555',
  },
  detailTextDark: {
    color: '#D1D1D6',
  },
  helpText: {
    marginTop: 12,
    fontSize: 13,
    color: '#666666',
  },
  helpTextDark: {
    color: '#BBBBBB',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  button: {
    minWidth: 98,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CC0000',
  },
  closeButton: {
    backgroundColor: '#E5E5EA',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
