import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import {
  deleteWaterEntry,
  getDailyWaterGoal,
  getDailyWaterTotal,
  getUser,
  getWaterEntriesByDateRange,
  getWaterTotalsByDateRange,
  insertWaterEntry,
  setDailyWaterGoal,
} from '../database';
import type { RootStackParamList } from '../navigation/types';
import { WaterTrendHistory, type WaterHistoryGroup, type WaterTrendDay } from './WaterTrendHistory';
import {
  fillTrendDays,
  formatDateLabel,
  formatEntryTime,
  getCustomAmount,
  getCustomAmountError,
  getDateWindow,
  getGoalAmountError,
  groupEntriesByDate,
} from './waterScreenUtils';
import { formatWaterAmount } from '../waterFormat';

const QUICK_ADD_AMOUNTS = [100, 200, 500] as const;

type WaterScreenProps = NativeStackScreenProps<RootStackParamList, 'Water'>;

export default function WaterScreen({ navigation, route }: WaterScreenProps) {
  const auth = useAuth();
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [waterGoal, setWaterGoal] = useState(0);
  const [trend, setTrend] = useState<WaterTrendDay[]>([]);
  const [historyGroups, setHistoryGroups] = useState<WaterHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [goalAmount, setGoalAmount] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [activeAmount, setActiveAmount] = useState<number | 'custom' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const date = route.params.date;
  const progressPercent = waterGoal > 0 ? Math.min(Math.round((dailyTotal / waterGoal) * 100), 100) : 0;
  const progressWidth = waterGoal > 0 ? Math.min((dailyTotal / waterGoal) * 100, 100) : 0;
  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';

  const dateLabel = useMemo(() => formatDateLabel(date), [date]);
  const trendDates = useMemo(() => getDateWindow(date), [date]);

  const loadWaterData = useCallback(async (currentUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const startDate = trendDates[0];
      const endDate = trendDates[trendDates.length - 1];
      if (startDate === undefined || endDate === undefined) return;

      const [nextHistoryEntries, nextTotal, nextGoal, nextTrendTotals] = await Promise.all([
        getWaterEntriesByDateRange(currentUserId, startDate, endDate),
        getDailyWaterTotal(currentUserId, date),
        getDailyWaterGoal(),
        getWaterTotalsByDateRange(currentUserId, startDate, endDate),
      ]);
      setDailyTotal(nextTotal);
      setWaterGoal(nextGoal);
      setGoalAmount(String(nextGoal));
      setTrend(fillTrendDays(trendDates, nextTrendTotals));
      setHistoryGroups(groupEntriesByDate(nextHistoryEntries));
    } catch {
      setError('Failed to load water. Try again.');
    } finally {
      setLoading(false);
    }
  }, [date, trendDates]);

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
        loadWaterData(user.id);
      })
      .catch(() => {
        setError('Failed to load water. Try again.');
        setLoading(false);
      });
  }, [auth.user?.uid, loadWaterData]);

  const refreshAfterMutation = useCallback(async () => {
    if (userId !== null) {
      await loadWaterData(userId);
    }
  }, [loadWaterData, userId]);

  const handleAddAmount = useCallback(async (amountMl: number) => {
    if (userId === null) return;

    setActiveAmount(amountMl);
    setError(null);
    try {
      await insertWaterEntry({
        user_id: userId,
        date,
        amount_ml: amountMl,
        timestamp: new Date().toISOString(),
      });
      await refreshAfterMutation();
    } catch {
      setError('Failed to log water. Try again.');
    } finally {
      setActiveAmount(null);
    }
  }, [date, refreshAfterMutation, userId]);

  const handleCustomAdd = useCallback(async () => {
    if (userId === null) return;

    const amount = getCustomAmount(customAmount);
    const validationError = getCustomAmountError(amount);
    if (validationError !== null || amount === null) {
      setCustomError(validationError ?? 'Enter an amount greater than 0ml.');
      return;
    }

    setActiveAmount('custom');
    setCustomError(null);
    setError(null);
    try {
      await insertWaterEntry({
        user_id: userId,
        date,
        amount_ml: amount,
        timestamp: new Date().toISOString(),
      });
      setCustomAmount('');
      await refreshAfterMutation();
    } catch {
      setError('Failed to log water. Try again.');
    } finally {
      setActiveAmount(null);
    }
  }, [customAmount, date, refreshAfterMutation, userId]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (userId === null) return;

    setDeletingId(entryId);
    setError(null);
    try {
      await deleteWaterEntry(entryId, userId);
      await refreshAfterMutation();
    } catch {
      setError('Failed to delete entry. Try again.');
    } finally {
      setDeletingId(null);
    }
  }, [refreshAfterMutation, userId]);

  const confirmDeleteEntry = useCallback((entryId: string) => {
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteEntry(entryId) },
    ]);
  }, [handleDeleteEntry]);

  const handleCustomAmountChange = useCallback((value: string) => {
    setCustomAmount(value);
    setCustomError(null);
  }, []);

  const handleGoalAmountChange = useCallback((value: string) => {
    setGoalAmount(value);
    setGoalError(null);
  }, []);

  const handleSaveGoal = useCallback(async () => {
    const amount = getCustomAmount(goalAmount);
    const validationError = getGoalAmountError(amount);
    if (validationError !== null || amount === null) {
      setGoalError(validationError ?? 'Enter a goal greater than 0ml.');
      return;
    }

    setSavingGoal(true);
    setGoalError(null);
    setError(null);
    try {
      await setDailyWaterGoal(amount);
      setWaterGoal(amount);
      setGoalAmount(String(amount));
    } catch {
      setError('Failed to save water goal. Try again.');
    } finally {
      setSavingGoal(false);
    }
  }, [goalAmount]);

  const controlsDisabled = activeAmount !== null || deletingId !== null || savingGoal || userId === null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={navigation.goBack} hitSlop={8} style={styles.backButton}>
          <Text style={[styles.backText, { color: accentColor }]}>Back</Text>
        </Pressable>
        <View>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>Water</Text>
          <Text style={[styles.date, isDarkMode && styles.dateDark]}>{dateLabel}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} color={isDarkMode ? '#FFFFFF' : '#000000'} />
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.titleDark]}>Daily progress</Text>
            <Text style={[styles.progressText, isDarkMode && styles.titleDark]}>
              {formatWaterAmount(dailyTotal)} / {formatWaterAmount(waterGoal)} ({progressPercent}%)
            </Text>
            <View style={[styles.track, isDarkMode && styles.trackDark]}>
              <View style={[styles.bar, { width: `${progressWidth}%`, backgroundColor: accentColor }]} />
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            <View style={styles.goalHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.titleDark]}>Daily goal</Text>
              <Text style={[styles.goalValue, isDarkMode && styles.dateDark]}>
                {formatWaterAmount(waterGoal)}/day
              </Text>
            </View>
            <View style={styles.customRow}>
              <TextInput
                value={goalAmount}
                onChangeText={handleGoalAmountChange}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="Goal ml/day"
                placeholderTextColor={isDarkMode ? '#777777' : '#888888'}
                style={[styles.input, isDarkMode && styles.inputDark]}
              />
              <Pressable
                onPress={handleSaveGoal}
                disabled={controlsDisabled}
                style={[styles.addButton, { backgroundColor: accentColor }, controlsDisabled && styles.disabled]}
              >
                <Text style={styles.addButtonText}>{savingGoal ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
            {goalError !== null && <Text style={styles.inlineError}>{goalError}</Text>}
          </View>

          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.titleDark]}>Add water</Text>
            <View style={styles.buttonRow}>
              {QUICK_ADD_AMOUNTS.map((amount) => (
                <Pressable
                  key={amount}
                  onPress={() => handleAddAmount(amount)}
                  disabled={controlsDisabled}
                  style={[styles.pillButton, { borderColor: accentColor }, controlsDisabled && styles.disabled]}
                >
                  <Text style={[styles.pillButtonText, { color: accentColor }]}>
                    {activeAmount === amount ? 'Adding...' : `+${formatWaterAmount(amount)}`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.customRow}>
              <TextInput
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="Custom ml"
                placeholderTextColor={isDarkMode ? '#777777' : '#888888'}
                style={[styles.input, isDarkMode && styles.inputDark]}
              />
              <Pressable
                onPress={handleCustomAdd}
                disabled={controlsDisabled}
                style={[styles.addButton, { backgroundColor: accentColor }, controlsDisabled && styles.disabled]}
              >
                <Text style={styles.addButtonText}>{activeAmount === 'custom' ? 'Adding...' : 'Add'}</Text>
              </Pressable>
            </View>
            {customError !== null && <Text style={styles.inlineError}>{customError}</Text>}
          </View>

          <WaterTrendHistory
            accentColor={accentColor}
            goalMl={waterGoal}
            groups={historyGroups}
            isDarkMode={isDarkMode}
            deletingId={deletingId}
            onDelete={confirmDeleteEntry}
            onFormatDate={formatDateLabel}
            onFormatTime={formatEntryTime}
            trend={trend}
          />
        </ScrollView>
      )}

      {error !== null && (
        <View style={[styles.errorBanner, isDarkMode && styles.errorBannerDark]}>
          <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>{error}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: { backgroundColor: '#000000' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: { color: '#FFFFFF' },
  date: {
    marginTop: 4,
    fontSize: 16,
    color: '#666666',
  },
  dateDark: { color: '#999999' },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },
  cardDark: { backgroundColor: '#1C1C1E' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  progressText: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  trackDark: { backgroundColor: '#3A3A3C' },
  bar: {
    height: 10,
    borderRadius: 5,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  goalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pillButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  pillButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CCCCCC',
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#444444',
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  addButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inlineError: {
    marginTop: 8,
    fontSize: 13,
    color: '#CC0000',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  entryRowDark: { borderBottomColor: '#333333' },
  entryAmount: {
    fontSize: 16,
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
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF3F3',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFCCCC',
  },
  errorBannerDark: {
    backgroundColor: '#3A1A1A',
    borderTopColor: '#662222',
  },
  errorText: {
    fontSize: 14,
    color: '#CC0000',
    textAlign: 'center',
  },
  errorTextDark: { color: '#FF4444' },
});
