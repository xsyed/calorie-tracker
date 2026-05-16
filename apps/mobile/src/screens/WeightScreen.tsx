import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth';
import { deleteWeightEntry, getUser, getWeightEntries, insertWeightEntry } from '../database';
import type { WeightEntry } from '../database';

import { getHistoryDelta, WeightHistoryRow } from './WeightHistoryRow';
import { formatDate, formatSignedWeight, formatWeight } from './weightFormatUtils';
import { WeightLogForm } from './WeightLogForm';
import { WeightTrendChart } from './WeightTrendChart';

interface WeightSummary {
  currentLabel: string;
  dateLabel: string;
  totalChangeLabel: string | null;
  weeklyRateLabel: string | null;
}

const DELETE_UNDO_MS = 6000;

export default function WeightScreen() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const isDarkMode = useColorScheme() === 'dark';
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logFormVisible, setLogFormVisible] = useState(false);
  const [pendingDeletedEntry, setPendingDeletedEntry] = useState<WeightEntry | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summary = useMemo(() => buildSummary(entries), [entries]);

  useEffect(() => () => {
    if (deleteTimer.current !== null) {
      clearTimeout(deleteTimer.current);
    }
  }, []);

  useEffect(() => {
    const firebaseUid = auth.user?.uid;
    if (firebaseUid === undefined) {
      setLoading(false);
      setError('User not found.');
      return;
    }

    setLoading(true);
    getUser(firebaseUid)
      .then((user) => {
        if (user === null) {
          setError('User not found.');
          setLoading(false);
          return;
        }
        setUserId(user.id);
      })
      .catch(() => {
        setError('Failed to load weight. Try again.');
        setLoading(false);
      });
  }, [auth.user?.uid]);

  const loadWeightData = useCallback(async () => {
    if (userId === null) return;

    setLoading(true);
    setError(null);
    try {
      const loadedEntries = await getWeightEntries(userId);
      setEntries(loadedEntries.filter((entry) => entry.id !== pendingDeletedEntry?.id));
    } catch {
      setError('Failed to load weight. Try again.');
    } finally {
      setLoading(false);
    }
  }, [pendingDeletedEntry?.id, userId]);

  useFocusEffect(
    useCallback(() => {
      loadWeightData();
    }, [loadWeightData]),
  );

  const restoreEntry = useCallback((entry: WeightEntry) => {
    setEntries((currentEntries) => sortEntriesNewestFirst(
      currentEntries.some((currentEntry) => currentEntry.id === entry.id)
        ? currentEntries
        : [...currentEntries, entry],
    ));
  }, []);

  const finishDelete = useCallback(async (entry: WeightEntry) => {
    if (userId === null) {
      restoreEntry(entry);
      setDeleteMessage('Failed to delete weigh-in.');
      setPendingDeletedEntry(null);
      return;
    }

    try {
      await deleteWeightEntry(entry.id, userId);
      setPendingDeletedEntry((currentEntry) => (currentEntry?.id === entry.id ? null : currentEntry));
      setDeleteMessage((currentMessage) => (currentMessage === 'Weigh-in deleted.' ? null : currentMessage));
    } catch {
      restoreEntry(entry);
      setDeleteMessage('Failed to delete weigh-in.');
      setPendingDeletedEntry((currentEntry) => (currentEntry?.id === entry.id ? null : currentEntry));
    }
  }, [restoreEntry, userId]);

  const handleDeleteWeight = useCallback((entry: WeightEntry) => {
    if (pendingDeletedEntry !== null) {
      setDeleteMessage('Undo or wait before deleting another weigh-in.');
      return;
    }

    setEntries((currentEntries) => currentEntries.filter((currentEntry) => currentEntry.id !== entry.id));
    setPendingDeletedEntry(entry);
    setDeleteMessage('Weigh-in deleted.');

    deleteTimer.current = setTimeout(() => {
      deleteTimer.current = null;
      void finishDelete(entry);
    }, DELETE_UNDO_MS);
  }, [finishDelete, pendingDeletedEntry]);

  const handleUndoDelete = useCallback(() => {
    const entry = pendingDeletedEntry;
    if (entry === null) return;
    if (deleteTimer.current !== null) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
    }

    restoreEntry(entry);
    setPendingDeletedEntry(null);
    setDeleteMessage(null);
  }, [pendingDeletedEntry, restoreEntry]);

  const renderEntry = useCallback<ListRenderItem<WeightEntry>>(
    ({ item, index }) => (
      <WeightHistoryRow
        entry={item}
        delta={getHistoryDelta(entries, index)}
        isDarkMode={isDarkMode}
        onDelete={handleDeleteWeight}
      />
    ),
    [entries, handleDeleteWeight, isDarkMode],
  );

  const handleSaveWeight = useCallback(async (date: string, weightKg: number) => {
    if (userId === null) {
      throw new Error('User not found.');
    }

    await insertWeightEntry({
      user_id: userId,
      date,
      weight_kg: weightKg,
    });
    setLogFormVisible(false);
    await loadWeightData();
  }, [loadWeightData, userId]);

  return (
    <>
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(entry) => entry.id}
        style={[styles.container, isDarkMode && styles.containerDark]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        ListHeaderComponent={
          <WeightHeader
            error={error}
            isDarkMode={isDarkMode}
            loading={loading}
            deleteMessage={deleteMessage}
            onLogWeight={() => setLogFormVisible(true)}
            onRetry={loadWeightData}
            onUndoDelete={handleUndoDelete}
            pendingDeletedEntry={pendingDeletedEntry}
            entries={entries}
            summary={summary}
            totalEntries={entries.length}
          />
        }
      />
      <WeightLogForm
        isDarkMode={isDarkMode}
        onCancel={() => setLogFormVisible(false)}
        onSave={handleSaveWeight}
        visible={logFormVisible}
      />
    </>
  );
}

