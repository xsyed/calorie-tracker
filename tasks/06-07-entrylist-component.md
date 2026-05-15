# Task 6.7: Build `EntryList` component

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on code:** `database/types.ts` (FoodEntry, FoodItem, ExerciseEntry types)
**Required by:** Task 6.8 (HomeScreen integration)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| FoodEntry type | `{ id, user_id, date, raw_text, status: 'pending' | 'complete' | 'failed', retry_count, created_at }` |
| FoodItem type | `{ id, food_entry_id, name, calories, protein_g, carbs_g, fat_g }` |
| ExerciseEntry type | `{ id, user_id, date, exercise_type, duration_minutes, calories_burned, timestamp }` |
| Existing flatlist/scrolling | HomeScreen uses `ScrollView`-like layout. No FlatList usage yet. InputBar is fixed at bottom via `KeyboardAvoidingView`. |
| Badge pattern | No existing badge/pill component. InputBar uses `borderRadius: 20` for pill shapes. |
| Card styling | No existing card component. Dark mode cards in `InputBar.tsx` use `#1C1C1E` bg dark / `#FFFFFF` light. |
| Decision on FlatList vs ScrollView | Per parent task spec: use `ScrollView` + `.map()` for simplicity. Typical 3-6 entries/day. FlatList virtualization not needed at this scale. |

---

## File to create

- `apps/mobile/src/components/EntryList.tsx`

---

## Design

Scrollable list of FoodEntries + ExerciseEntries for the selected date, interleaved and sorted newest first.

```
┌─ Today's Entries ──────────────────────────┐
│                                              │
│  ┌─ FoodEntry ──────────────────────────┐   │
│  │  "2 scrambled eggs..."    [Complete]  │   │
│  │  • scrambled eggs   140 kcal  P12 C0 F10│  │
│  │  • toast             70 kcal  P3 C14 F1 │   │
│  └──────────────────────────────────────────┘  │
│                                              │
│  ┌─ FoodEntry (pending) ──────────────┐   │
│  │  "chicken salad..."    [Pending]     │   │
│  │  (dimmed, no macro data)              │   │
│  └─────────────────────────────────────────┘  │
│                                              │
│  ┌─ FoodEntry (failed) ──────────────┐   │
│  │  "pizza lunch..."       [Failed]       │   │
│  │  Tap to retry or edit                  │   │
│  └─────────────────────────────────────────┘  │
│                                              │
│  ┌─ ExerciseEntry ──────────────────────┐   │
│  │  30 min walk            120 kcal      │   │
│  │  10:30 AM                            │   │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Data types (defined in this file)

```ts
interface EntryListFoodEntry {
  id: string;
  rawText: string;
  status: 'pending' | 'complete' | 'failed';
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>;
}

interface EntryListExerciseEntry {
  id: string;
  type: string;
  durationMinutes: number;
  caloriesBurned: number;
  timestamp: string;
}

interface EntryListProps {
  foodEntries: EntryListFoodEntry[];
  exerciseEntries: EntryListExerciseEntry[];
  onRetryEntry?: (entryId: string) => void;
  onEditEntry?: (entryId: string) => void;
}
```

These types SIMPLIFY the DB types for display. They differ from database types:
- `EntryListFoodEntry.rawText` vs `FoodEntry.raw_text` (camelCase)
- `EntryListFoodEntry.items` includes pre-loaded food items (array inline, not separate query)
- `EntryListExerciseEntry.type` vs `ExerciseEntry.exercise_type` (shortened)
- No `user_id`, `date`, `food_entry_id`, `retry_count` — display-only fields

---

## FoodEntry rendering

### Complete entry

- Header: `rawText` in bold/semibold (16px)
- Badge: "Complete" pill — green text on green-tinted background, small border-radius pill
- Items list (indented, below header):
  - Each item: `"• {name}  {calories} kcal  P{proteinG} C{carbsG} F{fatG}"`
  - Dim/light color for item text (13px)

### Pending entry

- Header: `rawText`, opacity 0.5 (dimmed)
- Badge: "Pending" pill — gray text on gray-tinted background
- No items shown
- Subtext: dimmed "Processing..." (12px, italic)

### Failed entry

- Header: `rawText`, opacity 0.5 (dimmed)
- Badge: "Failed" pill — red text (`#FF3B30` / `#FF453A`) on red-tinted background
- Subtext: "Tap to retry or edit" (13px, dimmed)
- No items shown
- Entire entry is pressable → calls `onRetryEntry?.(entryId)` or `onEditEntry?.(entryId)`

