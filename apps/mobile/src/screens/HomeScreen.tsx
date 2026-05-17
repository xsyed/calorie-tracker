import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import DailySummary from '../components/DailySummary';
import EditFoodEntryPrompt from '../components/EditFoodEntryPrompt';
import EntryActionsPrompt from '../components/EntryActionsPrompt';
import EntryList from '../components/EntryList';
import type { EntryListFoodEntry, EntryListExerciseEntry } from '../components/EntryList';
import HistorySavedMealsOverlay from '../components/HistorySavedMealsOverlay';
import HomeDateCalendar from '../components/HomeDateCalendar';
import HomeWeightSummary from '../components/HomeWeightSummary';
import InputBar from '../components/InputBar';
import type { InputBarHandle } from '../components/InputBar';
import SaveMealPrompt from '../components/SaveMealPrompt';
import WaterQuickAdd, { DEFAULT_WATER_GOAL, QUICK_ADD_AMOUNT_ML } from '../components/WaterQuickAdd';
import {
  decrementDailyWaterTotal,
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
  getWeightEntries,
  getExerciseEntriesByDate,
  getDailyExerciseCalories,
  saveFoodEntryAsSavedMeal,
  deleteFoodEntryWithSnapshot,
  restoreDeletedFoodEntry,
} from '../database';
import type { DeletedFoodEntrySnapshot, WeightEntry } from '../database';
import type { RootStackParamList } from '../navigation/types';
import { editFoodEntryWithPrompt, isQueueFlushing, parseFoodText } from '../services';
import type { EditFoodEntryProgressStep, ParseErrorCode } from '../services';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type HomeRoute = RouteProp<RootStackParamList, 'Home'>;

const DELETE_UNDO_MS = 6000;
const INPUT_BAR_HEIGHT = 57;
const KEYBOARD_TOP_CLEARANCE = 44;

