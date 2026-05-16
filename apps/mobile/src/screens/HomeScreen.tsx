import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import DailySummary from '../components/DailySummary';
import DateStrip from '../components/DateStrip';
import EntryList from '../components/EntryList';
import type { EntryListFoodEntry, EntryListExerciseEntry } from '../components/EntryList';
import HistorySavedMealsOverlay from '../components/HistorySavedMealsOverlay';
import InputBar from '../components/InputBar';
import type { InputBarHandle } from '../components/InputBar';
import MonthDropdown from '../components/MonthDropdown';
import SaveMealPrompt from '../components/SaveMealPrompt';
import WaterQuickAdd, { DEFAULT_WATER_GOAL } from '../components/WaterQuickAdd';
import {
  getUser,
  saveParsedLogEntry,
  insertFoodEntry,
  getSetting,
  getFoodEntriesByDate,
  getFoodItemsByEntryId,
  getDailyCalorieTotals,
  getLoggedDatesInRange,
  getDailyWaterTotal,
  getDailyWaterGoal,
  insertWaterEntry,
  getExerciseEntriesByDate,
  getDailyExerciseCalories,
  saveFoodEntryAsSavedMeal,
} from '../database';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { parseFoodText } from '../services';
import type { ParseErrorCode } from '../services';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateStripRange(date: string): { startDate: string; endDate: string } {
  const end = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end > today) {
    end.setTime(today.getTime());
  }
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return {
    startDate: formatYYYYMMDD(start),
    endDate: formatYYYYMMDD(end),
  };
}

function getMonthRange(date: string): { startDate: string; endDate: string } {
  const selected = new Date(date + 'T00:00:00');
  const year = selected.getFullYear();
  const month = selected.getMonth();
  return {
    startDate: formatYYYYMMDD(new Date(year, month, 1)),
    endDate: formatYYYYMMDD(new Date(year, month + 1, 0)),
  };
}

function mapErrorToUserMessage(code: ParseErrorCode): string {
  switch (code) {
    case 'no_network':
      return 'No internet. Your entry will be saved offline.';
    case 'token_refresh_failed':
      return 'Session expired. Please sign in again.';
    case 'rate_limit_exceeded':
      return 'Daily limit reached. Try again tomorrow.';
    case 'invalid_token':
      return 'Session expired. Please sign in again.';
    case 'parse_failed':
      return "Couldn't understand that. Try rephrasing.";
    case 'llm_timeout':
      return 'Request timed out. Tap to retry.';
    case 'llm_error':
      return 'Something went wrong. Tap to retry.';
    case 'empty_result':
      return 'Nothing recognized. Try describing what you ate or did.';
    case 'server_error':
      return 'Service unavailable. Tap to retry.';
    case 'network_error':
      return 'Connection failed. Tap to retry.';
  }
}