interface WeightHeaderProps {
  deleteMessage: string | null;
  entries: WeightEntry[];
  error: string | null;
  isDarkMode: boolean;
  loading: boolean;
  onLogWeight: () => void;
  onRetry: () => void;
  onUndoDelete: () => void;
  pendingDeletedEntry: WeightEntry | null;
  summary: WeightSummary;
  totalEntries: number;
}

function WeightHeader({
  deleteMessage,
  entries,
  error,
  isDarkMode,
  loading,
  onLogWeight,
  onRetry,
  onUndoDelete,
  pendingDeletedEntry,
  summary,
  totalEntries,
}: WeightHeaderProps) {
  const displayedSummary = error === null ? summary : getUnavailableSummary();

  return (
    <View>
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Weight
          </Text>
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
            Track weigh-ins over time.
          </Text>
        </View>
        <Pressable
          onPress={onLogWeight}
          style={[styles.logButton, isDarkMode && styles.logButtonDark]}
        >
          <Text style={[styles.logButtonText, isDarkMode && styles.logButtonTextDark]}>
            + Log Weight
          </Text>
        </Pressable>
      </View>

      <View style={[styles.summary, isDarkMode && styles.summaryDark]}>
        <Text style={[styles.label, isDarkMode && styles.labelDark]}>
          Current
        </Text>
        <Text style={[styles.weight, isDarkMode && styles.weightDark]}>
          {displayedSummary.currentLabel}
        </Text>
        <Text style={[styles.date, isDarkMode && styles.dateDark]}>
          {displayedSummary.dateLabel}
        </Text>
        {displayedSummary.totalChangeLabel !== null && (
          <Text style={[styles.metric, isDarkMode && styles.metricDark]}>
            {displayedSummary.totalChangeLabel}
          </Text>
        )}
        {displayedSummary.weeklyRateLabel !== null && (
          <Text style={[styles.metric, isDarkMode && styles.metricDark]}>
            {displayedSummary.weeklyRateLabel}
          </Text>
        )}
      </View>

      {getStateBlock(error, isDarkMode, loading, onRetry)}
      {deleteMessage !== null && (
        <View style={[styles.notice, isDarkMode && styles.noticeDark]}>
          <Text style={[styles.noticeText, isDarkMode && styles.noticeTextDark]}>
            {deleteMessage}
          </Text>
          {pendingDeletedEntry !== null && (
            <Pressable
              onPress={onUndoDelete}
              style={[styles.undoButton, isDarkMode && styles.undoButtonDark]}
            >
              <Text style={[styles.undoText, isDarkMode && styles.undoTextDark]}>
                Undo
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {!loading && error === null && <WeightTrendChart entries={entries} isDarkMode={isDarkMode} />}
      {totalEntries > 0 && (
        <Text style={[styles.historyTitle, isDarkMode && styles.historyTitleDark]}>
          History
        </Text>
      )}
    </View>
  );
}

function getStateBlock(
  error: string | null,
  isDarkMode: boolean,
  loading: boolean,
  onRetry: () => void,
) {
  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        style={styles.loader}
        color={isDarkMode ? '#FFFFFF' : '#000000'}
      />
    );
  }

  if (error !== null) {
    return (
      <View style={styles.stateBlock}>
        <Text style={[styles.error, isDarkMode && styles.errorDark]}>
          {error}
        </Text>
        <Pressable
          onPress={onRetry}
          style={[styles.retryButton, isDarkMode && styles.retryButtonDark]}
        >
          <Text style={[styles.retryText, isDarkMode && styles.retryTextDark]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

function buildSummary(entries: WeightEntry[]): WeightSummary {
  const currentEntry = entries[0];
  if (currentEntry === undefined) {
    return {
      currentLabel: '--',
      dateLabel: 'No weigh-ins yet. Onboarding weight stays separate in v1.',
      totalChangeLabel: null,
      weeklyRateLabel: null,
    };
  }

  const firstEntry = entries[entries.length - 1];
  if (firstEntry === undefined || entries.length === 1) {
    return {
      currentLabel: `${formatWeight(currentEntry.weight_kg)} kg`,
      dateLabel: formatDate(currentEntry.date),
      totalChangeLabel: null,
      weeklyRateLabel: null,
    };
  }

  const totalChange = currentEntry.weight_kg - firstEntry.weight_kg;
  const spanDays = getDateSpanDays(firstEntry.date, currentEntry.date);
  return {
    currentLabel: `${formatWeight(currentEntry.weight_kg)} kg`,
    dateLabel: formatDate(currentEntry.date),
    totalChangeLabel: `${formatSignedWeight(totalChange)} since ${formatDate(firstEntry.date)}`,
    weeklyRateLabel: spanDays >= 7
      ? `${formatSignedWeight((totalChange / spanDays) * 7)} per week`
      : null,
  };
}

function getUnavailableSummary(): WeightSummary {
  return {
    currentLabel: '--',
    dateLabel: 'Weight data unavailable',
    totalChangeLabel: null,
    weeklyRateLabel: null,
  };
}

function getDateSpanDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function sortEntriesNewestFirst(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((first, second) => {
    if (first.date !== second.date) return second.date.localeCompare(first.date);
    return second.timestamp.localeCompare(first.timestamp);
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#555555',
  },
  subtitleDark: {
    color: '#BBBBBB',
  },
  logButton: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  logButtonDark: {
    backgroundColor: '#FFFFFF',
  },
  logButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logButtonTextDark: {
    color: '#111111',
  },
  summary: {
    marginTop: 24,
    padding: 20,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  summaryDark: {
    backgroundColor: '#1C1C1E',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  labelDark: {
    color: '#A0A0A0',
  },
  weight: {
    marginTop: 8,
    fontSize: 42,
    fontWeight: '700',
    color: '#111111',
  },
  weightDark: {
    color: '#FFFFFF',
  },
  date: {
    marginTop: 4,
    fontSize: 15,
    color: '#555555',
  },
  dateDark: {
    color: '#BBBBBB',
  },
  metric: {
    marginTop: 12,
    fontSize: 15,
    color: '#555555',
  },
  metricDark: {
    color: '#BBBBBB',
  },
  loader: {
    marginTop: 32,
  },
  stateBlock: {
    marginTop: 24,
  },
  notice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#E8F0FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  noticeDark: {
    backgroundColor: '#1C2B3A',
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#1D1D1F',
  },
  noticeTextDark: {
    color: '#F2F2F7',
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  undoButtonDark: {
    backgroundColor: '#FFFFFF',
  },
  undoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  undoTextDark: {
    color: '#111111',
  },
  error: {
    fontSize: 15,
    color: '#D70015',
  },
  errorDark: {
    color: '#FF6961',
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  retryButtonDark: {
    backgroundColor: '#FFFFFF',
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  retryTextDark: {
    color: '#111111',
  },
  historyTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  historyTitleDark: {
    color: '#FFFFFF',
  },
});