interface HomeDailyTotals {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

interface HomeWeightValues {
  currentWeightKg: number | null;
  previousWeightKg: number | null;
}

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

function getEditProgressLabel(step: EditFoodEntryProgressStep): string {
  switch (step) {
    case 'checking_connectivity':
      return 'Checking connection...';
    case 'parsing':
      return 'Re-submitting to LLM...';
    case 'replacing':
      return 'Replacing entry...';
  }
}

function getEntryTotals(entry: EntryListFoodEntry): HomeDailyTotals {
  return entry.items.reduce(
    (totals, item) => ({
      totalCalories: totals.totalCalories + item.calories,
      totalProtein: totals.totalProtein + item.proteinG,
      totalCarbs: totals.totalCarbs + item.carbsG,
      totalFat: totals.totalFat + item.fatG,
    }),
    {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    },
  );
}

function subtractEntryTotals(
  totals: HomeDailyTotals,
  entry: EntryListFoodEntry,
): HomeDailyTotals {
  const entryTotals = getEntryTotals(entry);
  return {
    totalCalories: totals.totalCalories - entryTotals.totalCalories,
    totalProtein: totals.totalProtein - entryTotals.totalProtein,
    totalCarbs: totals.totalCarbs - entryTotals.totalCarbs,
    totalFat: totals.totalFat - entryTotals.totalFat,
  };
}

function addEntryTotals(
  totals: HomeDailyTotals,
  entry: EntryListFoodEntry,
): HomeDailyTotals {
  const entryTotals = getEntryTotals(entry);
  return {
    totalCalories: totals.totalCalories + entryTotals.totalCalories,
    totalProtein: totals.totalProtein + entryTotals.totalProtein,
    totalCarbs: totals.totalCarbs + entryTotals.totalCarbs,
    totalFat: totals.totalFat + entryTotals.totalFat,
  };
}

function mapDeletedSnapshotToFoodEntry(
  snapshot: DeletedFoodEntrySnapshot,
): EntryListFoodEntry {
  return {
    id: snapshot.entry.id,
    rawText: snapshot.entry.raw_text,
    status: snapshot.entry.status,
    createdAt: snapshot.entry.created_at,
    items: snapshot.items.map((item) => ({
      id: item.id,
      name: item.name,
      calories: item.calories,
      proteinG: item.protein_g,
      carbsG: item.carbs_g,
      fatG: item.fat_g,
    })),
  };
}

function mapDeletedSnapshotToExerciseEntries(
  snapshot: DeletedFoodEntrySnapshot,
): EntryListExerciseEntry[] {
  return snapshot.exerciseEntries.map((entry) => ({
    id: entry.id,
    foodEntryId: entry.food_entry_id,
    type: entry.exercise_type,
    durationMinutes: entry.duration_minutes,
    caloriesBurned: entry.calories_burned,
    timestamp: entry.timestamp,
  }));
}

function buildHomeWeightValues(
  entries: WeightEntry[],
  baselineWeightKg: number | null,
): HomeWeightValues {
  return {
    currentWeightKg: entries[0]?.weight_kg ?? baselineWeightKg,
    previousWeightKg: entries[1]?.weight_kg ?? (entries.length > 0 ? baselineWeightKg : null),
  };
}

export default function HomeScreen() {
  const auth = useAuth();
  const navigation = useNavigation<HomeNavigation>();
  const route = useRoute<HomeRoute>();
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const firebaseUidRef = useRef<string | null>(null);
  const [userReadyVersion, setUserReadyVersion] = useState(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputBarRef = useRef<InputBarHandle>(null);
  const handledFocusRequestIdRef = useRef<string | null>(null);
  const deleteUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [weightValues, setWeightValues] = useState<HomeWeightValues>({
    currentWeightKg: null,
    previousWeightKg: null,
  });
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
  const [pendingDeletedEntry, setPendingDeletedEntry] =
    useState<DeletedFoodEntrySnapshot | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [isEntryQueueActive, setIsEntryQueueActive] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editProgressLabel, setEditProgressLabel] = useState<string | null>(null);
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  useEffect(() => {
    if (auth.user) {
      firebaseUidRef.current = auth.user.uid;
      getUser(auth.user.uid).then((user) => {
        if (user) {
          userIdRef.current = user.id;
          setUserReadyVersion((version) => version + 1);
        }
      });
    } else {
      firebaseUidRef.current = null;
      userIdRef.current = null;
      setUserReadyVersion((version) => version + 1);
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

  useEffect(() => () => {
    if (deleteUndoTimerRef.current !== null) {
      clearTimeout(deleteUndoTimerRef.current);
    }
  }, []);

  const resetKeyboardBottomInset = useCallback(() => {
    setKeyboardBottomInset(0);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardBottomInset(Math.max(0, event.endCoordinates.height - insets.bottom));
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', resetKeyboardBottomInset);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom, resetKeyboardBottomInset]);

  const loadDataForDate = useCallback(async (date: string) => {
    const uid = userIdRef.current;
    const firebaseUid = firebaseUidRef.current;
    if (uid === null || firebaseUid === null) return;

    setDataLoading(true);
    setDataError(null);

    try {
      const [user, foodEntriesResult, exerciseEntriesResult, exerciseCals, waterTotal, dailyWaterGoal, weightEntries] =
        await Promise.all([
          getUser(firebaseUid),
          getFoodEntriesByDate(uid, date),
          getExerciseEntriesByDate(uid, date),
          getDailyExerciseCalories(uid, date),
          getDailyWaterTotal(uid, date),
          getDailyWaterGoal(),
          getWeightEntries(uid),
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
      setWeightValues(buildHomeWeightValues(weightEntries, user?.current_weight_kg ?? null));

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
          foodEntryId: entry.food_entry_id,
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

      const monthRange = getMonthRange(date);
      const monthDates = await getLoggedDatesInRange(uid, monthRange.startDate, monthRange.endDate);
      setLoggedDates(new Set(monthDates));
    } catch {
      setDataError('Something went wrong. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, userReadyVersion]);

  useFocusEffect(
    useCallback(() => {
      resetKeyboardBottomInset();
      const uid = userIdRef.current;
      if (uid === null) return;
      loadDataForDate(selectedDateRef.current);
    }, [loadDataForDate, resetKeyboardBottomInset])
  );

  useFocusEffect(
    useCallback(() => {
      const requestId = route.params?.focusLogInputRequestId;
      if (requestId === undefined || handledFocusRequestIdRef.current === requestId) return;

      handledFocusRequestIdRef.current = requestId;
      requestAnimationFrame(() => {
        inputBarRef.current?.focus();
      });
    }, [route.params?.focusLogInputRequestId]),
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

  const handleRemoveWater = useCallback(async () => {
    const uid = userIdRef.current;
    if (uid === null || dailyWaterTotal <= 0) return;

    setAddingWaterAmount(-QUICK_ADD_AMOUNT_ML);
    setError(null);
    try {
      await decrementDailyWaterTotal(uid, selectedDate, QUICK_ADD_AMOUNT_ML);
      const total = await getDailyWaterTotal(uid, selectedDate);
      setDailyWaterTotal(total);
    } catch {
      setError('Failed to update water. Try again.');
      throw new Error('Failed to update water');
    } finally {
      setAddingWaterAmount(null);
    }
  }, [dailyWaterTotal, selectedDate]);

  const handleOpenWater = useCallback(() => {
    navigation.navigate('Water', { date: selectedDate });
  }, [navigation, selectedDate]);

  const onDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleVisibleMonthChange = useCallback(async (date: string) => {
    const uid = userIdRef.current;
    if (uid === null) return;

    try {
      const monthRange = getMonthRange(date);
      const dates = await getLoggedDatesInRange(uid, monthRange.startDate, monthRange.endDate);
      setLoggedDates((prev) => new Set([...prev, ...dates]));
    } catch {
      // Month dots are secondary; the main date data loader owns visible errors.
    }
  }, []);

  const handleWeightPress = useCallback(() => {
    navigation.navigate('Weight');
  }, [navigation]);

  const handleSettingsPress = useCallback(() => {
    Keyboard.dismiss();
    resetKeyboardBottomInset();
    navigation.navigate('Settings');
  }, [navigation, resetKeyboardBottomInset]);

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

  const handleOpenEntryActions = useCallback((entryId: string) => {
    setActionEntryId(entryId);
    setIsEntryQueueActive(isQueueFlushing());
    setEditError(null);
  }, []);

  const handleCloseEntryActions = useCallback(() => {
    setActionEntryId(null);
  }, []);

  const handleOpenEditPrompt = useCallback(() => {
    if (isEditingEntry || actionEntryId === null) return;

    const entry = foodEntries.find((currentEntry) => currentEntry.id === actionEntryId);
    if (entry === undefined || entry.status !== 'complete' || isQueueFlushing()) {
      setIsEntryQueueActive(isQueueFlushing());
      return;
    }

    setActionEntryId(null);
    setEditEntryId(entry.id);
    setEditPrompt(entry.rawText);
    setEditError(null);
    setEditProgressLabel(null);
  }, [actionEntryId, foodEntries, isEditingEntry]);

  const handleCancelEditPrompt = useCallback(() => {
    if (isEditingEntry) return;

    setEditEntryId(null);
    setEditPrompt('');
    setEditError(null);
    setEditProgressLabel(null);
  }, [isEditingEntry]);

  const handleChangeEditPrompt = useCallback((prompt: string) => {
    setEditPrompt(prompt);
    setEditError(null);
  }, []);

  const handleSubmitEditPrompt = useCallback(async () => {
    const userId = userIdRef.current;
    const prompt = editPrompt.trim();
    if (editEntryId === null || userId === null || prompt.length === 0 || isEditingEntry) return;

    setIsEditingEntry(true);
    setEditError(null);
    setEditProgressLabel('Starting edit...');

    try {
      const result = await editFoodEntryWithPrompt({
        userId,
        foodEntryId: editEntryId,
        rawPrompt: prompt,
        options: {
          onProgress: (progress) => {
            setEditProgressLabel(getEditProgressLabel(progress.step));
          },
        },
      });

      if (result.status === 'error') {
        setEditError(result.message);
        return;
      }

      setEditEntryId(null);
      setEditPrompt('');
      setEditError(null);
      setEditProgressLabel(null);
      loadDataForDate(selectedDateRef.current);
    } catch {
      setEditError('Food entry edit failed.');
    } finally {
      setIsEditingEntry(false);
    }
  }, [editEntryId, editPrompt, isEditingEntry, loadDataForDate]);

  const handleOpenSaveMealPrompt = useCallback((entryId: string) => {
    setActionEntryId(null);
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

  const clearDeleteUndo = useCallback(() => {
    if (deleteUndoTimerRef.current !== null) {
      clearTimeout(deleteUndoTimerRef.current);
      deleteUndoTimerRef.current = null;
    }
    setPendingDeletedEntry(null);
    setDeleteNotice(null);
  }, []);

  const restoreDeletedEntryInState = useCallback((
    entry: EntryListFoodEntry,
    linkedExercises: EntryListExerciseEntry[],
  ) => {
    setFoodEntries((currentEntries) => {
      if (currentEntries.some((currentEntry) => currentEntry.id === entry.id)) {
        return currentEntries;
      }
      return [...currentEntries, entry].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
    setExerciseEntries((currentEntries) => {
      const currentIds = new Set(currentEntries.map((currentEntry) => currentEntry.id));
      return [
        ...currentEntries,
        ...linkedExercises.filter((exercise) => !currentIds.has(exercise.id)),
      ];
    });
    setDailyTotals((currentTotals) => addEntryTotals(currentTotals, entry));
    setExerciseCalories((currentCalories) => (
      currentCalories + linkedExercises.reduce((total, exercise) => total + exercise.caloriesBurned, 0)
    ));
  }, []);

  const removeDeletedEntryFromState = useCallback((
    entry: EntryListFoodEntry,
    linkedExercises: EntryListExerciseEntry[],
  ) => {
    setFoodEntries((currentEntries) => currentEntries.filter((currentEntry) => currentEntry.id !== entry.id));
    setExerciseEntries((currentEntries) => (
      currentEntries.filter((currentEntry) => currentEntry.foodEntryId !== entry.id)
    ));
    setDailyTotals((currentTotals) => subtractEntryTotals(currentTotals, entry));
    setExerciseCalories((currentCalories) => (
      currentCalories - linkedExercises.reduce((total, exercise) => total + exercise.caloriesBurned, 0)
    ));
  }, []);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    const userId = userIdRef.current;
    const entry = foodEntries.find((currentEntry) => currentEntry.id === entryId);
    if (userId === null || entry === undefined || entry.status !== 'complete') return;

    const linkedExercises = exerciseEntries.filter((exercise) => exercise.foodEntryId === entryId);
    clearDeleteUndo();
    setError(null);
    setSaveMealEntryId((currentEntryId) => (currentEntryId === entryId ? null : currentEntryId));
    setActionEntryId((currentEntryId) => (currentEntryId === entryId ? null : currentEntryId));
    setEditEntryId((currentEntryId) => (currentEntryId === entryId ? null : currentEntryId));
    setEditError(null);
    removeDeletedEntryFromState(entry, linkedExercises);

    try {
      const snapshot = await deleteFoodEntryWithSnapshot(userId, entryId);
      setPendingDeletedEntry(snapshot);
      setDeleteNotice('Entry deleted.');
      deleteUndoTimerRef.current = setTimeout(() => {
        deleteUndoTimerRef.current = null;
        setPendingDeletedEntry(null);
        setDeleteNotice(null);
      }, DELETE_UNDO_MS);
    } catch {
      restoreDeletedEntryInState(entry, linkedExercises);
      setError('Failed to delete entry. Try again.');
    }
  }, [
    clearDeleteUndo,
    exerciseEntries,
    foodEntries,
    removeDeletedEntryFromState,
    restoreDeletedEntryInState,
  ]);

  const handleUndoDelete = useCallback(async () => {
    const snapshot = pendingDeletedEntry;
    if (snapshot === null) return;

    clearDeleteUndo();
    try {
      await restoreDeletedFoodEntry(snapshot);
      if (selectedDateRef.current === snapshot.entry.date) {
        restoreDeletedEntryInState(
          mapDeletedSnapshotToFoodEntry(snapshot),
          mapDeletedSnapshotToExerciseEntries(snapshot),
        );
      }
    } catch {
      setError('Failed to restore entry. Try again.');
      loadDataForDate(selectedDateRef.current);
    }
  }, [clearDeleteUndo, loadDataForDate, pendingDeletedEntry, restoreDeletedEntryInState]);

  const actionEntry = useMemo(
    () => foodEntries.find((entry) => entry.id === actionEntryId) ?? null,
    [actionEntryId, foodEntries],
  );

  const actionEntryExercises = useMemo(
    () => {
      if (actionEntryId === null) return [];
      return exerciseEntries.filter((entry) => entry.foodEntryId === actionEntryId);
    },
    [actionEntryId, exerciseEntries],
  );

  const editEntry = useMemo(
    () => foodEntries.find((entry) => entry.id === editEntryId) ?? null,
    [editEntryId, foodEntries],
  );

  const hasEntries = useMemo(
    () => foodEntries.length > 0 || exerciseEntries.length > 0,
    [foodEntries.length, exerciseEntries.length],
  );

  const dateLabel = useMemo(() => {
    if (selectedDate === getTodayDate()) return 'Today';
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [selectedDate]);
  const inputBarBottom = keyboardBottomInset > 0
    ? keyboardBottomInset + KEYBOARD_TOP_CLEARANCE
    : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top,
            paddingBottom: INPUT_BAR_HEIGHT + insets.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <HomeDateCalendar
              selectedDate={selectedDate}
              loggedDates={loggedDates}
              onDateSelect={onDateSelect}
              onVisibleMonthChange={handleVisibleMonthChange}
            />
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleSettingsPress}
                style={[styles.headerIconButton, isDarkMode && styles.headerIconButtonDark]}
              >
                <View style={styles.settingsGlyph}>
                  <View style={[styles.settingsGlyphLine, isDarkMode && styles.glyphFillDark]} />
                  <View style={[styles.settingsGlyphLine, isDarkMode && styles.glyphFillDark]} />
                  <View style={[styles.settingsGlyphLine, isDarkMode && styles.glyphFillDark]} />
                </View>
              </Pressable>
            </View>
          </View>
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
          <View style={styles.mainContent}>
            <View style={styles.fixedSummary}>
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
              <View style={styles.trackerGrid}>
                <WaterQuickAdd
                  dailyTotal={dailyWaterTotal}
                  waterGoal={waterGoal}
                  onAddWater={handleAddWater}
                  onRemoveWater={handleRemoveWater}
                  addingAmountMl={addingWaterAmount}
                  onOpenWater={handleOpenWater}
                />
                <HomeWeightSummary
                  currentWeightKg={weightValues.currentWeightKg}
                  previousWeightKg={weightValues.previousWeightKg}
                  onLogWeight={handleWeightPress}
                />
              </View>
            </View>
            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
              <EntryList
                foodEntries={foodEntries}
                exerciseEntries={exerciseEntries}
                onOpenEntryActions={handleOpenEntryActions}
              />
            </ScrollView>
          </View>
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

      {deleteNotice !== null && (
        <View style={[styles.deleteNotice, isDarkMode && styles.deleteNoticeDark]}>
          <Text style={[styles.deleteNoticeText, isDarkMode && styles.deleteNoticeTextDark]}>
            {deleteNotice}
          </Text>
          {pendingDeletedEntry !== null && (
            <Pressable onPress={handleUndoDelete} style={styles.undoButton}>
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}

      <View
        style={[
          styles.inputBarWrapper,
          isDarkMode && styles.inputBarWrapperDark,
          {
            paddingBottom: insets.bottom,
            bottom: inputBarBottom,
          },
        ]}
      >
        <InputBar
          ref={inputBarRef}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onBlur={resetKeyboardBottomInset}
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
      {actionEntry !== null && (
        <EntryActionsPrompt
          entry={actionEntry}
          linkedExercises={actionEntryExercises}
          isDark={isDarkMode}
          isQueueActive={isEntryQueueActive}
          onClose={handleCloseEntryActions}
          onEdit={handleOpenEditPrompt}
          onSaveAsMeal={() => handleOpenSaveMealPrompt(actionEntry.id)}
          onDelete={() => handleDeleteEntry(actionEntry.id)}
        />
      )}
      {editEntry !== null && (
        <EditFoodEntryPrompt
          isDark={isDarkMode}
          prompt={editPrompt}
          originalPrompt={editEntry.rawText}
          error={editError}
          progressLabel={editProgressLabel}
          isSaving={isEditingEntry}
          onChangePrompt={handleChangeEditPrompt}
          onCancel={handleCancelEditPrompt}
          onSubmit={handleSubmitEditPrompt}
        />
      )}
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
    paddingTop: 4,
    zIndex: 10,
    elevation: 10,
  },
  headerRow: {
    position: 'relative',
  },
  headerActions: {
    position: 'absolute',
    top: 0,
    right: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 50,
    elevation: 50,
  },
  headerIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  headerIconButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  glyphFillDark: {
    backgroundColor: '#FFFFFF',
  },
  settingsGlyph: {
    width: 15,
    height: 15,
    justifyContent: 'space-evenly',
  },
  settingsGlyphLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#000000',
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
  mainContent: {
    flex: 1,
  },
  fixedSummary: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  trackerGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
  deleteNotice: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteNoticeDark: {
    backgroundColor: '#1C1C1E',
    borderTopColor: '#333333',
  },
  deleteNoticeText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  deleteNoticeTextDark: {
    color: '#F5F5F5',
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  undoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inputBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
  inputBarWrapperDark: {
    backgroundColor: '#1C1C1E',
  },
});
