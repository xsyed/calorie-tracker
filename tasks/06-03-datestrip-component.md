# Task 6.3: Build `DateStrip` component

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on:** Task 6.2 (`getLoggedDatesInRange`)
**Required by:** Task 6.8 (HomeScreen integration)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| Existing components | `InputBar.tsx` uses `useColorScheme()`, `StyleSheet.create()`, plain RN Views. |
| Dark mode pattern | `const isDarkMode = useColorScheme() === 'dark'` then conditional style arrays: `[styles.foo, isDarkMode && styles.fooDark]`. |
| Button sizing | `InputBar.tsx` uses `minHeight: 44` implicitly via padding. Mic button is 36x36 with borderRadius 18. Send button is pill-shaped `borderRadius: 20`. |
| Color palette (from existing code) | Light: bg `#FFFFFF`, text `#000000`, border `#CCCCCC`, filled bg `#F0F0F0`. Dark: bg `#1C1C1E`/`#000000`, text `#FFFFFF`, border `#333333`, filled bg `#2C2C2E`/`#3A3A3C`. Blue accent: `#007AFF` light / `#0A84FF` dark. |
| No UI library | Plain React Native only. No third-party date pickers, no calendar libraries. |
| Date format | `YYYY-MM-DD` (from `getTodayDate()` in HomeScreen.tsx line 25). |
| TypeScript | Strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. |

---

## File to create

- `apps/mobile/src/components/DateStrip.tsx`

---

## Design

7-day horizontal strip showing current Mon-Sun window. Arrows at sides navigate weeks.

```
[<]  M  T  W  T  F  S  S  [>]
     ●     ●     ●  ●  ◉
     8  9 10 11 12 13 14
```

- `●` = green/teal dot below date number (day has ≥1 complete entries)
- `◉` = today indicator (ring/highlight around date number)
- Selected date = filled pill background
- Tapping a date → `onDateSelect(dateString)`
- Left/right arrows move window by 7 days
- Cannot navigate to future weeks (right arrow disabled if current week includes today)
- Days beyond today in current week: show date number dimmed, no dot, not tappable

### Props

```ts
interface DateStripProps {
  selectedDate: string;          // 'YYYY-MM-DD'
  loggedDates: Set<string>;      // set of 'YYYY-MM-DD' with ≥1 complete entries
  onDateSelect: (date: string) => void;
}
```

### Internal state

```ts
const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
```

Initialize `weekStart` to the Monday that contains `selectedDate` on mount. Re-compute when `selectedDate` changes from outside (e.g., MonthDropdown selection).

### Key helper functions

```ts
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday offset
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  return formatDate(date) === getTodayDate();
}

function isFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
}
```

Note: `getTodayDate()` is defined in HomeScreen.tsx. Either copy the 6-line function into this component, or extract it to a shared utility. Per AGENTS.md "simplicity first" — copying is fine for a utility this small. If it appears in ≥3 files after this feature, extract then.

### Day generation

Generate an array of 7 `Date` objects starting from `weekStart`:

```ts
const days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + i);
  return d;
});
```

### Arrow logic

- **Left arrow**: always enabled. On press: `setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })`
- **Right arrow**: disabled if `weekStart` + 6 days >= today. Compute: `const canGoNext = !isToday(days[6]) && days[6] < today`

### Day cell rendering

Each day cell:
- Day letter (M T W T F S S) — label at top
- Date number — below label
- If `isFuture(day)`: dimmed text opacity 0.3, not pressable
- If `isToday(day)`: ring indicator (border around date number, 1px solid, accent color)
- If `formatDate(day) === selectedDate`: filled pill background (accent color bg, white text)
- If `loggedDates.has(formatDate(day))` and not future: green dot (6x6 circle, `#30D158`) below date number
- Press handler: `onDateSelect(formatDate(day))` (only if not future)
- Min touch target 44px height (wrap in Pressable with padding)

### Week change effect

When `selectedDate` changes externally (e.g., from MonthDropdown), check if it falls within the current visible week. If not, recalculate `weekStart`:

```ts
useEffect(() => {
  const selected = new Date(selectedDate + 'T00:00:00');
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  if (selected < weekStart || selected > weekEnd) {
    setWeekStart(getMonday(selected));
  }
}, [selectedDate]);
```

### Style reference

Follow existing patterns from `InputBar.tsx` styles:
- Container: horizontal row, alignItems center, gap/spacing
- Arrow buttons: 36x36, borderRadius 18, center content
- Active day pill: backgroundColor `#007AFF` / `#0A84FF`, borderRadius 16
- Dot: 6x6, borderRadius 3, backgroundColor `#30D158`

---

## Edge cases

| Case | Behavior |
|------|----------|
| `selectedDate` is outside current visible week | `useEffect` recalculates `weekStart` to show the week containing `selectedDate` |
| All 7 days are in the future | Show dimmed days, both arrows disabled |
| Week includes mix of past + future days | Past days: normal. Today: ring. Future days: dimmed, not tappable. Left arrow enabled. Right arrow disabled. |
| No logged dates | No green dots shown. Strip renders normally. |
| Rapid arrow tapping | `setWeekStart` is synchronous state update — React batches. No debounce needed. |
| Month boundary crossing | `new Date()` with `setDate(d.getDate() + 7)` handles month rollover correctly. |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Renders 7 days with correct day letters (M T W T F S S) and date numbers
- [ ] Today has distinct visual indicator (ring/border)
- [ ] Selected date has filled pill background highlight
- [ ] Logged dates show green dot (`#30D158`) below date number
- [ ] Tapping a date calls `onDateSelect` with correct `'YYYY-MM-DD'` string
- [ ] Left arrow navigates to previous week
- [ ] Right arrow navigates to next week (disabled if current week includes today)
- [ ] Cannot navigate past today's week
- [ ] Days beyond today are dimmed and not tappable
- [ ] Dark mode renders correctly (all colors invert properly)
- [ ] `selectedDate` change from external source scrolls to the correct week
