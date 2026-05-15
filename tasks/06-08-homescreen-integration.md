# Task 6.8: Integrate into `HomeScreen`

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on:** Task 6.1 (water table), 6.2 (aggregate queries), 6.3 (DateStrip), 6.4 (MonthDropdown), 6.5 (DailySummary), 6.6 (WaterQuickAdd), 6.7 (EntryList)
**Required by:** Task 6.9 (Settings nav)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| `HomeScreen.tsx` | Has `getTodayDate()`, `handleSubmit()`, auth integration via `useAuth()`, and `InputBar`. |
| State variables | 4 state vars + 3 refs: `isSubmitting`, `error`, `userIdRef`, `errorTimerRef`, `inputBarRef`. No date/data state. |
| Imports | Already imports from `../database`: `getUser, saveParsedLogEntry, insertFoodEntry, getSetting`. Need to add: `getFoodEntriesByDate, getFoodItemsByEntryId, getDailyCalorieTotals, getLoggedDatesInRange, getDailyWaterTotal, insertWaterEntry` and from `../database/exerciseRepository`: `getExerciseEntriesByDate, getDailyExerciseCalories` (or via index). |
| Layout | `KeyboardAvoidingView` → `View[content]` → `View[header]` + `View[summaryPlaceholder]` + `View[entryListPlaceholder]` → `View[errorBanner]` → `InputBar`. |
| Navigation | `useNavigation()` from `@react-navigation/native` NOT currently imported. Need to add for Settings gear icon (Task 6.9). |
| Screen focus | `useFocusEffect` from `@react-navigation/native` NOT currently used. Need for refreshing user targets on return from Settings. |

---

## Files to modify

- `apps/mobile/src/screens/HomeScreen.tsx` — major rewrite of content area

---

## Step 1: Add state for selectedDate and data

Add after existing state (lines 82-86):

```ts
const [selectedDate, setSelectedDate] = useState(getTodayDate());
const [userTargets, setUserTargets] = useState<{
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
} | null>(null);
const [dailyTotals, setDailyTotals] = useState<{
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}>({ totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });
const [foodEntries, setFoodEntries] = useState<EntryListFoodEntry[]>([]);
const [exerciseEntries, setExerciseEntries] = useState<EntryListExerciseEntry[]>([]);
const [dailyWaterTotal, setDailyWaterTotal] = useState(0);
const [exerciseCalories, setExerciseCalories] = useState(0);
const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
const [dataLoading, setDataLoading] = useState(true);
const [dataError, setDataError] = useState<string | null>(null);
```

Note: `EntryListFoodEntry` and `EntryListExerciseEntry` types are defined in `EntryList.tsx`. Import them:

```ts
import type { EntryListFoodEntry, EntryListExerciseEntry } from '../components/EntryList';
```

Export these types from `EntryList.tsx` (see Task 6.7).

## Step 2: Add data fetching function

