# Task 6.4: Build `MonthDropdown` component

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on:** Task 6.2 (`getLoggedDatesInRange`)
**Required by:** Task 6.8 (HomeScreen integration)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| Existing components | Only `InputBar.tsx` and `WaveformIndicator.tsx`. Both use `Pressable`, `StyleSheet`, `useColorScheme`. |
| Dropdown/overlay pattern | No existing dropdown/modal components. Must build from scratch using absolute positioning. |
| Dark mode | `const isDarkMode = useColorScheme() === 'dark'`, conditional style arrays. |
| Date format | `YYYY-MM-DD`. |
| Month names | No `date-fns` or similar. Use manual formatting or `Date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })`. |
| Touch targets | Minimum 32x32 for day cells (per feature spec). |

---

## File to create

- `apps/mobile/src/components/MonthDropdown.tsx`

---

## Design

Month header tappable row showing "May 2026 ▼" between left/right arrows. Tapping opens a month grid below in an absolute-positioned overlay.

```
[<]  May 2026  ▼  [>]
┌──────────────────────────┐
│  M   T   W   T   F   S   S │
│            1   2   3   4   │
│  5   6   7   8  ●9  10  11  │
│ 12  13  14  15  16  17  18  │
│ 19  20  21  22  23  24  25  │
│ 26  27  28  29  30  31      │
└──────────────────────────┘
```

- Grid: 7 columns (M T W T F S S headers), up to 6 rows
- Days with logged entries: green dot below number
- Today: ring indicator
- Selected date: filled background
- Tapping a day → `onDateSelect(dateString)`, closes dropdown
- Tapping outside dropdown → closes
- Days in future: dimmed, not tappable
- Left/right arrows: navigate months
- Cannot navigate past current month
- Month header tapping toggles dropdown open/close

### Props

```ts
interface MonthDropdownProps {
  selectedDate: string;          // 'YYYY-MM-DD'
  loggedDates: Set<string>;      // set of 'YYYY-MM-DD' with ≥1 complete entries
  onDateSelect: (date: string) => void;
}
```

### Internal state

```ts
const [isOpen, setIsOpen] = useState(false);
const [displayYear, setDisplayYear] = useState(new Date(selectedDate).getFullYear());
const [displayMonth, setDisplayMonth] = useState(new Date(selectedDate).getMonth()); // 0-indexed
```

Reset `displayYear`/`displayMonth` when `selectedDate` changes from outside (e.g., DateStrip selection).

### Generating the grid

```ts
function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start

  const days: (number | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null); // blank leading cells
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}
```

### Date formatting

```ts
function formatMonthDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}
```

### Navigation logic

- **Left arrow**: decrement month. If month becomes -1 → year--, month = 11.
- **Right arrow**: increment month. Disabled if current month/year >= today's month/year.

### Outside tap handling

Wrap the dropdown overlay in a `Pressable` that calls `setIsOpen(false)`. The inner grid `Pressable` stops propagation to prevent closing when tapping inside.

### Styling notes

- Overlay: `position: 'absolute'`, `top: '100%'` (relative to header), `left: 0`, `right: 0`, `zIndex: 10`
- Grid: use `flexDirection: 'row'` + `flexWrap: 'wrap'` with each cell at `width: '14.28%'` (100/7)
- Day cells: min 32x32 touch area, center content
- Dot indicator: same green `#30D158` used in DateStrip, 4x4 circle
- Dropdown background: white card with shadow/border (light), dark card (dark)

### Today check

```ts
function isTodayDate(year: number, month: number, day: number): boolean {
  const today = new Date();
  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
}

function isFutureDate(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(year, month, day);
  return check > today;
}
```

---

## Edge cases

| Case | Behavior |
|------|----------|
| Selected date is in a different month from display | On open, reset `displayYear`/`displayMonth` to match `selectedDate` |
| Month has <6 rows | Last rows have blank cells — render normally |
| Future months | Right arrow disabled. All days dimmed, not tappable. |
| Current month with future days | Past/today days: normal. Future days: dimmed, not tappable. |
| Tap outside dropdown | Close dropdown. Use `Pressable` overlay with `onPress={() => setIsOpen(false)}`. |
| Tap a day | Call `onDateSelect(formatMonthDate(...))`, then `setIsOpen(false)`. |
| No logged dates | No green dots shown. Grid renders normally. |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Month header shows correct month name and year (e.g., "May 2026")
- [ ] Tapping header toggles calendar grid open/closed
- [ ] Calendar grid shows correct days for the month with proper Monday-start alignment
- [ ] Logged dates show green dots below day numbers
- [ ] Today shows ring/border indicator
- [ ] Tapping a day calls `onDateSelect` and closes dropdown
- [ ] Left/right arrows navigate months correctly
- [ ] Cannot navigate past current month (right arrow disabled)
- [ ] Future days are dimmed and not tappable
- [ ] Tapping outside dropdown closes it
- [ ] Dark mode renders correctly
- [ ] `selectedDate` change from external source resets display month on next open