export default function HomeScreen() {
  const auth = useAuth();
  const navigation = useNavigation<HomeNavigation>();
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputBarRef = useRef<InputBarHandle>(null);

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const [userTargets, setUserTargets] = useState<{
    dailyCalories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  } | null>(null);
  const [dailyTotals, setDailyTotals] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });
  const [foodEntries, setFoodEntries] = useState<EntryListFoodEntry[]>([]);
  const [exerciseEntries, setExerciseEntries] = useState<EntryListExerciseEntry[]>([]);
  const [dailyWaterTotal, setDailyWaterTotal] = useState(0);
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL);
  const [exerciseCalories, setExerciseCalories] = useState(0);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [addingWaterAmount, setAddingWaterAmount] = useState<number | null>(null);
  const [isHistoryOverlayVisible, setHistoryOverlayVisible] = useState(false);
  const [saveMealEntryId, setSaveMealEntryId] = useState<string | null>(null);
  const [saveMealName, setSaveMealName] = useState('');
  const [saveMealError, setSaveMealError] = useState<string | null>(null);
  const [isSavingMeal, setIsSavingMeal] = useState(false);

  useEffect(() => {
    if (auth.user) {
      getUser(auth.user.uid).then((user) => {
        if (user) userIdRef.current = user.id;
      });
    }
  }, [auth.user?.uid]);

  useEffect(() => {
    if (error !== null) {
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
    }
    return () => {
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
    };
  }, [error]);

  const loadDataForDate = useCallback(async (date: string) => {
    const uid = userIdRef.current;
    if (uid === null) return;

    setDataLoading(true);
    setDataError(null);

    try {
      const [user, foodEntriesResult, exerciseEntriesResult, exerciseCals, waterTotal, dailyWaterGoal] =
        await Promise.all([
          getUser(uid),
          getFoodEntriesByDate(uid, date),
          getExerciseEntriesByDate(uid, date),
          getDailyExerciseCalories(uid, date),
          getDailyWaterTotal(uid, date),
          getDailyWaterGoal(),
        ]);

      setUserTargets({
        dailyCalories: user?.daily_target_calories ?? null,
        proteinG: user?.protein_g ?? null,
        carbsG: user?.carbs_g ?? null,
        fatG: user?.fat_g ?? null,
      });

      setExerciseCalories(exerciseCals);
      setDailyWaterTotal(waterTotal);
      setWaterGoal(dailyWaterGoal);

      const entriesWithItems: EntryListFoodEntry[] = [];
      for (const entry of foodEntriesResult) {
        const items = await getFoodItemsByEntryId(entry.id);
        entriesWithItems.push({
          id: entry.id,
          rawText: entry.raw_text,
          status: entry.status,
          createdAt: entry.created_at,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            calories: item.calories,
            proteinG: item.protein_g,
            carbsG: item.carbs_g,
            fatG: item.fat_g,
          })),
        });
      }
      setFoodEntries(entriesWithItems);

      setExerciseEntries(
        exerciseEntriesResult.map((entry) => ({
          id: entry.id,
          type: entry.exercise_type,
          durationMinutes: entry.duration_minutes,
          caloriesBurned: entry.calories_burned,
          timestamp: entry.timestamp,
        })),
      );

      const totals = await getDailyCalorieTotals(uid, date);
      setDailyTotals({
        totalCalories: totals.total_calories,
        totalProtein: totals.total_protein,
        totalCarbs: totals.total_carbs,
        totalFat: totals.total_fat,
      });

      const stripRange = getDateStripRange(date);
      const monthRange = getMonthRange(date);
      const [stripDates, monthDates] = await Promise.all([
        getLoggedDatesInRange(uid, stripRange.startDate, stripRange.endDate),
        getLoggedDatesInRange(uid, monthRange.startDate, monthRange.endDate),
      ]);
      setLoggedDates(new Set([...stripDates, ...monthDates]));
    } catch {
      setDataError('Something went wrong. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userIdRef.current !== null) {
      loadDataForDate(getTodayDate());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDataForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      const uid = userIdRef.current;
      if (uid === null) return;
      loadDataForDate(selectedDateRef.current);
    }, [loadDataForDate])
  );

  const handleSubmit = useCallback(
    async (text: string): Promise<void> => {
      if (text.trim().length === 0) return;

      setSubmitting(true);
      setError(null);

      const resetAt = await getSetting('rate_limit_reset_at');
      if (resetAt && new Date(resetAt) > new Date()) {
        const userId = userIdRef.current;
        if (userId !== null) {
          try {
            await insertFoodEntry({
              user_id: userId,
              date: selectedDateRef.current,
              raw_text: text,
              status: 'pending',
              retry_count: 0,
              created_at: new Date().toISOString(),
            });
          } catch {
            setError('Failed to save entry. Tap to retry.');
            setSubmitting(false);
            return;
          }
        }
        setError('Daily limit reached. Entry saved — will process when limit resets.');
        setSubmitting(false);
        return;
      }

      const result = await parseFoodText(text);

      if (result.outcome === 'success') {
        const userId = userIdRef.current;
        if (userId === null) {
          setError('User not found');
          setSubmitting(false);
          throw new Error('User not found');
        }

        try {
          await saveParsedLogEntry({
            userId,
            date: selectedDateRef.current,
            rawText: text,
            foods: result.foods,
            exercises: result.exercises.map((e) => ({
              exercise_type: e.type,
              duration_minutes: e.duration_minutes,
              calories_burned: e.calories_burned,
            })),
          });
        } catch {
          setError('Failed to save entry. Tap to retry.');
          setSubmitting(false);
          throw new Error('DB save failed');
        }

        setSubmitting(false);
        loadDataForDate(selectedDateRef.current);
      } else {
        if (result.error === 'no_network') {
          const userId = userIdRef.current;
          if (userId !== null) {
            try {
              await insertFoodEntry({
                user_id: userId,
                date: selectedDateRef.current,
                raw_text: text,
                status: 'pending',
                retry_count: 0,
                created_at: new Date().toISOString(),
              });
              inputBarRef.current?.setText('');
            } catch {
              // silently ignore pending save failure
            }
          }
        }

        const message = mapErrorToUserMessage(result.error);
        setError(message);
        setSubmitting(false);
        throw new Error(message);
      }
    },
    [loadDataForDate],
  );

  const handleChangeText = useCallback(() => {
    setError(null);
  }, []);

  const handleAddWater = useCallback(async (amountMl: number) => {
    const uid = userIdRef.current;
    if (uid === null) return;
    setAddingWaterAmount(amountMl);
    setError(null);
    try {
      await insertWaterEntry({
        user_id: uid,
        date: selectedDate,
        amount_ml: amountMl,
        timestamp: new Date().toISOString(),
      });
      const total = await getDailyWaterTotal(uid, selectedDate);
      setDailyWaterTotal(total);
    } catch {
      setError('Failed to log water. Try again.');
      throw new Error('Failed to log water');
    } finally {
      setAddingWaterAmount(null);
    }
  }, [selectedDate]);

  const handleOpenWater = useCallback(() => {
    navigation.navigate('Water', { date: selectedDate });
  }, [navigation, selectedDate]);

  const onDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleVisibleRangeChange = useCallback(async (startDate: string, endDate: string) => {
    const uid = userIdRef.current;
    if (uid === null) return;

    try {
      const dates = await getLoggedDatesInRange(uid, startDate, endDate);
      setLoggedDates((prev) => new Set([...prev, ...dates]));
    } catch {
      // Month dots are secondary; the main date data loader owns visible errors.
    }
  }, []);

  const handleSettingsPress = useCallback(() => {
    // Wired in Task 6.9
  }, []);

  const handleBookmarkPress = useCallback(() => {
    setHistoryOverlayVisible(true);
  }, []);

  const handleHistoryOverlayDismiss = useCallback(() => {
    setHistoryOverlayVisible(false);
  }, []);

  const handleHistoryOverlayApplied = useCallback(() => {
    setHistoryOverlayVisible(false);
    loadDataForDate(selectedDateRef.current);
  }, [loadDataForDate]);

  const handleOpenSaveMealPrompt = useCallback((entryId: string) => {
    setSaveMealEntryId(entryId);
    setSaveMealName('');
    setSaveMealError(null);
  }, []);

  const handleCancelSaveMealPrompt = useCallback(() => {
    if (isSavingMeal) return;

    setSaveMealEntryId(null);
    setSaveMealName('');
    setSaveMealError(null);
  }, [isSavingMeal]);

  const handleChangeSaveMealName = useCallback((name: string) => {
    setSaveMealName(name);
    setSaveMealError(null);
  }, []);

  const handleCreateSavedMeal = useCallback(async () => {
    const userId = userIdRef.current;
    const name = saveMealName.trim();
    if (saveMealEntryId === null || name.length === 0) return;

    if (userId === null) {
      setSaveMealError('User not found.');
      return;
    }

    setIsSavingMeal(true);
    setSaveMealError(null);
    try {
      await saveFoodEntryAsSavedMeal({
        userId,
        foodEntryId: saveMealEntryId,
        name,
      });
      setSaveMealEntryId(null);
      setSaveMealName('');
    } catch {
      setSaveMealError('Could not save meal.');
    } finally {
      setIsSavingMeal(false);
    }
  }, [saveMealEntryId, saveMealName]);

  const hasEntries = useMemo(
    () => foodEntries.length > 0 || exerciseEntries.length > 0,
    [foodEntries.length, exerciseEntries.length],
  );

  const dateLabel = useMemo(() => {
    if (selectedDate === getTodayDate()) return 'Today';
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [selectedDate]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <MonthDropdown
              selectedDate={selectedDate}
              loggedDates={loggedDates}
              onDateSelect={onDateSelect}
              onVisibleRangeChange={handleVisibleRangeChange}
            />
            <Pressable onPress={handleSettingsPress} hitSlop={8}>
              <View style={[styles.gearIcon, isDarkMode && styles.gearIconDark]}>
                <Text style={[styles.gearIconText, isDarkMode && styles.gearIconTextDark]}>⚙</Text>
              </View>
            </Pressable>
          </View>
          <DateStrip
            selectedDate={selectedDate}
            loggedDates={loggedDates}
            onDateSelect={onDateSelect}
          />
        </View>

        {dataLoading ? (
          <ActivityIndicator
            size="large"
            style={styles.loader}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        ) : dataError !== null ? (
          <View style={styles.errorState}>
            <Text style={[styles.errorStateText, isDarkMode && styles.errorStateTextDark]}>
              {dataError}
            </Text>
            <Pressable onPress={() => loadDataForDate(selectedDate)} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
            <DailySummary
              totalCalories={dailyTotals.totalCalories}
              totalProtein={dailyTotals.totalProtein}
              totalCarbs={dailyTotals.totalCarbs}
              totalFat={dailyTotals.totalFat}
              targetCalories={userTargets?.dailyCalories ?? null}
              targetProtein={userTargets?.proteinG ?? null}
              targetCarbs={userTargets?.carbsG ?? null}
              targetFat={userTargets?.fatG ?? null}
              exerciseCalories={exerciseCalories}
              dateLabel={dateLabel}
              hasEntries={hasEntries}
            />
            <WaterQuickAdd
              dailyTotal={dailyWaterTotal}
              waterGoal={waterGoal}
              onAddWater={handleAddWater}
              addingAmountMl={addingWaterAmount}
              dateLabel={dateLabel}
              onOpenWater={handleOpenWater}
            />
            <EntryList
              foodEntries={foodEntries}
              exerciseEntries={exerciseEntries}
              onSaveEntryAsMeal={handleOpenSaveMealPrompt}
            />
          </ScrollView>
        )}
      </View>

      {error !== null && (
        <View style={[styles.errorBanner, isDarkMode && styles.errorBannerDark]}>
          <Text
            style={[styles.errorText, isDarkMode && styles.errorTextDark]}
          >
            {error}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.inputBarWrapper,
          isDarkMode && styles.inputBarWrapperDark,
          { paddingBottom: insets.bottom },
        ]}
      >
        <InputBar
          ref={inputBarRef}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onChangeText={handleChangeText}
          onBookmarkPress={handleBookmarkPress}
        />
      </View>
      <HistorySavedMealsOverlay
        visible={isHistoryOverlayVisible}
        userId={userIdRef.current}
        selectedDate={selectedDate}
        onDismiss={handleHistoryOverlayDismiss}
        onApplied={handleHistoryOverlayApplied}
      />
      {saveMealEntryId !== null && (
        <SaveMealPrompt
          isDark={isDarkMode}
          name={saveMealName}
          error={saveMealError}
          isSaving={isSavingMeal}
          onChangeName={handleChangeSaveMealName}
          onCancel={handleCancelSaveMealPrompt}
          onSave={handleCreateSavedMeal}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gearIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  gearIconDark: {
    backgroundColor: '#2C2C2E',
  },
  gearIconText: {
    fontSize: 20,
    color: '#000000',
  },
  gearIconTextDark: {
    color: '#FFFFFF',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorStateTextDark: {
    color: '#999999',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
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
  errorTextDark: {
    color: '#FF4444',
  },
  inputBarWrapper: {
    backgroundColor: '#FFFFFF',
  },
  inputBarWrapperDark: {
    backgroundColor: '#1C1C1E',
  },
});