### Badge component (inline helper)

```tsx
function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config = {
    complete: { label: 'Complete', bg: '#E8F5E9', text: '#2E7D32', bgDark: '#1B3A1B', textDark: '#4CAF50' },
    pending: { label: 'Pending', bg: '#F5F5F5', text: '#757575', bgDark: '#2C2C2E', textDark: '#999999' },
    failed: { label: 'Failed', bg: '#FFEBEE', text: '#C62828', bgDark: '#3A1A1A', textDark: '#FF5252' },
  }[status] ?? { label: status, bg: '#F5F5F5', text: '#757575', bgDark: '#2C2C2E', textDark: '#999999' };

  return (
    <View style={{ backgroundColor: isDark ? config.bgDark : config.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? config.textDark : config.text }}>{config.label}</Text>
    </View>
  );
}
```

---

## ExerciseEntry rendering

- Main line: `"{durationMinutes} min {type} — {caloriesBurned} kcal"`
- Timestamp below (formatted): `"10:30 AM"`
- Use `toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })` on the timestamp string

### Time formatting

```ts
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
```

---

## Ordering and interleaving

All entries sorted by their timestamp descending (newest first):

```ts
type TimelineItem =
  | { type: 'food'; entry: EntryListFoodEntry }
  | { type: 'exercise'; entry: EntryListExerciseEntry };

const timeline = [
  ...foodEntries.map(entry => ({ type: 'food' as const, entry, ts: entry.createdAt })),
  ...exerciseEntries.map(entry => ({ type: 'exercise' as const, entry, ts: entry.timestamp })),
].sort((a, b) => b.ts.localeCompare(a.ts));
```

Render each `TimelineItem` with the appropriate card layout.

---

## Empty state

When both `foodEntries` and `exerciseEntries` are empty:

```
No entries for this day.
Tap the input bar below to log your first meal or exercise.
```

Centered text, dimmed color, within the card.

---

## Card styling per entry

- Background: `#FFFFFF` light / `#1C1C1E` dark
- Border radius: 10
- Padding: 12
- Margin bottom: 8
- Hairline border: `#E5E5E5` light / `#333333` dark

---

## Edge cases

| Case | Behavior |
|------|----------|
| Both arrays empty | Show empty state text |
| Only food entries | Show food cards only, sorted newest first |
| Only exercise entries | Show exercise cards only, sorted newest first |
| Entry with empty `items` array (complete but no food_items) | Show entry header + "Complete" badge, no items listed. Edge case from race condition. |
| Entry with many items (10+) | All items rendered — typical is 1-5. No virtualization needed. |
| `onRetryEntry` undefined | Failed entry not pressable — no callback wired |
| Long `rawText` | No truncation — wrap naturally, max 2-3 lines typical |
| Very old dates | Same rendering as today — no date-specific behavior |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Complete entries render with `rawText` header + food items list + "Complete" badge
- [ ] Pending entries render dimmed (opacity 0.5) with "Pending" badge, no items
- [ ] Failed entries render dimmed with "Failed" badge and "Tap to retry or edit" subtext
- [ ] Exercise entries render with type + duration + calories + formatted time
- [ ] Empty state renders when both arrays are empty
- [ ] Entries sorted newest first (food and exercise interleaved by timestamp)
- [ ] Dark mode renders correctly (all colors invert)
- [ ] Failed entries are pressable (calls `onRetryEntry` or `onEditEntry` when provided)
