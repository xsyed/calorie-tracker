# Task 6.5: Build `DailySummary` component

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on:** Task 6.2 (`getDailyCalorieTotals`)
**Required by:** Task 6.8 (HomeScreen integration)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| Existing components | `InputBar.tsx` (269 lines) and `WaveformIndicator.tsx`. Both use conditional `StyleSheet` arrays for dark mode. |
| Progress bar pattern | No existing progress bar component. Must build from scratch using nested `View`s with percentage-based width. |
| Color usage | `InputBar.tsx` uses `#007AFF` / `#0A84FF` (blue), `#FFFFFF` / `#000000` (text), `#F0F0F0` / `#2C2C2E` (input bg). Dark mode: `#1C1C1E` (bg), `#3A3A3C` (button bg). |
| User targets | Available from `userRepository.getUser()` → `user.daily_target_calories`, `user.protein_g`, `user.carbs_g`, `user.fat_g`. All nullable (`number | null`). |
| No UI library | Plain React Native only. |

---

## File to create

- `apps/mobile/src/components/DailySummary.tsx`

---

## Design

Card/section showing calorie + macro progress bars + exercise display.

```
┌─ Daily Summary ───────────────────────────┐
│  Calories:  1,450 / 2,000  (72%)          │
│  ████████████░░░░░░░░                     │
│                                            │
│  Protein:   120g / 150g  (80%)            │
│  ████████████████░░░░                     │
│                                            │
│  Carbs:     140g / 200g  (70%)            │
│  ██████████████░░░░░░                     │
│                                            │
│  Fat:        45g / 55g  (82%)             │
│  ████████████████░░░░                     │
│                                            │
│  Exercise:  250 kcal burned               │
└────────────────────────────────────────────┘
```

### Props

```ts
interface DailySummaryProps {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  exerciseCalories: number;
  dateLabel: string;
  hasEntries: boolean;
}
```

---

## Progress bar behavior

### Percentage calculation

```ts
function getPercentage(consumed: number, target: number | null): number | null {
  if (target === null || target === 0) return null;
  return Math.round((consumed / target) * 100);
}
```

### Bar rendering

- If percentage is `null` (target not set): show `"Set up your daily target"` message instead of bar
- If percentage is a number: render two nested `View`s
  - Outer: full-width, height ~8, rounded, track color (`#E5E5E5` light / `#3A3A3C` dark)
  - Inner: percentage-based width (`Math.min(percent, 100)`%), height 8, rounded, brand color
- Always show actual numbers: `"120g / 150g (80%)"` or `"240g / 150g (160%)"` when over 100%

### Bar colors

| Macro | Light color | Dark color |
|-------|-------------|------------|
| Calories | `#007AFF` | `#0A84FF` |
| Protein | `#FF3B30` | `#FF453A` |
| Carbs | `#FF9500` | `#FFD60A` |
| Fat | `#FFCC00` | `#FFD60A` |

Unfilled track: `#E5E5E5` light / `#3A3A3C` dark.

### ProgressRow sub-component pattern

Since all 4 macros share the same layout, create a helper:

```tsx
function ProgressRow({
  label,
  consumed,
  target,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit: string;
  color: string;
}) {
  const percent = getPercentage(consumed, target);
  const isDark = useColorScheme() === 'dark';

  if (target === null || target === 0) {
    return (
      <View style={styles.row}>
        <Text style={[styles.label, isDark && styles.labelDark]}>
          {label}: Set up your daily target
        </Text>
      </View>
    );
  }

  const barWidth = Math.min(percent!, 100);

  return (
    <View style={styles.row}>
      <Text style={[styles.label, isDark && styles.labelDark]}>
        {label}: {consumed}{unit} / {target}{unit} ({percent}%)
      </Text>
      <View style={[styles.track, isDark && styles.trackDark]}>
        <View style={[styles.bar, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
```

**IMPORTANT**: The `useColorScheme()` hook must be called at the top level of the component, not inside a helper function. You have two options:
1. Pass `isDark` as a prop to `ProgressRow`
2. Define `ProgressRow` as a nested component (which still violates hooks rules for hooks inside conditionals/loops).

**Correct approach**: Call `useColorScheme()` once in `DailySummary`, pass `isDark` to `ProgressRow`.

### Exercise display

Show as separate line only if `exerciseCalories > 0`:

```
Exercise: 250 kcal burned
```

Exercise calories are NOT subtracted from the calorie progress bar.

### Empty state

When `hasEntries === false`:

- If `targetCalories !== null`: `"No entries for {dateLabel}. Tap the input bar to log your first meal."`
- If `targetCalories === null`: `"Set up your daily target to see progress."`

Empty state replaces the entire summary content. Show as centered text within the card.

### Card styling

- Background: `#FFFFFF` light / `#1C1C1E` dark
- Border radius: 12
- Padding: 16
- Title: "Daily Summary" in bold, 18px
- Section margin between rows: 12px

---

## Edge cases

| Case | Behavior |
|------|----------|
| Target is `null` | Show "Set up your daily target" message for that row, no bar |
| Target is `0` | Same as `null` — treat as not configured |
| Consumed > target (>100%) | Bar capped at 100% width, text shows actual overage e.g. `"240g / 150g (160%)"` |
| Consumed is 0 | Bar shows 0% width, text shows `"0g / 150g (0%)"` |
| All targets null + no entries | Show the "Set up your daily target" empty state |
| Targets set + no entries | Show "No entries for {dateLabel}" empty state |
| exerciseCalories is 0 | Exercise line not rendered |
| exerciseCalories > 0 | Exercise line shown, NOT subtracted from calorie bar |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All 4 progress bars (calories, protein, carbs, fat) render with correct percentages
- [ ] Bars cap at 100% width when consumed exceeds target
- [ ] Text label shows actual consumed/target numbers even when over 100%
- [ ] Null/0 targets show "Set up your daily target" message instead of bar
- [ ] Empty state shown when `hasEntries === false` (with appropriate message)
- [ ] Exercise calories shown as separate line only when > 0
- [ ] Exercise calories not subtracted from calorie progress
- [ ] Bar colors match spec (blue/red/orange/yellow)
- [ ] Dark mode renders correctly (all colors invert)