```ts
const loadDataForDate = useCallback(async (date: string) => {
  const uid = userIdRef.current;
  if (uid === null) return;

  setDataLoading(true);
  setDataError(null);

  try {
    // Parallel queries where possible
    const [user, foodEntriesResult, exerciseEntriesResult, exerciseCals, waterTotal] =
      await Promise.all([
        getUser(uid),
        getFoodEntriesByDate(uid, date),
        getExerciseEntriesByDate(uid, date),
        getDailyExerciseCalories(uid, date),
        getDailyWaterTotal(uid, date),
      ]);

    // User targets
    setUserTargets({
      dailyCalories: user?.daily_target_calories ?? null,
      proteinG: user?.protein_g ?? null,
      carbsG: user?.carbs_g ?? null,
      fatG: user?.fat_g ?? null,
    });

    // Exercise calories
    setExerciseCalories(exerciseCals);

    // Water total
    setDailyWaterTotal(waterTotal);

    // Food items for each entry (sequential — one query per entry)
    const entriesWithItems: EntryListFoodEntry[] = [];
    for (const entry of foodEntriesResult) {
      const items = await getFoodItemsByEntryId(entry.id);
      entriesWithItems.push({
        id: entry.id,
        rawText: entry.raw_text,
        status: entry.status,
        createdAt: entry.created_at,
        items: items.map(item => ({
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

    // Exercise entries (map to display types)
    setExerciseEntries(
      exerciseEntriesResult.map(entry => ({
        id: entry.id,
        type: entry.exercise_type,
        durationMinutes: entry.duration_minutes,
        caloriesBurned: entry.calories_burned,
        timestamp: entry.timestamp,
      })),
    );

    // Daily totals (aggregate query — only for completed entries)
    const totals = await getDailyCalorieTotals(uid, date);
    setDailyTotals(totals);

    // Logged dates for the date strip (fetch for current visible week)
    // Week is computed from selectedDate
    const selected = new Date(date + 'T00:00:00');
    const dayOfWeek = selected.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(selected);
    monday.setDate(monday.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const startStr = formatYYYYMMDD(monday);
    const endStr = formatYYYYMMDD(sunday);
    const datesArr = await getLoggedDatesInRange(uid, startStr, endStr);
    setLoggedDates(new Set(datesArr));
  } catch (err) {
    setDataError('Something went wrong. Please try again.');
  } finally {
    setDataLoading(false);
  }
}, []);

// Helper (copy pattern from getTodayDate):
function formatYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

## Step 3: Wire up data refresh

### On mount

```ts
useEffect(() => {
  if (userIdRef.current !== null) {
    loadDataForDate(getTodayDate());
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

### On selectedDate change

```ts
useEffect(() => {
  loadDataForDate(selectedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedDate]);
```

### On screen focus (re-fetch user targets only)

```ts
import { useFocusEffect } from '@react-navigation/native';

useFocusEffect(
  useCallback(() => {
    const uid = userIdRef.current;
    if (uid === null) return;
    getUser(uid).then(user => {
      if (user) {
        setUserTargets({
          dailyCalories: user.daily_target_calories ?? null,
          proteinG: user.protein_g ?? null,
          carbsG: user.carbs_g ?? null,
          fatG: user.fat_g ?? null,
        });
      }
    }).catch(() => {}); // silently fail on focus refresh
  }, [])
);
```

### After successful submit

In `handleSubmit`, after `saveParsedLogEntry` succeeds (line 200), add:

```ts
// After line 200 in existing code:
setSubmitting(false);
// ADD: Refresh data for the current selectedDate
loadDataForDate(selectedDate);
```

Wait — the current `handleSubmit` uses `getTodayDate()` for the date, but the selected date might be different. The submit should use `selectedDate` instead of `getTodayDate()`.

**IMPORTANT CHANGE to handleSubmit**: The existing `handleSubmit` hardcodes `getTodayDate()` for both the `saveParsedLogEntry` call (line 195) and the rate-limit `insertFoodEntry` call (line 171). Change these to use the current `selectedDate`:

```ts
// Line ~171: change getTodayDate() to selectedDate
date: selectedDate,

// Line ~195: change date: getTodayDate() to date: selectedDate
date: selectedDate,
```

This allows the user to log entries for past dates (not just today).

**But careful**: `selectedDate` is in the closure. Since `handleSubmit` has `[]` dependency array, you need to use a ref to access the latest `selectedDate`:

```ts
const selectedDateRef = useRef(selectedDate);
selectedDateRef.current = selectedDate; // keep in sync
```

Then in `handleSubmit`, use `selectedDateRef.current` instead of `getTodayDate()`.

## Step 4: Compute derived values (useMemo)

```ts
const hasEntries = useMemo(
  () => foodEntries.length > 0 || exerciseEntries.length > 0,
  [foodEntries.length, exerciseEntries.length],
);

const dateLabel = useMemo(() => {
  if (selectedDate === getTodayDate()) return 'Today';
  const d = new Date(selectedDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}, [selectedDate]);

const todayDate = useMemo(() => getTodayDate(), []);
```

## Step 5: Add water quick-add handler

```ts
const [isAddingWater, setIsAddingWater] = useState(false);

const handleAddWater = useCallback(async (amountMl: number) => {
  const uid = userIdRef.current;
  if (uid === null) return;
  setIsAddingWater(true);
  try {
    await insertWaterEntry({
      user_id: uid,
      date: selectedDate,
      amount_ml: amountMl,
      timestamp: new Date().toISOString(),
    });
    const total = await getDailyWaterTotal(uid, selectedDate);
    setDailyWaterTotal(total);
  } finally {
    setIsAddingWater(false);
  }
}, [selectedDate]);
```

## Step 6: Replace stubs with real layout

Remove lines 250-253 (the two placeholder Views) and replace with:

```tsx
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
      totalCalories={dailyTotals.total_calories}
      totalProtein={dailyTotals.total_protein}
      totalCarbs={dailyTotals.total_carbs}
      totalFat={dailyTotals.total_fat}
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
      waterGoal={DEFAULT_WATER_GOAL}
      onAddWater={handleAddWater}
      isAdding={isAddingWater}
    />
    <EntryList
      foodEntries={foodEntries}
      exerciseEntries={exerciseEntries}
    />
  </ScrollView>
)}
```

### Header layout changes

Replace the current `<View style={styles.header}>` content (lines 245-249) with:

```tsx
<View style={styles.header}>
  <View style={styles.headerRow}>
    <MonthDropdown
      selectedDate={selectedDate}
      loggedDates={loggedDates}
      onDateSelect={onDateSelect}
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
```

Add `handleSettingsPress` (will be wired in Task 6.9, but define the callback here so types work):

```ts
const handleSettingsPress = useCallback(() => {
  navigation.navigate('Settings'); // navigation from useNavigation()
}, [navigation]);
```

Add to imports: `import { useNavigation } from '@react-navigation/native';`
Add: `const navigation = useNavigation<any>();` (or properly typed with `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` after Task 6.9 adds the Settings route).

Until Task 6.9 adds the Settings route, the type will error. Options:
1. Use `any` temporarily (fix in Task 6.9)
2. Add Settings route type first (in Task 6.9) before wiring the navigation call

**Better approach for incremental safety**: Add the `handleSettingsPress` callback but comment out the navigation line, then uncomment in Task 6.9. Or create the function as:

```ts
const handleSettingsPress = useCallback(() => {
  // Wired in Task 6.9
}, []);
```

Then Task 6.9 fills it in. This avoids type errors.

### Date select handler

```ts
const onDateSelect = useCallback((date: string) => {
  setSelectedDate(date);
}, []);
```

## Step 7: Handle all failure states

| State | Rendering |
|-------|-----------|
| Loading | `ActivityIndicator` centered. Size large. |
| Data error | Full-screen centered error: "Something went wrong" + "Retry" button (calls `loadDataForDate(selectedDate)`) |
| No data (empty) | Normal components render: DailySummary shows empty state, EntryList shows empty state, WaterQuickAdd shows 0ml |
| Daily Target null | DailySummary shows "Set up your daily target" message per row |
| Water goal default | WaterQuickAdd uses `DEFAULT_WATER_GOAL = 2000` |

## Step 8: Preserve existing features

DO NOT modify or remove:
- Error auto-dismiss after 5 seconds — lines 93-106
- handleSubmit rate-limit check, LLM parse, DB save — lines 146-233 (only change `getTodayDate()` → `selectedDateRef.current`)
- KeyboardAvoidingView behavior — lines 239-283 (outer wrapper)
- InputBar props — lines 274-283

## Step 9: Remove stubs

Delete:
- `<View style={styles.summaryPlaceholder} />` (line 251)
- `<View style={styles.entryListPlaceholder} />` (line 252)
- `summaryPlaceholder` style (lines 311-312)
- `entryListPlaceholder` style (lines 313-316)

## Step 10: Add new imports

```ts
import { ScrollView, ActivityIndicator, Pressable } from 'react-native'; // extend existing RN import
import { useFocusEffect } from '@react-navigation/native'; // add
import { getFoodEntriesByDate, getFoodItemsByEntryId, getDailyCalorieTotals, getLoggedDatesInRange, getDailyWaterTotal, insertWaterEntry } from '../database'; // extend existing @database import
import { getExerciseEntriesByDate, getDailyExerciseCalories } from '../database';
import DateStrip from '../components/DateStrip';
import MonthDropdown from '../components/MonthDropdown';
import DailySummary from '../components/DailySummary';
import WaterQuickAdd, { DEFAULT_WATER_GOAL } from '../components/WaterQuickAdd';
import EntryList from '../components/EntryList';
import type { EntryListFoodEntry, EntryListExerciseEntry } from '../components/EntryList';
```

Note: `ActivityIndicator` and `Pressable` likely need to be added to the existing `react-native` import (line 2) — they're not currently imported in HomeScreen.

---

## Edge cases

| Case | Behavior |
|------|----------|
| `userIdRef.current` is null on mount | Skip data load. User not yet set (shouldn't happen — HomeScreen only renders after auth). |
| DB read fails | `dataError` set, shows error state with Retry button |
| User has no targets set | `userTargets` all null → DailySummary shows "Set up your daily target" messages |
| Submit for a past date | `selectedDateRef.current` used instead of `getTodayDate()` — entry saved for selected date |
| Return from Settings | `useFocusEffect` refreshes user targets (but not entries/water) |
| Selected date = today, midnight passes | `useFocusEffect` on focus or app foreground. DateLabel recomputes from `selectedDate`. |
| Rapid date switching | Each change triggers `loadDataForDate`. Previous in-flight fetch(s) may complete after latest — state updates are idempotent (last write wins). |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] HomeScreen renders all components: MonthDropdown + DateStrip in header, DailySummary, WaterQuickAdd, EntryList in scroll area
- [ ] Changing date via DateStrip or MonthDropdown reloads all data for that date
- [ ] Water quick-add (+200ml, +500ml, Custom) works and updates progress bar
- [ ] Submit flow still works: LLM parse → save → refresh. Submits to currently selected date (not forced today).
- [ ] Returning from Settings (via focus) refreshes user targets
- [ ] Loading state shows ActivityIndicator
- [ ] Error state shows "Something went wrong" + Retry button that works
- [ ] Empty state (no entries) shows appropriate messages in DailySummary and EntryList
- [ ] Null targets show "Set up your daily target" messages
- [ ] Dark mode renders correctly across all integrated components
- [ ] ScrollView scrolls entire content; InputBar stays fixed at bottom
- [ ] No visual regression in existing InputBar behavior
- [ ] `summaryPlaceholder` and `entryListPlaceholder` stubs removed
